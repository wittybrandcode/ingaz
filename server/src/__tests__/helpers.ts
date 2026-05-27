import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { ROLES } from '../constants.js'
import * as testSchema from './test-schema.js'

process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests'

export function seedUser(db: any, overrides: Record<string, any> = {}) {
  const vals: Record<string, any> = {
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? `test${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com`,
    password: bcrypt.hashSync(overrides.password ?? 'password123', 10),
    roleId: overrides.role_id ?? 2,
    status: overrides.status ?? 'active',
    creditScore: overrides.credit_score ?? 10,
    frozenAt: overrides.frozen_at ?? null,
    freezeReason: overrides.freeze_reason ?? null,
    unfrozenAt: overrides.unfrozen_at ?? null,
  }
  if (overrides.id !== undefined) vals.id = overrides.id

  const result = db.insert(testSchema.users).values(vals).run()
  const id = overrides.id ?? Number(result.lastInsertRowid)

  return {
    id, name: vals.name, email: vals.email, role_id: vals.roleId,
    status: vals.status, credit_score: vals.creditScore,
    frozen_at: vals.frozenAt, freeze_reason: vals.freezeReason,
    unfrozen_at: vals.unfrozenAt,
  }
}

export function seedProject(db: any, overrides: Record<string, any> = {}) {
  const vals: Record<string, any> = {
    title: overrides.title ?? 'Test Project',
    description: overrides.description ?? 'A test project',
    createdBy: overrides.created_by ?? 1,
    status: overrides.status ?? 'active',
  }
  if (overrides.id !== undefined) vals.id = overrides.id

  const result = db.insert(testSchema.projects).values(vals).run()
  const id = overrides.id ?? Number(result.lastInsertRowid)

  return { id, title: vals.title, description: vals.description, created_by: vals.createdBy, status: vals.status }
}

export function seedTask(db: any, overrides: Record<string, any> = {}) {
  const vals: Record<string, any> = {
    projectId: overrides.project_id ?? 1,
    title: overrides.title ?? 'Test Task',
    description: overrides.description ?? 'A test task',
    createdBy: overrides.created_by ?? 1,
    status: overrides.status ?? 'active',
  }
  if (overrides.id !== undefined) vals.id = overrides.id

  const result = db.insert(testSchema.tasks).values(vals).run()
  const id = overrides.id ?? Number(result.lastInsertRowid)

  return { id, project_id: vals.projectId, title: vals.title, description: vals.description, created_by: vals.createdBy, status: vals.status }
}

export function seedSubtask(db: any, overrides: Record<string, any> = {}) {
  const vals: Record<string, any> = {
    taskId: overrides.task_id ?? 1,
    title: overrides.title ?? 'Test Subtask',
    description: overrides.description ?? null,
    assignedTo: overrides.assigned_to ?? null,
    status: overrides.status ?? 'open',
    deadline: overrides.deadline ?? null,
    winnerCommentId: overrides.winner_comment_id ?? null,
  }
  if (overrides.id !== undefined) vals.id = overrides.id

  const result = db.insert(testSchema.subtasks).values(vals).run()
  const id = overrides.id ?? Number(result.lastInsertRowid)

  return { id, task_id: vals.taskId, title: vals.title, description: vals.description, assigned_to: vals.assignedTo, status: vals.status, deadline: vals.deadline, winner_comment_id: vals.winnerCommentId }
}

export function seedProjectMember(db: any, projectId: number, userId: number) {
  db.insert(testSchema.projectMembers).values({ projectId, userId, role: 'manager' }).run()
}

