# خطة الانتقال إلى PostgreSQL + Drizzle ORM

> **الهدف:** استبدال SQLite (`better-sqlite3`) بـ PostgreSQL عبر Drizzle ORM للوصول إلى بنية إنتاجية احترافية تسهّل التوسع والانتقال للإنترنت.

---

## فهرس

1. [لماذا PostgreSQL + Drizzle؟](#1-لماذا-postgresql--drizzle)
2. [المعمارية الجديدة](#2-المعماريةالجديدة)
3. [خطوات التنفيذ التفصيلية](#3-خطواتالتنفيذالتفصيلية)
   - 3.1 [تثبيت الحزم](#31-تثبيتالحزم)
   - 3.2 [إنشاء schema.ts — مصدر الحقيقة](#32-إنشاء-schemats--مصدرالحقيقة)
   - 3.3 [إنشاء Drizzle client](#33-إنشاء-drizzle-client)
   - 3.4 [إعداد drizzle.config.ts](#34-إعداد-drizzleconfigts)
   - 3.5 [تحديث BaseService.ts](#35-تحديث-baseservicets)
   - 3.6 [تحديث الـ Services (11 ملفاً)](#36-تحديثالـ-services-11ملفاً)
   - 3.7 [تحديث middleware/auth.ts و notify.ts](#37-تحديث-middlewareauthts-و-notifyts)
   - 3.8 [تحديث server/src/index.ts](#38-تحديث-server-src-indexts)
   - 3.9 [تحديث الاختبارات](#39-تحديثالاختبارات)
4. [خريطة الانتقال (Migration Map)](#4-خريطةالانتقال-migration-map)
5. [أمثلة: SQLite raw → Drizzle API](#5-أمثلة-sqlite-raw--drizzle-api)
6. [الجدول الزمني](#6-الجدولالزمني)
7. [ماذا بعد؟](#7-ماذابعد)

---

## 1. لماذا PostgreSQL + Drizzle؟

| المقارنة | SQLite (حالياً) | PostgreSQL + Drizzle |
|-----------|----------------|----------------------|
| **النوع** | Embedded (ملف واحد) | Client-Server (سيرفر مستقل) |
| **المنتجية** | غير صالح للإنتاج | جاهز للإنتاج |
| **الـ Concurrency** | يسمح بكاتب واحد فقط | مئات الآلاف من الاتصالات المتزامنة |
| **أنواع البيانات** | TEXT, INTEGER, REAL, BLOB فقط | ARRAY, JSON, UUID, ENUM, VARCHAR(n)... |
| **نظام الترحيل** | غير موجود (CREATE IF NOT EXISTS) | Drizzle Kit — generates, tracks, rolls back |
| **نقل لـ MySQL/أخرى** | يحتاج إعادة كتابة كل SQL | تغيير drizzle driver فقط |
| **Type Safety** | `as any` لكل استعلام | استنتاج تلقائي للأنواع من schema |
| **الأدوات** | لا يوجد | pgAdmin + Drizzle Studio + Drizzle Kit |

Drizzle ORM هو **ليس مجرد ORM تقليدي** — هو طبقة TypeScript فوق SQL:
- لا يخفي SQL منك (عكس Prisma/TypeORM)
- كل query تكتب بـ TypeScript وتترجم إلى SQL محسّن
- يدعم **SQLite و PostgreSQL و MySQL** بنفس الـ API بالضبط

---

## 2. المعمارية الجديدة

### قبل (حالياً)

```
routes/*.ts
  → services/*.ts (extends BaseService)
    → db.prepare('SELECT ...').all()     ← SQL خام
    → isProjectManager(), notifyUser()    ← دوال تستورد db.ts مباشرة
      → db.ts (متغير وحيد: const db = new Database(...))
        → SQLite (ingaz.db)
```

### بعد (PostgreSQL + Drizzle)

```
routes/*.ts
  → services/*.ts (extends BaseService)
    → this.db.select().from(table).where(...)   ← Drizzle API
    → db.select().from(projectMembers)           ← استيراد دقيق
      → db/index.ts (Drizzle client)
        → drizzle(pool) → Pool (pg)
          → PostgreSQL (localhost:5432/ingaz)
```

### هيكل الملفات الجديد

```
server/src/db/
├── index.ts          # Drizzle client + re-exports
└── schema.ts         # كل تعريفات الجداول (pgTable)

server/drizzle/
├── meta/             # بيانات التعقب ( drizzle-kit)
└── 0000_initial.sql  # أول migration مولّد تلقائياً

server/drizzle.config.ts   # إعدادات drizzle-kit
server/.env                # DATABASE_URL
```

---

## 3. خطوات التنفيذ التفصيلية

### 3.1 تثبيت الحزم

```bash
cd server

# Drizzle ORM + PostgreSQL driver
npm install drizzle-orm pg dotenv

# أدوات التطوير
npm install --save-dev drizzle-kit @types/pg
```

**شرح الحزم:**
| الحزمة | الدور |
|--------|-------|
| `drizzle-orm` | ORM الأساسي — يوفر `drizzle()`, `pgTable()`, `eq()`, `sql`, إلخ |
| `pg` | driver PostgreSQL الرسمي لـ Node.js |
| `drizzle-kit` | أداة CLI — توليد migrations, push, studio |
| `dotenv` | قراءة `.env` |
| `@types/pg` | أنواع TypeScript لـ pg |

### 3.2 إنشاء schema.ts — مصدر الحقيقة

**الملف:** `server/src/db/schema.ts`

هذا الملف هو **المصدر الوحيد** لكل الجداول. سنستخدم `pgTable` من Drizzle.

```typescript
import { pgTable, serial, integer, text, timestamp, varchar, uniqueIndex, index, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ── الأدوار ─────────────────────────────────────
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
})

// ── المستخدمين ──────────────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'set null' }),
  avatar: text('avatar'),
  status: text('status').default('active'),
  creditScore: integer('credit_score').default(10),
  frozenAt: timestamp('frozen_at'),
  freezeReason: text('freeze_reason'),
  unfrozenAt: timestamp('unfrozen_at'),
  lastCreditRecovery: timestamp('last_credit_recovery'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('users_status_check', sql`${table.status} IN ('active', 'inactive')`),
])

// ── المشاريع ────────────────────────────────────
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('projects_status_check', sql`${table.status} IN ('active', 'archived')`),
  index('idx_projects_status').on(table.status),
])

// ── المهام ──────────────────────────────────────
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('tasks_status_check', sql`${table.status} IN ('active', 'archived')`),
  index('idx_tasks_project').on(table.projectId),
])

// ── المهام الفرعية ──────────────────────────────
export const subtasks = pgTable('subtasks', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  assignedTo: integer('assigned_to').references(() => users.id),
  status: text('status').default('pending'),
  deadline: timestamp('deadline'),
  submissionText: text('submission_text'),
  submissionLink: text('submission_link'),
  managerNotes: text('manager_notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('subtasks_status_check',
    sql`${table.status} IN ('pending', 'in_progress', 'submitted', 'approved', 'rejected')`),
  index('idx_subtasks_task').on(table.taskId),
  index('idx_subtasks_assigned').on(table.assignedTo),
])

// ── أعضاء المشروع ───────────────────────────────
export const projectMembers = pgTable('project_members', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').default('manager'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  uniqueIndex('uq_project_members').on(table.projectId, table.userId),
  check('project_members_role_check', sql`${table.role} IN ('manager', 'member')`),
  index('idx_project_members_user').on(table.userId),
])

// ── المسؤولون عن المهام ─────────────────────────
export const taskAssignees = pgTable('task_assignees', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedBy: integer('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  uniqueIndex('uq_task_assignees').on(table.taskId, table.userId),
  index('idx_task_assignees_task').on(table.taskId),
  index('idx_task_assignees_user').on(table.userId),
])

// ── المسؤولون عن المهام الفرعية ──────────────────
export const subtaskAssignees = pgTable('subtask_assignees', {
  id: serial('id').primaryKey(),
  subtaskId: integer('subtask_id').notNull().references(() => subtasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedBy: integer('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  uniqueIndex('uq_subtask_assignees').on(table.subtaskId, table.userId),
  index('idx_subtask_assignees_subtask').on(table.subtaskId),
  index('idx_subtask_assignees_user').on(table.userId),
])

// ── الإشعارات ────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message'),
  type: text('type').default('info'),
  read: integer('read').default(0),
  relatedType: text('related_type'),
  relatedId: integer('related_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  index('idx_notifications_user_read').on(table.userId, table.read),
  index('idx_notifications_created').on(table.createdAt),
  index('idx_notifications_user_created').on(table.userId, table.createdAt),
])

// ── سجل النشاطات ─────────────────────────────────
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  index('idx_activity_logs_user_created').on(table.userId, table.createdAt),
])

// ── التعليقات ────────────────────────────────────
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  subtaskId: integer('subtask_id').references(() => subtasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  index('idx_comments_subtask').on(table.subtaskId),
  index('idx_comments_user').on(table.userId),
])

// ── المرفقات ─────────────────────────────────────
export const attachments = pgTable('attachments', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('attachments_entity_type_check',
    sql`${table.entityType} IN ('project', 'task', 'subtask')`),
  index('idx_attachments_entity').on(table.entityType, table.entityId),
  index('idx_attachments_uploaded_by').on(table.uploadedBy),
])

// ── الإنذارات ────────────────────────────────────
export const warnings = pgTable('warnings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  issuedBy: integer('issued_by').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason').notNull(),
  status: text('status').default('pending'),
  responseText: text('response_text'),
  respondedAt: timestamp('responded_at'),
  clearedBy: integer('cleared_by').references(() => users.id),
  clearedAt: timestamp('cleared_at'),
  deadline: timestamp('deadline').notNull(),
  warningTypeId: integer('warning_type_id').references(() => warningTypes.id),
  pointsDeducted: integer('points_deducted').default(1),
  creditBefore: integer('credit_before').default(10),
  creditAfter: integer('credit_after').default(10),
  warningTypeName: text('warning_type_name'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('warnings_status_check',
    sql`${table.status} IN ('pending', 'responded', 'cleared', 'sustained', 'ignored')`),
  index('idx_warnings_user').on(table.userId),
  index('idx_warnings_status').on(table.status),
  index('idx_warnings_deadline').on(table.deadline),
  index('idx_warnings_user_created').on(table.userId, table.createdAt),
])

// ── أنواع الإنذارات ──────────────────────────────
export const warningTypes = pgTable('warning_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  points: integer('points').default(1),
  isActive: integer('is_active').default(1),
  createdAt: timestamp('created_at').defaultNow(),
})

// ── مستويات التقييد ──────────────────────────────
export const restrictionLevels = pgTable('restriction_levels', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  nameAr: text('name_ar').notNull(),
  minScore: integer('min_score').default(0),
  color: text('color').default('#22c55e'),
  icon: text('icon').default('CheckCircle2'),
  showBanner: integer('show_banner').default(0),
  canLogin: integer('can_login').default(1),
  canCreateProjects: integer('can_create_projects').default(1),
  canCreateTasks: integer('can_create_tasks').default(1),
  canEdit: integer('can_edit').default(1),
  canAssign: integer('can_assign').default(1),
  canSubmit: integer('can_submit').default(1),
  canComment: integer('can_comment').default(1),
  sortOrder: integer('sort_order').default(0),
})

// ── الصلاحيات ────────────────────────────────────
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  groupName: text('group_name').notNull(),
  sortOrder: integer('sort_order').default(0),
})

export const rolePermissions = pgTable('role_permissions', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id').references(() => permissions.id, { onDelete: 'cascade' }),
}, table => [
  uniqueIndex('uq_role_permissions').on(table.roleId, table.permissionId),
  index('idx_role_permissions_role').on(table.roleId),
])

// ── تفضيلات الإشعارات ────────────────────────────
export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  notificationType: text('notification_type').notNull(),
  channels: text('channels').default('["in_app"]'),
  enabled: integer('enabled').default(1),
}, table => [
  uniqueIndex('uq_notification_prefs').on(table.userId, table.notificationType),
  index('idx_notif_prefs_user').on(table.userId),
])

export const notificationTypes = pgTable('notification_types', {
  id: serial('id').primaryKey(),
  typeKey: text('type_key').notNull().unique(),
  typeGroup: text('type_group').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  defaultEnabled: integer('default_enabled').default(1),
})

// ── القائمة السوداء للتوكنات ─────────────────────
export const tokenBlacklist = pgTable('token_blacklist', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  index('idx_token_blacklist_expires').on(table.expiresAt),
])

// ── تذكيرات المواعيد النهائية ─────────────────────
export const deadlineReminders = pgTable('deadline_reminders', {
  id: serial('id').primaryKey(),
  subtaskId: integer('subtask_id').references(() => subtasks.id, { onDelete: 'cascade' }),
  reminderType: text('reminder_type').notNull(),
  sent: integer('sent').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  uniqueIndex('uq_deadline_reminders').on(table.subtaskId, table.reminderType),
  check('deadline_reminders_type_check',
    sql`${table.reminderType} IN ('24h', '6h', 'overdue')`),
])
```

### 3.3 إنشاء Drizzle client

**الملف:** `server/src/db/index.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
})

export const db = drizzle(pool, { schema })
export { schema }

// ── دوال مساعدة (بديل دوال db.ts) ────────────────
export function isProjectManager(userId: number, projectId: number): boolean {
  return !!db
    .select()
    .from(schema.projectMembers)
    .where(
      sql`${schema.projectMembers.projectId} = ${projectId}
        AND ${schema.projectMembers.userId} = ${userId}
        AND ${schema.projectMembers.role} = 'manager'`
    )
    .limit(1)
}

export async function addActivityLog(userId: number, action: string, details: string | null = null) {
  await db.insert(schema.activityLogs).values({ userId, action, details })
}
```

### 3.4 إعداد drizzle.config.ts

**الملف:** `server/drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
})
```

**إضافة scripts إلى `server/package.json`:**

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 3.5 تحديث BaseService.ts

**الملف:** `server/src/services/BaseService.ts`

```typescript
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '../db/schema.js'

export class AppError extends Error {
  statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
  }
}

export interface ServiceContext {
  userId: number
  roleId: number
  userName?: string
  userAvatar?: string | null
  io?: import('socket.io').Server | null
}

export class BaseService {
  db: NodePgDatabase<typeof schema>

  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db
  }
}
```

### 3.6 تحديث الـ Services (11 ملفاً)

**القاعدة:** كل استعلام DQL (`SELECT`) → `db.select().from(table)`, وكل استعلام DML (`INSERT/UPDATE/DELETE`) → `db.insert(table)` / `db.update(table)` / `db.delete(table)`.

#### أنماط التحويل الأساسية

| SQLite raw | Drizzle |
|------------|---------|
| `db.prepare('SELECT * FROM users WHERE id = ?').get(id)` | `db.select().from(users).where(eq(users.id, id)).limit(1)` → `rows[0]` |
| `db.prepare('SELECT * FROM users').all()` | `db.select().from(users)` |
| `db.prepare('SELECT COUNT(*) as c FROM users WHERE ...').get().c` | `db.select({ count: count() }).from(users).where(...)` |
| `db.prepare('INSERT INTO users (...) VALUES (...)').run(...)` | `db.insert(users).values({...}).returning()` |
| `db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id)` | `db.update(users).set({ name }).where(eq(users.id, id))` |
| `db.prepare('DELETE FROM users WHERE id = ?').run(id)` | `db.delete(users).where(eq(users.id, id))` |
| `result.lastInsertRowid` | `(await insert.returning()).id` |
| `result.changes` | تحقق من الـ returned rows |

#### مثال تحويل كامل (TaskService.create)

**قبل (raw better-sqlite3):**

```typescript
create(data: { project_id: number; title: string; description?: string | null }, ctx: ServiceContext) {
  if (ctx.roleId === ROLES.EMPLOYEE && !isProjectManager(ctx.userId, data.project_id)) {
    throw new AppError(403, 'لا تملك صلاحية إنشاء مهام في هذا المشروع')
  }

  const cleanTitle = sanitizeHtml(data.title, { allowedTags: [], allowedAttributes: {} })
  const result = this.db.prepare(
    'INSERT INTO tasks (project_id, title, description, created_by) VALUES (?, ?, ?, ?)'
  ).run(data.project_id, cleanTitle, cleanDesc, ctx.userId)

  const task = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid)
  // ...
}
```

**بعد (Drizzle):**

```typescript
async create(data: { project_id: number; title: string; description?: string | null }, ctx: ServiceContext) {
  if (ctx.roleId === ROLES.EMPLOYEE && !(await isProjectManager(ctx.userId, data.project_id))) {
    throw new AppError(403, 'لا تملك صلاحية إنشاء مهام في هذا المشروع')
  }

  const cleanTitle = sanitizeHtml(data.title, { allowedTags: [], allowedAttributes: {} })
  const [task] = await this.db.insert(tasks).values({
    projectId: data.project_id,
    title: cleanTitle,
    description: cleanDesc,
    createdBy: ctx.userId,
  }).returning()
  // ...
}
```

> **ملاحظة مهمة:** Drizzle API غير متزامن (`async/await`) لأن `pg` pool غير متزامن. هذا يستدعي تحديث جميع دوال services لتصبح `async` وتستخدم `await`.

### 3.7 تحديث middleware/auth.ts و notify.ts

**أمثلة التغييرات:**

```typescript
// قبل: auth.ts
import db from '../db.js'
export function hasPermission(roleId: number, permissionKey: string): boolean {
  const result = db.prepare(`
    SELECT 1 FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = ? AND p.key = ?
  `).get(roleId, permissionKey)
  return !!result
}

// بعد
import { db, schema } from '../db/index.js'
import { eq, and, sql } from 'drizzle-orm'

export async function hasPermission(roleId: number, permissionKey: string): Promise<boolean> {
  const rows = await db.select()
    .from(schema.rolePermissions)
    .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
    .where(
      and(
        eq(schema.rolePermissions.roleId, roleId),
        eq(schema.permissions.key, permissionKey)
      )
    )
    .limit(1)
  return rows.length > 0
}
```

### 3.8 تحديث server/src/index.ts

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import * as schema from './db/schema.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema })

// تشغيل الـ migrations عند بدء التشغيل
await migrate(db, { migrationsFolder: './drizzle' })
```

### 3.9 تحديث الاختبارات

**الملف:** `server/src/__tests__/helpers.ts`

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import * as schema from '../db/schema.js'

export async function createTestDb() {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  const db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
  return db
}
```

**ملاحظة:** يجب إنشاء قاعدة بيانات منفصلة للاختبارات:
```sql
CREATE DATABASE ingaz_test;
```

وإضافتها في `.env.test`:
```
TEST_DATABASE_URL=postgres://ingaz_user:azerty2025//@localhost:5432/ingaz_test
```

### تحديث vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
})
```

ملف `setup.ts` يتأكد من وجود `TEST_DATABASE_URL` ويعيد تعيين قاعدة البيانات قبل كل اختبار.

---

## 4. خريطة الانتقال (Migration Map)

```
                             ┌──────────────────┐
                             │   db/schema.ts    │
                             │  (pgTable تعريفات) │
                             └────────┬─────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
                    ▼                 ▼                  ▼
            ┌──────────────┐  ┌──────────────┐   ┌──────────────┐
            │  drizzle-kit  │  │  db/index.ts  │   │   الاختبارات   │
            │  توليد SQL    │  │  Drizzle CLI  │   │  helpers.ts   │
            └──────┬───────┘  └──────┬───────┘   └──────┬───────┘
                   │                 │                  │
                   ▼                 ▼                  ▼
           ┌──────────────┐  ┌──────────────┐   ┌──────────────┐
           │     SQL      │  │    خدمات     │   │  ingaz_test  │
           │  migrations  │  │   async DZ   │   │  PostgreSQL  │
           └──────────────┘  └──────────────┘   └──────────────┘
```

---

## 5. أمثلة: SQLite raw → Drizzle API

> **مفتاح الفهم**: كل `db.prepare(SQL).method(args)` → `db.method(table).where(...)`

### SELECT — سطر واحد

```
// SQLite
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(5)

// Drizzle
const [user] = await db.select().from(users).where(eq(users.id, 5)).limit(1)
```

### SELECT — كل السطور

```
// SQLite
const users = db.prepare('SELECT * FROM users WHERE role_id = ?').all(1)

// Drizzle
const rows = await db.select().from(users).where(eq(users.roleId, 1))
```

### SELECT — أعمدة محددة

```
// SQLite
const names = db.prepare('SELECT id, name FROM users').all()

// Drizzle
const names = await db.select({ id: users.id, name: users.name }).from(users)
```

### SELECT — COUNT

```
// SQLite
const { c } = db.prepare('SELECT COUNT(*) as c FROM users').get()

// Drizzle
const [{ count }] = await db.select({ count: count() }).from(users)
```

### INSERT — مع returning

```
// SQLite
const result = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Ali', 'a@b.com')
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)

// Drizzle
const [user] = await db.insert(users).values({ name: 'Ali', email: 'a@b.com' }).returning()
```

### UPDATE

```
// SQLite
db.prepare('UPDATE users SET name = ? WHERE id = ?').run('New Name', 5)

// Drizzle
await db.update(users).set({ name: 'New Name' }).where(eq(users.id, 5))
```

### DELETE

```
// SQLite
db.prepare('DELETE FROM users WHERE id = ?').run(5)

// Drizzle
await db.delete(users).where(eq(users.id, 5))
```

### JOIN (INNER)

```
// SQLite
const rows = db.prepare(`
  SELECT u.name, r.name as role_name
  FROM users u JOIN roles r ON u.role_id = r.id
`).all()

// Drizzle
const rows = await db.select({
  name: users.name,
  roleName: roles.name,
}).from(users)
  .innerJoin(roles, eq(users.roleId, roles.id))
```

### INSERT — دفعة

```
// SQLite
const insert = db.prepare('INSERT INTO users (name) VALUES (?)')
insert.run('Ali'); insert.run('Omar')

// Drizzle
await db.insert(users).values([{ name: 'Ali' }, { name: 'Omar' }])
```

---

## 6. الجدول الزمني

| الخطوة | المدة | الملفات المتأثرة |
|--------|-------|------------------|
| 1. تثبيت الحزم + إنشاء قاعدة البيانات | 15 د | `package.json`, `.env` |
| 2. إنشاء `schema.ts` | 1 س | `server/src/db/schema.ts` (جديد) |
| 3. إنشاء `db/index.ts` + `drizzle.config.ts` | 15 د | ملفان جديدان |
| 4. تحديث `BaseService.ts` | 10 د | `server/src/services/BaseService.ts` |
| 5. تحديث الـ Services (11 ملفاً) | 4 س | `server/src/services/*.ts` |
| 6. تحديث `middleware/auth.ts` + `notify.ts` | 1 س | ملفان |
| 7. تحديث `index.ts` + إزالة `db.ts` | 30 د | `server/src/index.ts`, `db.ts` |
| 8. توليد أول migration وتطبيقه | 10 د | `drizzle/` (جديد) |
| 9. تحديث الاختبارات | 1 س | `server/src/__tests__/*.ts` |
| 10. typecheck + إصلاح الأخطاء | 1 س | جميع الملفات |
| **المجموع** | **~9 ساعات** | **~20 ملفاً** |

---

## 7. ماذا بعد؟

بعد اكتمال الهجرة:

- `drizzle-kit studio` → واجهة رسومية لتصفح قاعدة البيانات (أفضل من pgAdmin)
- `npm run db:generate` → توليد migration جديد بعد أي تغيير في `schema.ts`
- `npm run db:migrate` → تطبيق migration على PostgreSQL
- `npm run db:push` → push مباشر للتطوير (بدون توليد ملفات SQL)

### الانتقال إلى الإنتاج (Production)

عند رفع التطبيق للإنترنت:
1. إنشاء قاعدة PostgreSQL على Render / Railway / AWS RDS
2. تغيير `DATABASE_URL` في متغيرات البيئة
3. تشغيل `npm run db:migrate`
4. التطبيق جاهز 💪

---

> **تم إعداد هذه الخطة بواسطة Ingaz Agent**
> آخر تحديث: 13 مايو 2026
