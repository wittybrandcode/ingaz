import { pgTable, serial, integer, text, timestamp, varchar, uniqueIndex, index, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
})

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
  check('users_status_check', sql`${table.status} IN ('active', 'inactive', 'archived')`),
])

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('projects_status_check', sql`${table.status} IN ('active', 'completed', 'archived')`),
  index('idx_projects_status').on(table.status),
])

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('tasks_status_check', sql`${table.status} IN ('active', 'open', 'in_progress', 'completed')`),
  index('idx_tasks_project').on(table.projectId),
])

export const subtasks = pgTable('subtasks', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  assignedTo: integer('assigned_to').references(() => users.id),
  status: text('status').default('open'),
  deadline: timestamp('deadline'),
  winnerCommentId: integer('winner_comment_id').references((): any => comments.id),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  check('subtasks_status_check',
    sql`${table.status} IN ('open', 'in_progress', 'submitted', 'approved', 'rejected', 'completed', 'cancelled', 'deferred')`),
  index('idx_subtasks_task').on(table.taskId),
  index('idx_subtasks_assigned').on(table.assignedTo),
])

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

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  index('idx_activity_logs_user_created').on(table.userId, table.createdAt),
])

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  subtaskId: integer('subtask_id').references(() => subtasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isWinner: integer('is_winner').default(0),
  winnerSelectedAt: timestamp('winner_selected_at'),
  winnerSelectedBy: integer('winner_selected_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  index('idx_comments_subtask').on(table.subtaskId),
  index('idx_comments_user').on(table.userId),
])

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

export const warningTypes = pgTable('warning_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  points: integer('points').default(1),
  isActive: integer('is_active').default(1),
  createdAt: timestamp('created_at').defaultNow(),
})

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

export const tokenBlacklist = pgTable('token_blacklist', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, table => [
  index('idx_token_blacklist_expires').on(table.expiresAt),
])

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
