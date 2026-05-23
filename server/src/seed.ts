import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { eq, inArray } from 'drizzle-orm'
import { getDb, closePool, schema } from './db/index.js'

const PERMISSIONS: [key: string, name: string, group: string, sort: number][] = [
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
  ['subtasks.submit', 'تسليم مهمة فرعية', 'المهام الفرعية', 6],
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

async function main() {
  const db = getDb()

  // Transition cleanup: remove old role_permissions for Admin/Deputy/Employee
  const oldRoleNames = ['Admin', 'Deputy', 'Employee']
  const oldRoles = await db.select({ id: schema.roles.id, name: schema.roles.name }).from(schema.roles).where(inArray(schema.roles.name, oldRoleNames))
  for (const r of oldRoles) {
    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, r.id))
    await db.delete(schema.roles).where(eq(schema.roles.id, r.id))
  }
  if (oldRoles.length > 0) console.log(`Cleaned up old roles: ${oldRoles.map((r: { name: string }) => r.name).join(', ')}`)

  // Set admin@ingaz.com as manager, remove role
  const existingAdmin = await db.select({ id: schema.users.id, roleId: schema.users.roleId }).from(schema.users).where(eq(schema.users.email, 'admin@ingaz.com')).limit(1)
  if (existingAdmin.length > 0) {
    await db.update(schema.users).set({ isManager: 1, roleId: null }).where(eq(schema.users.email, 'admin@ingaz.com'))
    console.log('Updated: admin@ingaz.com → manager')
  } else {
    await db.insert(schema.users).values({
      name: 'المدير العام',
      email: 'admin@ingaz.com',
      password: await bcrypt.hash('admin123', 10),
      isManager: 1,
    })
    console.log('Seeded: admin@ingaz.com / admin123 (manager)')
  }

  // Remove deputy@ingaz.com (no longer exists in new system)
  await db.delete(schema.users).where(eq(schema.users.email, 'deputy@ingaz.com'))
  console.log('Removed: deputy@ingaz.com')

  // Seed permissions
  for (const [key, name, group, sort] of PERMISSIONS) {
    await db.insert(schema.permissions).values({ key, name, groupName: group, sortOrder: sort }).onConflictDoNothing()
  }
  console.log(`Seeded: ${PERMISSIONS.length} permissions`)

  // Seed notification types
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
  console.log(`Seeded: ${notifTypes.length} notification types`)

  // Seed restriction levels
  const levels = [
    { name: 'excellent', nameAr: 'ممتاز', minScore: 8, color: '#22c55e', icon: 'CheckCircle2', showBanner: 0, canLogin: 1, canCreateProjects: 1, canCreateTasks: 1, canEdit: 1, canAssign: 1, canSubmit: 1, canComment: 1, sortOrder: 1 },
    { name: 'warning', nameAr: 'تنبيه', minScore: 5, color: '#eab308', icon: 'AlertTriangle', showBanner: 1, canLogin: 1, canCreateProjects: 1, canCreateTasks: 1, canEdit: 1, canAssign: 1, canSubmit: 1, canComment: 1, sortOrder: 2 },
    { name: 'restricted', nameAr: 'مقيد', minScore: 3, color: '#f97316', icon: 'Lock', showBanner: 1, canLogin: 1, canCreateProjects: 0, canCreateTasks: 0, canEdit: 0, canAssign: 0, canSubmit: 1, canComment: 1, sortOrder: 3 },
    { name: 'frozen', nameAr: 'مجمد', minScore: 0, color: '#ef4444', icon: 'Snowflake', showBanner: 0, canLogin: 0, canCreateProjects: 0, canCreateTasks: 0, canEdit: 0, canAssign: 0, canSubmit: 0, canComment: 0, sortOrder: 4 },
  ]
  for (const l of levels) {
    await db.insert(schema.restrictionLevels).values(l).onConflictDoNothing()
  }
  console.log(`Seeded: ${levels.length} restriction levels`)

  // Seed warning types
  const wtData = [
    { name: 'تأخير عن العمل', description: 'التأخر عن وقت الدوام أو الحضور متأخراً', points: 1, isActive: 1 },
    { name: 'تقصير في المهام', description: 'عدم إنجاز المهام المسندة بالجودة المطلوبة', points: 2, isActive: 1 },
    { name: 'عدم التزام بالمواعيد', description: 'تجاوز المواعيد النهائية للمهام', points: 2, isActive: 1 },
    { name: 'إهمال متكرر', description: 'تكرار الإهمال في أداء المهام', points: 3, isActive: 1 },
    { name: 'مخالفة تعليمات العمل', description: 'عدم اتباع الأنظمة والتعليمات', points: 4, isActive: 1 },
    { name: 'غياب بدون إذن', description: 'الغياب عن العمل دون تصريح مسبق', points: 3, isActive: 1 },
    { name: 'تسليم أعمال غير مكتملة', description: 'تسليم مهام غير كاملة أو ناقصة', points: 1, isActive: 1 },
    { name: 'سلوك غير لائق', description: 'سلوك غير مهني مع الزملاء أو المدراء', points: 5, isActive: 1 },
  ]
  for (const w of wtData) {
    await db.insert(schema.warningTypes).values(w).onConflictDoNothing()
  }
  console.log(`Seeded: ${wtData.length} warning types`)

  // Create 2 default roles
  const allPerms = await db.select({ id: schema.permissions.id, key: schema.permissions.key }).from(schema.permissions)
  const permMap = new Map(allPerms.map((p: { key: string; id: number }) => [p.key, p.id]))

  // Role 1: مشارك (Participant) — basic view + create
  const participantRole = await db.insert(schema.roles).values({ name: 'مشارك' }).onConflictDoNothing().returning()
  const participantRoleId = participantRole.length > 0 ? participantRole[0].id : (await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.name, 'مشارك')).limit(1))[0].id

  const participantPerms = ['projects.view', 'tasks.view', 'subtasks.view', 'tasks.create', 'tasks.edit', 'subtasks.create', 'subtasks.submit', 'comments.create']
  for (const key of participantPerms) {
    const pid = permMap.get(key)
    if (pid) await db.insert(schema.rolePermissions).values({ roleId: participantRoleId, permissionId: pid }).onConflictDoNothing()
  }
  console.log('Seeded: role "مشارك"')

  // Role 2: مساهم (Contributor) — most except admin-level
  const contributorRole = await db.insert(schema.roles).values({ name: 'مساهم' }).onConflictDoNothing().returning()
  const contributorRoleId = contributorRole.length > 0 ? contributorRole[0].id : (await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.name, 'مساهم')).limit(1))[0].id

  const contributorPerms = ['users.view', 'roles.view', 'projects.delete', 'projects.archive', 'users.delete', 'roles.delete', 'users.create', 'roles.create']
  for (const p of allPerms) {
    if (!contributorPerms.some(ex => p.key === ex)) {
      await db.insert(schema.rolePermissions).values({ roleId: contributorRoleId, permissionId: p.id }).onConflictDoNothing()
    }
  }
  console.log('Seeded: role "مساهم"')

  // Create/update test user with مشارك role
  const existingEmp = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, 'emp@ingaz.com')).limit(1)
  if (existingEmp.length === 0) {
    await db.insert(schema.users).values({
      name: 'موظف اختبار',
      email: 'emp@ingaz.com',
      password: await bcrypt.hash('emp123', 10),
      roleId: participantRoleId,
      isManager: 0,
    })
    console.log('Seeded: emp@ingaz.com / emp123 (role: مشارك)')
  } else {
    await db.update(schema.users).set({ roleId: participantRoleId, isManager: 0 }).where(eq(schema.users.email, 'emp@ingaz.com'))
    console.log('Updated: emp@ingaz.com → role: مشارك')
  }

  console.log('Seed complete.')
  await closePool()
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