export function generateToken(user: { id: number; email: string; name: string; role_id: number; avatar?: string | null; is_manager?: number }): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar: user.avatar || null, role_id: user.role_id, is_manager: user.is_manager ?? 0 },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  )
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL, is_manager INTEGER DEFAULT 0, avatar TEXT, status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')), credit_score INTEGER DEFAULT 10, frozen_at DATETIME, freeze_reason TEXT, unfrozen_at DATETIME, last_credit_recovery DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, created_by INTEGER REFERENCES users(id), status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, created_by INTEGER REFERENCES users(id), status TEXT DEFAULT 'active' CHECK(status IN ('active', 'open', 'in_progress', 'completed')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS subtasks (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, assigned_to INTEGER REFERENCES users(id), status TEXT DEFAULT 'open' CHECK(status IN ('open', 'completed', 'cancelled', 'deferred')), deadline DATETIME, winner_comment_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS project_members (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'manager' CHECK(role IN ('manager', 'member')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(project_id, user_id));
  CREATE TABLE IF NOT EXISTS task_assignees (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(task_id, user_id));
  CREATE TABLE IF NOT EXISTS subtask_assignees (id INTEGER PRIMARY KEY AUTOINCREMENT, subtask_id INTEGER NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(subtask_id, user_id));
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, from_user_id INTEGER, title TEXT NOT NULL, message TEXT, type TEXT DEFAULT 'info', read INTEGER DEFAULT 0, related_type TEXT, related_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, action TEXT NOT NULL, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, is_winner INTEGER DEFAULT 0, winner_selected_at DATETIME, winner_selected_by INTEGER REFERENCES users(id), created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL CHECK(entity_type IN ('project', 'task', 'subtask')), entity_id INTEGER NOT NULL, filename TEXT NOT NULL, original_name TEXT NOT NULL, mime_type TEXT, file_size INTEGER, uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL, reason TEXT NOT NULL, status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'responded', 'cleared', 'sustained', 'ignored')), response_text TEXT, responded_at DATETIME, cleared_by INTEGER REFERENCES users(id), cleared_at DATETIME, deadline DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, warning_type_id INTEGER REFERENCES warning_types(id), points_deducted INTEGER DEFAULT 1, credit_before INTEGER DEFAULT 10, credit_after INTEGER DEFAULT 10, warning_type_name TEXT);
  CREATE TABLE IF NOT EXISTS warning_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, points INTEGER NOT NULL DEFAULT 1, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS restriction_levels (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_ar TEXT NOT NULL, min_score INTEGER NOT NULL DEFAULT 0, color TEXT DEFAULT '#22c55e', icon TEXT DEFAULT 'CheckCircle2', show_banner INTEGER DEFAULT 0, can_login INTEGER DEFAULT 1, can_create_projects INTEGER DEFAULT 1, can_create_tasks INTEGER DEFAULT 1, can_edit INTEGER DEFAULT 1, can_assign INTEGER DEFAULT 1, can_submit INTEGER DEFAULT 1, can_comment INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, group_name TEXT NOT NULL, sort_order INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS role_permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE, permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE, UNIQUE(role_id, permission_id));
  CREATE TABLE IF NOT EXISTS notification_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, notification_type TEXT NOT NULL, channels TEXT NOT NULL DEFAULT '["in_app"]', enabled INTEGER DEFAULT 1, UNIQUE(user_id, notification_type));
  CREATE TABLE IF NOT EXISTS notification_types (id INTEGER PRIMARY KEY AUTOINCREMENT, type_key TEXT UNIQUE NOT NULL, type_group TEXT NOT NULL, name TEXT NOT NULL, description TEXT, default_enabled INTEGER DEFAULT 1);
  CREATE TABLE IF NOT EXISTS token_blacklist (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS deadline_reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE, reminder_type TEXT NOT NULL CHECK(reminder_type IN ('24h', '6h', 'overdue')), sent INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(subtask_id, reminder_type));
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
  CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
  CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_comments_subtask ON comments(subtask_id);
  CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
  CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id);
  CREATE INDEX IF NOT EXISTS idx_warnings_status ON warnings(status);
  CREATE INDEX IF NOT EXISTS idx_warnings_deadline ON warnings(deadline);
  CREATE INDEX IF NOT EXISTS idx_warnings_user_created ON warnings(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
  CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);
  CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
  CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
  CREATE INDEX IF NOT EXISTS idx_subtask_assignees_subtask ON subtask_assignees(subtask_id);
  CREATE INDEX IF NOT EXISTS idx_subtask_assignees_user ON subtask_assignees(user_id);
  CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);
