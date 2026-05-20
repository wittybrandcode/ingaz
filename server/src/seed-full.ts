import 'dotenv/config'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { getDb, getPool } from './db/index.js'
import { sql } from 'drizzle-orm'
import { ROLES } from './constants.js'

let pool: any

const get = async (q: string, ...params: unknown[]) => {
  const result = await pool.query(q, params)
  return result.rows[0] as Record<string, unknown> | undefined
}

const run = async (q: string, ...params: unknown[]) => {
  await pool.query(q, params)
}

async function main() {
  pool = getPool()

  console.log('\n🌱 بذور شاملة لتطبيق إنجاز\n')

  // ============================================================
  // 0. Clear existing data (FK enforcement is always on in PostgreSQL)
  // ============================================================
  console.log('🧹 تنظيف البيانات القديمة...')
  // -- foreign_keys are always enforced in PostgreSQL
  const tables = [
    'deadline_reminders', 'token_blacklist', 'notification_preferences',
    'attachments', 'comments', 'activity_logs', 'notifications',
    'warnings', 'subtasks', 'subtask_assignees', 'tasks', 'task_assignees',
    'projects', 'project_members',
    'role_permissions', 'permissions', 'notification_types',
    'restriction_levels', 'warning_types', 'users', 'roles',
  ]
  for (const t of tables) await run(`DELETE FROM ${t}`)
  // Reset sequences for all tables (PostgreSQL equivalent of DELETE FROM sqlite_sequence)
  for (const t of tables) {
    await pool.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), 1, false)`).catch(() => {})
  }
  console.log('✅ تم التنظيف')

  // ============================================================
  // 1. Seed base data (roles, restriction levels, warning types, permissions, notif types)
  // ============================================================
  console.log('\n🏗️  بذر البيانات الأساسية...')

  await run('INSERT INTO roles (id, name) VALUES ($1, $2)', ROLES.ADMIN, 'admin')
  await run('INSERT INTO roles (id, name) VALUES ($1, $2)', ROLES.DEPUTY, 'deputy')
  await run('INSERT INTO roles (id, name) VALUES ($1, $2)', ROLES.EMPLOYEE, 'employee')

  const insLevelSql =
    'INSERT INTO restriction_levels (name, name_ar, min_score, color, icon, show_banner, can_login, can_create_projects, can_create_tasks, can_edit, can_assign, can_submit, can_comment, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)'
  await run(insLevelSql, 'excellent', 'ممتاز', 8, '#22c55e', 'CheckCircle2', 0, 1, 1, 1, 1, 1, 1, 1, 1)
  await run(insLevelSql, 'warning', 'تنبيه', 5, '#eab308', 'AlertTriangle', 1, 1, 1, 1, 1, 1, 1, 1, 2)
  await run(insLevelSql, 'restricted', 'مقيد', 3, '#f97316', 'Lock', 1, 1, 0, 0, 0, 0, 1, 1, 3)
  await run(insLevelSql, 'frozen', 'مجمد', 0, '#ef4444', 'Snowflake', 0, 0, 0, 0, 0, 0, 0, 0, 4)

  const insWtSql = 'INSERT INTO warning_types (name, description, points, is_active) VALUES ($1, $2, $3, $4)'
  const wtData = [
    ['تأخير عن العمل', 'التأخر عن وقت الدوام أو الحضور متأخراً', 1, 1],
    ['تقصير في المهام', 'عدم إنجاز المهام المسندة بالجودة المطلوبة', 2, 1],
    ['عدم التزام بالمواعيد', 'تجاوز المواعيد النهائية للمهام', 2, 1],
    ['إهمال متكرر', 'تكرار الإهمال في أداء المهام', 3, 1],
    ['مخالفة تعليمات العمل', 'عدم اتباع الأنظمة والتعليمات', 4, 1],
    ['غياب بدون إذن', 'الغياب عن العمل دون تصريح مسبق', 3, 1],
    ['تسليم أعمال غير مكتملة', 'تسليم مهام غير كاملة أو ناقصة', 1, 1],
    ['سلوك غير لائق', 'سلوك غير مهني مع الزملاء أو المدراء', 5, 1],
  ]
  for (const w of wtData) await run(insWtSql, ...w)

  const permSql = 'INSERT INTO permissions (key, name, group_name, sort_order) VALUES ($1, $2, $3, $4)'
  const permissions = [
    ['projects.view', 'عرض المشاريع', 'المشاريع', 1],
    ['projects.create', 'إنشاء المشاريع', 'المشاريع', 2],
    ['projects.edit', 'تعديل المشاريع', 'المشاريع', 3],
    ['projects.delete', 'حذف المشاريع', 'المشاريع', 4],
    ['projects.archive', 'أرشفة المشاريع', 'المشاريع', 5],
    ['projects.assign', 'تكليف أعضاء المشروع', 'التكليف', 1],
    ['tasks.view', 'عرض المهام', 'المهام', 1],
    ['tasks.create', 'إنشاء المهام', 'المهام', 2],
    ['tasks.edit', 'تعديل المهام', 'المهام', 3],
    ['tasks.delete', 'حذف المهام', 'المهام', 4],
    ['tasks.assign', 'تكليف المسؤولين عن المهام', 'التكليف', 2],
    ['subtasks.view', 'عرض المهام الفرعية', 'المهام الفرعية', 1],
    ['subtasks.create', 'إنشاء المهام الفرعية', 'المهام الفرعية', 2],
    ['subtasks.edit', 'تعديل المهام الفرعية', 'المهام الفرعية', 3],
    ['subtasks.delete', 'حذف المهام الفرعية', 'المهام الفرعية', 4],
    ['subtasks.assign', 'تعيين المهام الفرعية', 'التكليف', 3],
    ['subtasks.approve', 'قبول/رفض المهام', 'المهام الفرعية', 6],
    ['subtasks.submit', 'تسليم المهام', 'المهام الفرعية', 7],
    ['users.view', 'عرض المستخدمين', 'المستخدمين', 1],
    ['users.create', 'إنشاء المستخدمين', 'المستخدمين', 2],
    ['users.edit', 'تعديل المستخدمين', 'المستخدمين', 3],
    ['users.delete', 'حذف المستخدمين', 'المستخدمين', 4],
    ['roles.view', 'عرض الأدوار', 'الأدوار والصلاحيات', 1],
    ['roles.create', 'إنشاء الأدوار', 'الأدوار والصلاحيات', 2],
    ['roles.edit', 'تعديل الأدوار', 'الأدوار والصلاحيات', 3],
    ['roles.delete', 'حذف الأدوار', 'الأدوار والصلاحيات', 4],
    ['analytics.view', 'عرض التقارير', 'التقارير', 1],
    ['comments.create', 'إضافة تعليقات', 'التعليقات', 1],
  ]
  for (const [key, name, group, sort] of permissions) await run(permSql, key, name, group, sort)

  const allPermsResult = await pool.query('SELECT id, key FROM permissions')
  const allPerms = allPermsResult.rows as { id: number; key: string }[]
  const rpSql = 'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)'
  for (const p of allPerms) await run(rpSql, ROLES.ADMIN, p.id)
  const deputyExcluded = ['users.', 'roles.', 'projects.delete', 'projects.archive', 'subtasks.assign']
  for (const p of allPerms) {
    if (!deputyExcluded.some(ex => p.key.startsWith(ex))) await run(rpSql, ROLES.DEPUTY, p.id)
  }
  const employeeOnly = ['projects.view', 'tasks.view', 'subtasks.view', 'subtasks.create', 'subtasks.submit', 'comments.create']
  for (const p of allPerms) {
    if (employeeOnly.some(k => p.key === k)) await run(rpSql, ROLES.EMPLOYEE, p.id)
  }

  const ntSql = 'INSERT INTO notification_types (type_key, type_group, name, description, default_enabled) VALUES ($1, $2, $3, $4, $5)'
  const notifTypes = [
    ['project_created', 'مشاريع', 'إنشاء مشروع', 'عند إنشاء مشروع جديد', 1],
    ['project_updated', 'مشاريع', 'تعديل مشروع', 'عند تعديل مشروع', 1],
    ['project_archived', 'مشاريع', 'أرشفة مشروع', 'عند أرشفة مشروع', 1],
    ['project_deleted', 'مشاريع', 'حذف مشروع', 'عند حذف مشروع', 1],
    ['task_created', 'مهام', 'إنشاء مهمة', 'عند إنشاء مهمة جديدة', 1],
    ['task_updated', 'مهام', 'تعديل مهمة', 'عند تعديل مهمة', 1],
    ['task_archived', 'مهام', 'أرشفة مهمة', 'عند أرشفة مهمة', 1],
    ['subtask_created', 'مهام فرعية', 'إنشاء مهمة فرعية', 'عند إنشاء مهمة فرعية جديدة', 1],
    ['subtask_assigned', 'مهام فرعية', 'إسناد مهمة', 'عند إسناد مهمة فرعية لك', 1],
    ['assignment_changed', 'مهام فرعية', 'تغيير المسؤول', 'عند تغيير المسؤول عن مهمة', 1],
    ['in_progress', 'مهام فرعية', 'بدء تنفيذ', 'عند بدء تنفيذ مهمة', 1],
    ['submitted', 'مهام فرعية', 'تسليم مهمة', 'عند تسليم مهمة للمراجعة', 1],
    ['approved', 'مهام فرعية', 'قبول مهمة', 'عند قبول مهمتك', 1],
    ['rejected', 'مهام فرعية', 'رفض مهمة', 'عند رفض مهمتك', 1],
    ['comment', 'تعليقات', 'تعليق جديد', 'عند إضافة تعليق على مهمتك', 1],
    ['@mention', 'تعليقات', '@إشارة', 'عند الإشارة إليك في تعليق', 1],
    ['deadline_approaching_24h', 'مواعيد', 'قبل 24 ساعة', 'تذكير قبل الموعد النهائي بـ 24 ساعة', 1],
    ['deadline_approaching_6h', 'مواعيد', 'قبل 6 ساعات', 'تذكير قبل الموعد النهائي بـ 6 ساعات', 1],
    ['deadline_overdue', 'مواعيد', 'تجاوز الموعد', 'عند تجاوز الموعد النهائي', 1],
    ['deadline_extended', 'مواعيد', 'تمديد موعد', 'عند تمديد الموعد النهائي', 1],
    ['file_uploaded', 'ملفات', 'رفع ملف', 'عند رفع ملف في مشروع أو مهمة', 1],
    ['user_joined', 'فريق', 'انضمام عضو', 'عند انضمام عضو جديد للفريق', 1],
    ['role_changed', 'فريق', 'تغيير دور', 'عند تغيير دورك في النظام', 1],
    ['warning', 'إنذارات', 'إنذار جديد', 'عند إصدار إنذار بحقك', 1],
    ['warning_ignored', 'إنذارات', 'تجاهل الإنذار', 'عند تجاهل الإنذار', 1],
    ['warning_cleared', 'إنذارات', 'مسح الإنذار', 'عند مسح الإنذار', 1],
    ['warning_sustained', 'إنذارات', 'تثبيت الإنذار', 'عند تثبيت الإنذار', 1],
    ['account_frozen', 'حساب', 'تجميد الحساب', 'عند تجميد حسابك', 1],
    ['account_unfrozen', 'حساب', 'فك التجميد', 'عند فك تجميد حسابك', 1],
    ['daily_summary', 'دورية', 'ملخص يومي', 'ملخص يومي صباحي بالمهام', 1],
    ['new_login', 'أمان', 'تسجيل دخول جديد', 'عند تسجيل الدخول من جهاز جديد', 1],
    ['password_changed', 'أمان', 'تغيير كلمة المرور', 'عند تغيير كلمة المرور', 1],
  ]
  for (const [key, group, name, desc, enabled] of notifTypes) await run(ntSql, key, group, name, desc, enabled)

  console.log('✅ البيانات الأساسية (الأدوار، الصلاحيات، أنواع الإشعارات، الإنذارات، المستويات)')

  // ============================================================
  // 2. USERS (25 total)
  // ============================================================
  console.log('\n👥 بذر المستخدمين...')
  const passwords = [
    'admin123', 'deputy123', 'emp123', 'ahmed123', 'sara123',
    'mohamed123', 'noura123', 'khalid123', 'mona123', 'faisal123',
    'hind123', 'sami123', 'laila123', 'yusuf123', 'rana123',
    'majed123', 'dana123', 'turkid123', 'salma123', 'badr123',
    'huda123', 'nasser123', 'amani123', 'saad123', 'layan123',
  ]
  const hashed = await Promise.all(passwords.map(p => bcrypt.hash(p, 10)))

  const users = [
    { name: 'المدير العام', email: 'admin@ingaz.com', role_id: ROLES.ADMIN, credit: 10 },
    { name: 'نائب المدير', email: 'deputy@ingaz.com', role_id: ROLES.DEPUTY, credit: 10 },
    { name: 'موظف نموذجي', email: 'emp@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'أحمد الشريف', email: 'ahmed@ingaz.com', role_id: ROLES.ADMIN, credit: 10 },
    { name: 'سارة النمر', email: 'sara@ingaz.com', role_id: ROLES.DEPUTY, credit: 10 },
    { name: 'محمد العبدالله', email: 'mohamed@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'نورة السعيد', email: 'noura@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'خالد المطيري', email: 'khalid@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 9 },
    { name: 'منى الحربي', email: 'mona@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 8 },
    { name: 'فيصل الدوسري', email: 'faisal@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 7 },
    { name: 'هند القحطاني', email: 'hind@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 6 },
    { name: 'سامي الزهراني', email: 'sami@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 5 },
    { name: 'ليلى الغامدي', email: 'laila@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 5 },
    { name: 'يوسف الأنصاري', email: 'yusuf@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'رنا الشمري', email: 'rana@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'ماجد العتيبي', email: 'majed@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 8 },
    { name: 'دينا بكر', email: 'dana@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'تركي الزهراني', email: 'turki@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 7 },
    { name: 'سلمى الشهراني', email: 'salma@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'بدر الحارثي', email: 'badr@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 9 },
    { name: 'هدى الغامدي', email: 'huda@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'ناصر السبيعي', email: 'nasser@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'أماني الزهراني', email: 'amani@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'سعد القحطاني', email: 'saad@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
    { name: 'ليان الشريف', email: 'layan@ingaz.com', role_id: ROLES.EMPLOYEE, credit: 10 },
  ]

  const userSql = 'INSERT INTO users (name, email, password, role_id, status, credit_score) VALUES ($1, $2, $3, $4, $5, $6)'
  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    await run(userSql, u.name, u.email, hashed[i], u.role_id, 'active', u.credit)
  }
  console.log(`✅ ${users.length} مستخدم`)

  // ============================================================
  // 3. PROJECTS (12)
  // ============================================================
  console.log('\n📁 بذر المشاريع...')
  const projects = [
    { title: 'تطوير نظام الفوترة الإلكترونية', desc: 'نظام متكامل لإدارة الفواتير الإلكترونية والفواتير الضريبية مع ربط بمنصة زكاتي وإصدار التقارير المالية الشهرية', by: 1 },
    { title: 'إعادة تصميم الموقع الرسمي', desc: 'إعادة تصميم الموقع بالكامل باستخدام أحدث تقنيات الواجهات مع دعم كامل للجوال وتحسين تجربة المستخدم', by: 4 },
    { title: 'حملة التسويق الرقمي للمنتجات الجديدة', desc: 'حملة إعلانية متكاملة عبر منصات التواصل الاجتماعي لإطلاق 3 منتجات جديدة مع تحليل الأداء', by: 5 },
    { title: 'تطبيق الجوال للموظفين', desc: 'تطبيق جوال يسمح للموظفين بمتابعة مهامهم وإدارة الإنذارات والملف الشخصي والإشعارات', by: 1 },
    { title: 'تدريب الموظفين على النظام الجديد', desc: 'خطة تدريبية شاملة لجميع الموظفين على النظام الجديد مع اختبارات تقييم وشهادات إتمام', by: 5 },
    { title: 'منصة التعلم الإلكتروني', desc: 'منصة تفاعلية للتعلم الإلكتروني تحتوي على فيديوهات تدريبية واختبارات وشهادات', by: 4 },
    { title: 'نظام إدارة الموارد البشرية', desc: 'نظام متكامل لإدارة شؤون الموظفين والإجازات والرواتب والتقييم الدوري', by: 1 },
    { title: 'متجر إلكتروني للمنتجات', desc: 'متجر إلكتروني متكامل مع سلة مشتريات وبوابة دفع وشحن وتتبع الطلبات', by: 4 },
    { title: 'نظام إدارة المخزون', desc: 'نظام لإدارة المخزون والمستودعات مع تنبيهات عند انخفاض المخزون وتقارير دورية', by: 5 },
    { title: 'بوابة الخدمات الحكومية', desc: 'بوابة إلكترونية تقدم خدمات حكومية متنوعة للمواطنين والمقيمين', by: 1 },
    { title: 'تطبيق التوصيل الذكي', desc: 'تطبيق لتوصيل الطلبات مع تتبع مباشر للسائقين وتقييم الخدمة', by: 4 },
    { title: 'نظام إدارة الفعاليات', desc: 'نظام لإدارة الفعاليات والمؤتمرات مع التسجيل الإلكتروني وجدولة الجلسات', by: 5 },
  ]

  const projSql = 'INSERT INTO projects (title, description, created_by, created_at) VALUES ($1, $2, $3, $4) RETURNING id'
  const pIds: number[] = []
  for (const p of projects) {
    const ca = new Date(Date.now() - Math.random() * 60 * 86400000).toISOString().replace('T', ' ').slice(0, 19)
    const r = await pool.query(projSql, [p.title, p.desc, p.by, ca])
    pIds.push(r.rows[0].id as number)
  }
  console.log(`✅ ${projects.length} مشروع`)

  // ============================================================
  // 4. TASKS (4-5 per project = 55 tasks)
  // ============================================================
  console.log('\n📋 بذر المهام...')
  interface TaskDef {
    pid: number; title: string; desc: string; by: number;
  }
  const taskDefs: TaskDef[] = [
    { pid: pIds[0], title: 'تصميم قاعدة البيانات', desc: 'تصميم ERD وجداول الفواتير والعملاء والمنتجات', by: 1 },
    { pid: pIds[0], title: 'واجهة إنشاء فاتورة', desc: 'تصفح وإدخال بيانات الفاتورة مع إضافة الأصناف والخصومات', by: 4 },
    { pid: pIds[0], title: 'ربط مع منصة زكاتي', desc: 'API ربط لإصدار الفواتير الضريبية إلكترونياً', by: 1 },
    { pid: pIds[0], title: 'لوحة تحكم الفواتير', desc: 'إحصائيات وتقارير الفواتير الشهرية مع رسوم بيانية', by: 5 },

    { pid: pIds[1], title: 'تصميم الهيكل الرئيسي', desc: 'تصميم الـ Layout الرئيسي مع القوائم والهيدر والفوتر', by: 4 },
    { pid: pIds[1], title: 'صفحات الخدمات والمنتجات', desc: 'عرض الخدمات مع إمكانية التصفية والبحث', by: 4 },
    { pid: pIds[1], title: 'نموذج التواصل والشكاوي', desc: 'نموذج تواصل متكامل مع التحقق وإرسال إشعار', by: 5 },
    { pid: pIds[1], title: 'تحسين محركات البحث SEO', desc: 'تحسين الموقع لمحركات البحث والأداء', by: 1 },
    { pid: pIds[1], title: 'لوحة إدارة المحتوى', desc: 'لوحة لإدارة المحتوى وإضافة التحديثات', by: 5 },

    { pid: pIds[2], title: 'إعداد الحملات الإعلانية', desc: 'إعداد إعلانات مدفوعة على فيسبوك وإنستغرام وتويتر', by: 5 },
    { pid: pIds[2], title: 'تصميم المحتوى البصري', desc: 'تصميم صور وفيديوهات متحركة للحملة', by: 5 },
    { pid: pIds[2], title: 'تحليل أداء الحملات', desc: 'إعداد لوحة تحكم لمتابعة أداء الحملات آنياً', by: 5 },
    { pid: pIds[2], title: 'تقرير نهاية الحملة', desc: 'تقرير مفصل بنتائج الحملة والتوصيات', by: 4 },

    { pid: pIds[3], title: 'تصفح المهام والتصفية', desc: 'واجهة عرض المهام مع تصفية حسب الحالة والبحث', by: 1 },
    { pid: pIds[3], title: 'لوحة الإنذارات', desc: 'عرض الإنذارات والرد عليها وإرفاق المستندات', by: 1 },
    { pid: pIds[3], title: 'الملف الشخصي', desc: 'عرض وتعديل الملف الشخصي مع الصورة الرمزية', by: 4 },
    { pid: pIds[3], title: 'الإشعارات المباشرة', desc: 'نظام الإشعارات المباشرة مع الإعدادات', by: 1 },
    { pid: pIds[3], title: 'تسليم العمل عبر الجوال', desc: 'إرفاق صور وملفات ونصوص عند تسليم المهمة', by: 4 },

    { pid: pIds[4], title: 'إعداد المواد التدريبية', desc: 'تسجيل فيديوهات وشرائح تعليمية وأدلة مستخدم', by: 5 },
    { pid: pIds[4], title: 'جدولة الدورات', desc: 'تحديد مواعيد التدريب للمجموعات المختلفة', by: 5 },
    { pid: pIds[4], title: 'اختبارات التقييم', desc: 'إعداد اختبارات لتقييم الموظفين بعد التدريب', by: 1 },
    { pid: pIds[4], title: 'شهادات الإتمام', desc: 'تصميم وإصدار شهادات إتمام التدريب', by: 4 },

    { pid: pIds[5], title: 'تصميم واجهة المنصة', desc: 'تصميم واجهة مستخدم جذابة وسهلة الاستخدام', by: 4 },
    { pid: pIds[5], title: 'نظام الفيديوهات', desc: 'رفع وتشغيل الفيديوهات مع دعم الترجمة', by: 1 },
    { pid: pIds[5], title: 'نظام الاختبارات', desc: 'إنشاء اختبارات تفاعلية مع تصحيح تلقائي', by: 1 },
    { pid: pIds[5], title: 'لوحة متابعة التقدم', desc: 'عرض تقدم المتدربين والإحصائيات', by: 5 },

    { pid: pIds[6], title: 'إدارة شؤون الموظفين', desc: 'بيانات الموظفين والعقود والإجازات', by: 1 },
    { pid: pIds[6], title: 'نظام الرواتب', desc: 'حساب الرواتب والبدلات والخصومات', by: 4 },
    { pid: pIds[6], title: 'التقييم الدوري', desc: 'نظام تقييم أداء الموظفين الدوري', by: 5 },
    { pid: pIds[6], title: 'تقارير الموارد البشرية', desc: 'تقارير وإحصائيات الموارد البشرية', by: 5 },

    { pid: pIds[7], title: 'تصميم المتجر', desc: 'تصميم واجهة المتجر الإلكتروني', by: 4 },
    { pid: pIds[7], title: 'سلة المشتريات', desc: 'نظام سلة مشتريات مع إدارة الكميات', by: 4 },
    { pid: pIds[7], title: 'بوابة الدفع', desc: 'ربط مع بوابات الدفع الإلكتروني', by: 1 },
    { pid: pIds[7], title: 'تتبع الشحن', desc: 'نظام تتبع الطلبات وحالات الشحن', by: 1 },

    { pid: pIds[8], title: 'إدارة المستودعات', desc: 'إدارة مواقع التخزين والأرفف', by: 5 },
    { pid: pIds[8], title: 'إدارة المخزون', desc: 'متابعة كميات المخزون والحركات', by: 5 },
    { pid: pIds[8], title: 'تنبيهات المخزون', desc: 'تنبيهات عند انخفاض المخزون عن الحد الأدنى', by: 1 },
    { pid: pIds[8], title: 'تقارير المخزون', desc: 'تقارير دورية للمخزون والطلبات', by: 4 },

    { pid: pIds[9], title: 'الصفحة الرئيسية', desc: 'تصميم الصفحة الرئيسية للبوابة', by: 4 },
    { pid: pIds[9], title: 'نظام التسجيل', desc: 'تسجيل المستخدمين والتحقق من الهوية', by: 1 },
    { pid: pIds[9], title: 'الخدمات الإلكترونية', desc: 'تقديم الخدمات الحكومية إلكترونياً', by: 1 },
    { pid: pIds[9], title: 'الاستعلامات', desc: 'الاستعلام عن المعاملات والطلبات', by: 4 },

    { pid: pIds[10], title: 'واجهة المستخدم', desc: 'تصميم واجهة التطبيق', by: 4 },
    { pid: pIds[10], title: 'نظام الطلبات', desc: 'إدارة الطلبات والتوصيل', by: 4 },
    { pid: pIds[10], title: 'تتبع السائقين', desc: 'تتبع مباشر للسائقين عبر GPS', by: 1 },
    { pid: pIds[10], title: 'نظام التقييم', desc: 'تقييم السائقين والخدمة', by: 5 },

    { pid: pIds[11], title: 'التسجيل في الفعاليات', desc: 'نظام تسجيل إلكتروني للفعاليات', by: 5 },
    { pid: pIds[11], title: 'جدولة الجلسات', desc: 'جدولة جلسات الفعالية والمتحدثين', by: 5 },
    { pid: pIds[11], title: 'التذاكر الإلكترونية', desc: 'إصدار التذاكر الإلكترونية والباركود', by: 1 },
    { pid: pIds[11], title: 'لوحة إدارة الفعاليات', desc: 'لوحة تحكم لإدارة الفعاليات والمشاركين', by: 4 },
  ]

  const taskSql = 'INSERT INTO tasks (project_id, title, description, created_by, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id'
  const taskIds: number[] = []
  for (const t of taskDefs) {
    const ca = new Date(Date.now() - Math.random() * 50 * 86400000).toISOString().replace('T', ' ').slice(0, 19)
    const r = await pool.query(taskSql, [t.pid, t.title, t.desc, t.by, ca])
    taskIds.push(r.rows[0].id as number)
  }
  console.log(`✅ ${taskDefs.length} مهمة`)

  // ============================================================
  // 5. SUBTASKS (3-8 per task = ~300 subtasks)
  // ============================================================
  console.log('\n📌 بذر المهام الفرعية...')
  const now = Date.now()
  const day = 86400000
  const statusPool = ['pending', 'in_progress', 'submitted', 'approved', 'rejected'] as const
  const empPool = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]
  const subtaskTitles = [
    'تحليل المتطلبات', 'تصميم الواجهة', 'تنفيذ الخلفية', 'اختبار الوحدة',
    'توثيق الكود', 'مراجعة الأقران', 'دمج التغييرات', 'نشر الإصدار',
    'تصميم قاعدة البيانات', 'إعداد API', 'اختبار التكامل', 'تصميم التقارير',
    'إعداد الإشعارات', 'تحسين الأداء', 'تدقيق الأمان', 'تصميم الشاشة الرئيسية',
    'إدارة الجلسات', 'التحقق من المدخلات', 'معالجة الأخطاء', 'تصدير البيانات',
    'استيراد البيانات', 'إعداد الصلاحيات', 'تصميم لوحة التحكم', 'البحث والتصفية',
    'إدارة المرفقات', 'نظام النسخ الاحتياطي', 'تسجيل النشاطات', 'إعداد البريد الإلكتروني',
  ]

  let subCount = 0
  const subSql =
    'INSERT INTO subtasks (task_id, title, description, status, deadline, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id'
  const subAssigneeSql = 'INSERT INTO subtask_assignees (subtask_id, user_id, assigned_by) VALUES ($1, $2, $3)'

  for (let ti = 0; ti < taskIds.length; ti++) {
    const numSubs = 3 + Math.floor(Math.random() * 6)
    for (let si = 0; si < numSubs; si++) {
      const titleIdx = (ti * 7 + si * 3) % subtaskTitles.length
      const title = subtaskTitles[titleIdx] + ` (${Math.floor(si / 3) + 1})`
      const emp = empPool[Math.floor(Math.random() * empPool.length)]
      const r = Math.random()
      const status = r < 0.3 ? 'completed' : r < 0.5 ? 'deferred' : r < 0.7 ? 'cancelled' : 'open'
      const dlOffset = 2 + Math.floor(Math.random() * 25)
      const dl = new Date(now + dlOffset * day).toISOString().replace('T', ' ').slice(0, 19)
      const ca = new Date(now - Math.random() * 40 * day).toISOString().replace('T', ' ').slice(0, 19)
      const descText = `وصف المهمة: ${title}\nالمتطلبات:\n- تحليل الاحتياجات\n- تنفيذ المهام حسب الخطة\n- توثيق العمل المنجز`

      const result = await pool.query(subSql, [taskIds[ti], title, descText, status, dl, ca])
      subCount++
      if (Math.random() < 0.85) {
        const subId = result.rows[0].id
        await run(subAssigneeSql, subId, emp, taskDefs[ti].by)
        if (Math.random() < 0.3) {
          const secondEmp = empPool.filter(e => e !== emp)[Math.floor(Math.random() * (empPool.length - 1))]
          await run(subAssigneeSql, subId, secondEmp, taskDefs[ti].by)
        }
      }
    }
  }
  console.log(`✅ ${subCount} مهمة فرعية`)

  // ============================================================
  // 6. SAMPLE FILES (generate dummy attachments)
  // ============================================================
  console.log('\n📎 إنشاء ملفات نموذجية...')
  const allSubtasksResult = await pool.query('SELECT id, task_id FROM subtasks ORDER BY id')
  const allSubtasks = allSubtasksResult.rows as { id: number; task_id: number }[]
  const attachmentsSql =
    'INSERT INTO attachments (entity_type, entity_id, filename, original_name, mime_type, file_size, uploaded_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'

  let fileCount = 0
  const sampleFiles: { name: string; ext: string; mime: string; content: string }[] = [
    { name: 'تقرير_الاحتياجات', ext: '.txt', mime: 'text/plain', content: 'تقرير تحليل الاحتياجات للمشروع\nتم إعداد هذا التقرير بناءً على اجتماعات مع أصحاب المصلحة\nالتاريخ: 2026-04-15' },
    { name: 'تصميم_النظام', ext: '.html', mime: 'text/html', content: '<html><body style="font-family:Arial;padding:20px"><h1>تصميم النظام</h1><p>نظام إدارة المهام والمشاريع</p><svg width="400" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="200" fill="#f0f4ff" rx="10"/><text x="200" y="60" text-anchor="middle" fill="#4f46e5" font-size="20">نظام إنجاز</text><circle cx="100" cy="120" r="15" fill="#4f46e5"/><circle cx="200" cy="120" r="15" fill="#22c55e"/><circle cx="300" cy="120" r="15" fill="#eab308"/><line x1="115" y1="120" x2="185" y2="120" stroke="#ccc" stroke-width="2"/><line x1="215" y1="120" x2="285" y2="120" stroke="#ccc" stroke-width="2"/></svg></body></html>' },
    { name: 'صورة_واجهة_المستخدم', ext: '.svg', mime: 'image/svg+xml', content: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="#f8fafc" rx="8"/><rect x="10" y="10" width="280" height="40" fill="#4f46e5" rx="4"/><circle cx="30" cy="30" r="10" fill="#fff"/><rect x="50" y="20" width="60" height="10" fill="#fff" rx="2"/><rect x="10" y="60" width="280" height="30" fill="#fff" rx="4" stroke="#e2e8f0"/><rect x="10" y="100" width="280" height="30" fill="#fff" rx="4" stroke="#e2e8f0"/><rect x="10" y="140" width="280" height="30" fill="#fff" rx="4" stroke="#e2e8f0"/></svg>' },
    { name: 'دليل_المستخدم', ext: '.txt', mime: 'text/plain', content: 'دليل استخدام نظام إنجاز\nالإصدار 1.0\n\n1. تسجيل الدخول\n2. استعراض المشاريع\n3. إدارة المهام\n4. تسليم العمل' },
    { name: 'قاعدة_بيانات', ext: '.sql', mime: 'text/plain', content: '-- هيكل قاعدة البيانات\nCREATE TABLE projects (\n  id INTEGER PRIMARY KEY,\n  title TEXT NOT NULL,\n  description TEXT,\n  created_at TIMESTAMP\n);\n\nCREATE TABLE tasks (\n  id INTEGER PRIMARY KEY,\n  project_id INTEGER REFERENCES projects(id),\n  title TEXT NOT NULL\n);' },
    { name: 'تقرير_الأداء', ext: '.html', mime: 'text/html', content: '<html><body style="font-family:Arial"><h1>تقرير أداء المشروع</h1><table border="1"><tr><th>المشروع</th><th>الإنجاز</th></tr><tr><td>نظام الفوترة</td><td>85%</td></tr><tr><td>الموقع الرسمي</td><td>60%</td></tr></table></body></html>' },
    { name: 'شعار_الشركة', ext: '.svg', mime: 'image/svg+xml', content: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="45" fill="#4f46e5"/><text x="50" y="55" text-anchor="middle" fill="#fff" font-size="30" font-weight="bold">إ</text></svg>' },
    { name: 'خريطة_الموقع', ext: '.svg', mime: 'image/svg+xml', content: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#fafafa"/><rect x="150" y="10" width="100" height="30" fill="#4f46e5" rx="5"/><text x="200" y="30" text-anchor="middle" fill="#fff" font-size="12">الرئيسية</text><line x1="200" y1="40" x2="100" y2="70" stroke="#ccc"/><line x1="200" y1="40" x2="300" y2="70" stroke="#ccc"/><rect x="40" y="70" width="120" height="30" fill="#22c55e" rx="5"/><text x="100" y="90" text-anchor="middle" fill="#fff" font-size="11">الخدمات</text><rect x="240" y="70" width="120" height="30" fill="#eab308" rx="5"/><text x="300" y="90" text-anchor="middle" fill="#fff" font-size="11">اتصل بنا</text></svg>' },
  ]

  const uploadsDir = path.join(process.cwd(), 'uploads')

  for (let i = 0; i < allSubtasks.length && fileCount < 60; i++) {
    if (Math.random() > 0.2) continue
    const st = allSubtasks[i]
    const sf = sampleFiles[Math.floor(Math.random() * sampleFiles.length)]
    const filename = `sample-${Date.now()}-${fileCount}${sf.ext}`
    const fp = path.join(uploadsDir, filename)
    try {
      fs.writeFileSync(fp, sf.content, 'utf-8')
      const ca = new Date(now - Math.random() * 30 * day).toISOString().replace('T', ' ').slice(0, 19)
      const assignee = empPool[Math.floor(Math.random() * empPool.length)]
      await run(attachmentsSql, 'subtask', st.id, filename, sf.name + sf.ext, sf.mime, Buffer.byteLength(sf.content, 'utf-8'), assignee, ca)
      fileCount++
    } catch { /* skip */ }
  }
  console.log(`✅ ${fileCount} ملف نموذجي`)

  // ============================================================
  // 7. WARNINGS (15)
  // ============================================================
  console.log('\n⚠️  بذر الإنذارات...')
  const warningTypesResult = await pool.query('SELECT id, points, name FROM warning_types')
  const warningTypes = warningTypesResult.rows as { id: number; points: number; name: string }[]
  const warningSql = `
    INSERT INTO warnings (user_id, issued_by, reason, status, response_text, responded_at, deadline, created_at, warning_type_id, points_deducted, credit_before, credit_after, warning_type_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `

  const warningData = [
    { uid: 8, issuer: 1, wt: 0, status: 'cleared', pts: 1, cb: 10, ca: 9 },
    { uid: 9, issuer: 1, wt: 2, status: 'responded', pts: 2, cb: 10, ca: 8 },
    { uid: 10, issuer: 5, wt: 5, status: 'pending', pts: 3, cb: 10, ca: 7 },
    { uid: 11, issuer: 1, wt: 1, status: 'sustained', pts: 2, cb: 8, ca: 6 },
    { uid: 12, issuer: 5, wt: 4, status: 'pending', pts: 4, cb: 9, ca: 5 },
    { uid: 13, issuer: 1, wt: 3, status: 'cleared', pts: 3, cb: 8, ca: 5 },
    { uid: 16, issuer: 5, wt: 0, status: 'ignored', pts: 1, cb: 9, ca: 8 },
    { uid: 18, issuer: 1, wt: 2, status: 'responded', pts: 2, cb: 9, ca: 7 },
    { uid: 8, issuer: 5, wt: 6, status: 'cleared', pts: 1, cb: 10, ca: 9 },
    { uid: 20, issuer: 1, wt: 5, status: 'pending', pts: 3, cb: 10, ca: 7 },
    { uid: 10, issuer: 4, wt: 1, status: 'cleared', pts: 2, cb: 9, ca: 7 },
    { uid: 9, issuer: 1, wt: 7, status: 'sustained', pts: 5, cb: 8, ca: 3 },
    { uid: 12, issuer: 4, wt: 3, status: 'cleared', pts: 3, cb: 8, ca: 5 },
    { uid: 16, issuer: 5, wt: 4, status: 'responded', pts: 4, cb: 8, ca: 4 },
    { uid: 18, issuer: 1, wt: 0, status: 'cleared', pts: 1, cb: 9, ca: 8 },
  ]

  for (const w of warningData) {
    const wt = warningTypes[w.wt]
    const daysAgo = Math.floor(Math.random() * 30)
    const created = new Date(now - daysAgo * day).toISOString().replace('T', ' ').slice(0, 19)
    const deadline = new Date(now + 3 * day).toISOString().replace('T', ' ').slice(0, 19)
    const reasons = ['تأخر عن العمل بدون عذر', 'عدم إنجاز المهام في الوقت المحدد', 'تسليم أعمال غير مكتملة', 'الغياب بدون إذن رسمي', 'عدم الالتزام بتعليمات السلامة']
    const reason = wt.name + ' - ' + reasons[w.uid % reasons.length]
    await run(
      warningSql, w.uid, w.issuer, reason, w.status,
      w.status !== 'pending' ? 'أتقدم باعتذاري، سأعمل على تحسين أدائي في الفترة القادمة.' : null,
      w.status !== 'pending' ? new Date(now - daysAgo * day + 3600000).toISOString().replace('T', ' ').slice(0, 19) : null,
      deadline, created, wt.id, w.pts, w.cb, w.ca, wt.name
    )
  }
  console.log(`✅ ${warningData.length} إنذار`)

  // ============================================================
  // 8. COMMENTS (40)
  // ============================================================
  console.log('\n💬 بذر التعليقات...')
  const allSubsResult = await pool.query('SELECT id FROM subtasks ORDER BY id')
  const allSubs = allSubsResult.rows as { id: number }[]
  const commentTexts = [
    'تم الانتهاء من المهمة بنجاح. يرجى مراجعة المخرجات.',
    'ممتاز، العمل جيد. يرجى المتابعة للخطوة التالية.',
    'هل يمكن توضيح المتطلبات أكثر؟ هناك بعض النقاط غير واضحة.',
    'بدأت في التنفيذ. سأرفع تقرير المرحلة الأولى قريباً.',
    'يرجى مراجعة الملاحظات وإعادة التسليم.',
    'تم تحديث الكود بناءً على الملاحظات. جاهز للمراجعة.',
    'شكراً على الجهود. النتيجة ممتازة.',
    'واجهت بعض التحديات التقنية. أحتاج دعماً إضافياً.',
    'تم حل المشكلة بعد التنسيق مع فريق التقنية.',
    'الرجاء التأكد من توثيق العمل قبل الإغلاق.',
  ]
  const commentSql = 'INSERT INTO comments (subtask_id, user_id, content, created_at) VALUES ($1, $2, $3, $4)'

  let commentCount = 0
  for (let i = 0; i < allSubs.length && commentCount < 40; i++) {
    if (Math.random() > 0.15) continue
    const numComments = 1 + Math.floor(Math.random() * 3)
    for (let ci = 0; ci < numComments && commentCount < 40; ci++) {
      const st = allSubs[i]
      const user = empPool[Math.floor(Math.random() * empPool.length)]
      const ct = commentTexts[Math.floor(Math.random() * commentTexts.length)]
      const ca = new Date(now - Math.random() * 20 * day).toISOString().replace('T', ' ').slice(0, 19)
      await run(commentSql, st.id, user, ct, ca)
      commentCount++
    }
  }
  console.log(`✅ ${commentCount} تعليق`)

  // ============================================================
  // 9. Summary
  // ============================================================
  const cnt = async (table: string) => {
    const result = await pool.query(`SELECT COUNT(*) as c FROM ${table}`)
    return Number(result.rows[0].c)
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 ملخص قاعدة البيانات:')
  console.log('='.repeat(50))
  console.log(`   المستخدمين:          ${await cnt('users')}`)
  console.log(`   المشاريع:            ${await cnt('projects')}`)
  console.log(`   المهام:              ${await cnt('tasks')}`)
  console.log(`   المهام الفرعية:      ${await cnt('subtasks')}`)
  console.log(`   الإنذارات:           ${await cnt('warnings')}`)
  console.log(`   التعليقات:           ${await cnt('comments')}`)
  console.log(`   المرفقات:            ${await cnt('attachments')}`)
  console.log(`   الإشعارات:           ${await cnt('notifications')}`)
  console.log(`   أنواع الإنذارات:     ${await cnt('warning_types')}`)
  console.log(`   مستويات التقييد:     ${await cnt('restriction_levels')}`)
  console.log(`   الصلاحيات:           ${await cnt('permissions')}`)
  console.log(`   أنواع الإشعارات:     ${await cnt('notification_types')}`)
  console.log('='.repeat(50))
  console.log('\n🎉 تمت بذر البيانات بنجاح!')
  console.log('\n🔑 حسابات الدخول (كلمة المرور: [الاسم]123@ingaz.com):')
  console.log('   مدير:    admin@ingaz.com / admin123')
  console.log('   نائب:    deputy@ingaz.com / deputy123')
  console.log('   موظف:    emp@ingaz.com / emp123')
  console.log('   جميع الموظفين: [الاسم]@ingaz.com / [الاسم]123')
  console.log('   (مثال: mohamed@ingaz.com / mohamed123)')
}

main().catch(e => { console.error('❌ فشل البذر:', e); process.exit(1) })
