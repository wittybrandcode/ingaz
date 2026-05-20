import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { eq, inArray } from 'drizzle-orm'
import { getDb, closePool, schema } from './db/index.js'
import { ROLES } from './constants.js'

async function main() {
  const db = getDb()

  await db.insert(schema.roles).values([
    { id: ROLES.ADMIN, name: 'Admin' },
    { id: ROLES.DEPUTY, name: 'Deputy' },
    { id: ROLES.EMPLOYEE, name: 'Employee' },
  ]).onConflictDoNothing()
  console.log('Seeded: roles (Admin, Deputy, Employee)')

  const existing = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, 'admin@ingaz.com')).limit(1)
  if (existing.length === 0) {
    await db.insert(schema.users).values([
      { name: 'المدير العام', email: 'admin@ingaz.com', password: await bcrypt.hash('admin123', 10), roleId: ROLES.ADMIN },
      { name: 'نائب المدير', email: 'deputy@ingaz.com', password: await bcrypt.hash('deputy123', 10), roleId: ROLES.DEPUTY },
      { name: 'موظف', email: 'emp@ingaz.com', password: await bcrypt.hash('emp123', 10), roleId: ROLES.EMPLOYEE },
    ])
    console.log('Seeded: admin@ingaz.com / admin123')
    console.log('Seeded: deputy@ingaz.com / deputy123')
    console.log('Seeded: emp@ingaz.com / emp123')
  } else {
    console.log('Database already has users.')
  }

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
    ['subtasks.complete', 'ترشيح فائز في مهمة فرعية', 'المهام الفرعية', 5],
    ['subtasks.cancel', 'إلغاء مهمة فرعية', 'المهام الفرعية', 8],
    ['subtasks.defer', 'تأجيل مهمة فرعية', 'المهام الفرعية', 9],
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

  for (const [key, name, group, sort] of permissions) {
    await db.insert(schema.permissions).values({ key, name, groupName: group, sortOrder: sort }).onConflictDoNothing()
  }

  const notifTypes = [
    ['project_created', 'مشاريع', 'إنشاء مشروع', 'عند إنشاء مشروع جديد', 1],
    ['project_updated', 'مشاريع', 'تعديل مشروع', 'عند تعديل مشروع', 1],
    ['project_archived', 'مشاريع', 'أرشفة مشروع', 'عند أرشفة مشروع', 1],
    ['project_deleted', 'مشاريع', 'حذف مشروع', 'عند حذف مشروع', 1],
    ['project_completed', 'مشاريع', 'اكتمال مشروع', 'عند اكتمال كل مهام المشروع', 1],
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
  for (const [typeKey, typeGroup, name, description, defaultEnabled] of notifTypes) {
    await db.insert(schema.notificationTypes).values({ typeKey, typeGroup, name, description, defaultEnabled }).onConflictDoNothing()
  }

  const allPerms = await db.select({ id: schema.permissions.id, key: schema.permissions.key }).from(schema.permissions)

  for (const p of allPerms) {
    await db.insert(schema.rolePermissions).values({ roleId: ROLES.ADMIN, permissionId: p.id }).onConflictDoNothing()
  }

  const deputyExcluded = ['users.', 'roles.', 'projects.delete', 'projects.archive']
  for (const p of allPerms) {
    if (!deputyExcluded.some(ex => p.key.startsWith(ex))) {
      await db.insert(schema.rolePermissions).values({ roleId: ROLES.DEPUTY, permissionId: p.id }).onConflictDoNothing()
    }
  }

  const employeeOnly = ['projects.view', 'tasks.view', 'subtasks.view', 'tasks.create', 'tasks.edit', 'subtasks.create', 'comments.create']
  for (const p of allPerms) {
    if (employeeOnly.some(k => p.key === k)) {
      await db.insert(schema.rolePermissions).values({ roleId: ROLES.EMPLOYEE, permissionId: p.id }).onConflictDoNothing()
    }
  }

  console.log('Seed complete.')
  await closePool()
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