`

export function createTestDb() {
  const sqliteDb = new Database(':memory:')
  sqliteDb.pragma('foreign_keys = ON')
  // Register now() function for compatibility with PG-style defaultNow()
  sqliteDb.function('now', () => new Date().toISOString())
  sqliteDb.exec(SCHEMA_SQL)

  const db = drizzle(sqliteDb)

  // Patch transaction to support async callbacks (PostgreSQL-compatible API)
  const _origTransaction = db.transaction.bind(db)
  ;(db as any).transaction = async function <T>(fn: (tx: any) => Promise<T>): Promise<T> {
    sqliteDb.exec('BEGIN')
    try {
      const result = await fn(db)
      sqliteDb.exec('COMMIT')
      return result
    } catch (e) {
      sqliteDb.exec('ROLLBACK')
      throw e
    }
  }

  db.insert(testSchema.roles).values({ id: ROLES.ADMIN, name: 'admin' }).run()
  db.insert(testSchema.roles).values({ id: 2, name: 'participant' }).run()

  db.insert(testSchema.restrictionLevels).values([
    { name: 'excellent', nameAr: 'ممتاز', minScore: 8, color: '#22c55e', icon: 'CheckCircle2', showBanner: 0, canLogin: 1, canCreateProjects: 1, canCreateTasks: 1, canEdit: 1, canAssign: 1, canSubmit: 1, canComment: 1, sortOrder: 1 },
    { name: 'warning', nameAr: 'تنبيه', minScore: 5, color: '#eab308', icon: 'AlertTriangle', showBanner: 1, canLogin: 1, canCreateProjects: 1, canCreateTasks: 1, canEdit: 1, canAssign: 1, canSubmit: 1, canComment: 1, sortOrder: 2 },
    { name: 'restricted', nameAr: 'مقيد', minScore: 3, color: '#f97316', icon: 'Lock', showBanner: 1, canLogin: 1, canCreateProjects: 0, canCreateTasks: 0, canEdit: 0, canAssign: 0, canSubmit: 1, canComment: 1, sortOrder: 3 },
    { name: 'frozen', nameAr: 'مجمد', minScore: 0, color: '#ef4444', icon: 'Snowflake', showBanner: 0, canLogin: 0, canCreateProjects: 0, canCreateTasks: 0, canEdit: 0, canAssign: 0, canSubmit: 0, canComment: 0, sortOrder: 4 },
  ]).run()

  db.insert(testSchema.warningTypes).values([
    { name: 'تأخير عن العمل', description: 'التأخر عن وقت الدوام', points: 1, isActive: 1 },
    { name: 'تقصير في المهام', description: 'عدم إنجاز المهام بالجودة المطلوبة', points: 2, isActive: 1 },
    { name: 'عدم التزام بالمواعيد', description: 'تجاوز المواعيد النهائية', points: 2, isActive: 1 },
    { name: 'إهمال متكرر', description: 'تكرار الإهمال', points: 3, isActive: 1 },
    { name: 'مخالفة تعليمات العمل', description: 'عدم اتباع الأنظمة', points: 4, isActive: 1 },
    { name: 'غياب بدون إذن', description: 'الغياب عن العمل دون تصريح', points: 3, isActive: 1 },
    { name: 'تسليم أعمال غير مكتملة', description: 'تسليم مهام ناقصة', points: 1, isActive: 1 },
    { name: 'سلوك غير لائق', description: 'سلوك غير مهني', points: 5, isActive: 1 },
  ]).run()

  db.insert(testSchema.notificationTypes).values([
    { typeKey: 'subtask_assigned', typeGroup: 'مهام فرعية', name: 'إسناد مهمة', description: 'عند إسناد مهمة فرعية لك', defaultEnabled: 1 },
    { typeKey: 'comment', typeGroup: 'تعليقات', name: 'تعليق جديد', description: 'عند إضافة تعليق على مهمتك', defaultEnabled: 1 },
    { typeKey: 'submitted', typeGroup: 'مهام فرعية', name: 'تسليم مهمة', description: 'عند تسليم مهمة للمراجعة', defaultEnabled: 1 },
    { typeKey: 'approved', typeGroup: 'مهام فرعية', name: 'قبول مهمة', description: 'عند قبول مهمتك', defaultEnabled: 1 },
    { typeKey: 'rejected', typeGroup: 'مهام فرعية', name: 'رفض مهمة', description: 'عند رفض مهمتك', defaultEnabled: 1 },
    { typeKey: 'project_created', typeGroup: 'مشاريع', name: 'إنشاء مشروع', description: 'عند إنشاء مشروع جديد', defaultEnabled: 1 },
    { typeKey: '@mention', typeGroup: 'تعليقات', name: '@إشارة', description: 'عند الإشارة إليك في تعليق', defaultEnabled: 1 },
    { typeKey: 'warning', typeGroup: 'إنذارات', name: 'إنذار جديد', description: 'عند إصدار إنذار بحقك', defaultEnabled: 1 },
    { typeKey: 'deadline_approaching_24h', typeGroup: 'مواعيد', name: 'قبل 24 ساعة', description: 'تذكير قبل الموعد النهائي', defaultEnabled: 1 },
    { typeKey: 'info', typeGroup: 'أخرى', name: 'معلومات', description: 'إشعارات عامة', defaultEnabled: 1 },
    { typeKey: 'file_uploaded', typeGroup: 'ملفات', name: 'رفع ملف', description: 'عند رفع ملف', defaultEnabled: 1 },
    { typeKey: 'user_joined', typeGroup: 'فريق', name: 'انضمام عضو', description: 'عند انضمام عضو جديد', defaultEnabled: 1 },
    { typeKey: 'role_changed', typeGroup: 'فريق', name: 'تغيير دور', description: 'عند تغيير دورك', defaultEnabled: 1 },
    { typeKey: 'new_login', typeGroup: 'أمان', name: 'تسجيل دخول', description: 'عند تسجيل الدخول', defaultEnabled: 1 },
    { typeKey: 'password_changed', typeGroup: 'أمان', name: 'تغيير كلمة المرور', description: 'عند تغيير كلمة المرور', defaultEnabled: 1 },
  ]).run()

  return db
}
