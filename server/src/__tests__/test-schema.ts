import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'set null' }),
  isManager: integer('is_manager').default(0),
  avatar: text('avatar'),
  status: text('status').default('active'),
  creditScore: integer('credit_score').default(10),
  frozenAt: text('frozen_at'),
  freezeReason: text('freeze_reason'),
  unfrozenAt: text('unfrozen_at'),
  lastCreditRecovery: text('last_credit_recovery'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  status: text('status').default('active'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_projects_status').on(table.status),
])

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  createdBy: integer('created_by').references(() => users.id),
  status: text('status').default('active'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_tasks_project').on(table.projectId),
])

export const subtasks = sqliteTable('subtasks', {
  id: integer('id').primaryKey(),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  assignedTo: integer('assigned_to').references(() => users.id),
  status: text('status').default('open'),
  deadline: text('deadline'),
  winnerCommentId: integer('winner_comment_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_subtasks_task').on(table.taskId),
  index('idx_subtasks_assigned').on(table.assignedTo),
])

export const projectMembers = sqliteTable('project_members', {
  id: integer('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').default('manager'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  uniqueIndex('uq_project_members').on(table.projectId, table.userId),
  index('idx_project_members_user').on(table.userId),
])

export const taskAssignees = sqliteTable('task_assignees', {
  id: integer('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedBy: integer('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  uniqueIndex('uq_task_assignees').on(table.taskId, table.userId),
  index('idx_task_assignees_task').on(table.taskId),
  index('idx_task_assignees_user').on(table.userId),
])

export const subtaskAssignees = sqliteTable('subtask_assignees', {
  id: integer('id').primaryKey(),
  subtaskId: integer('subtask_id').notNull().references(() => subtasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assignedBy: integer('assigned_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  uniqueIndex('uq_subtask_assignees').on(table.subtaskId, table.userId),
  index('idx_subtask_assignees_subtask').on(table.subtaskId),
  index('idx_subtask_assignees_user').on(table.userId),
])

export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  fromUserId: integer('from_user_id'),
  title: text('title').notNull(),
  message: text('message'),
  type: text('type').default('info'),
  read: integer('read').default(0),
  relatedType: text('related_type'),
  relatedId: integer('related_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_notifications_user_read').on(table.userId, table.read),
  index('idx_notifications_created').on(table.createdAt),
  index('idx_notifications_user_created').on(table.userId, table.createdAt),
])

export const activityLogs = sqliteTable('activity_logs', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_activity_logs_user_created').on(table.userId, table.createdAt),
])

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey(),
  subtaskId: integer('subtask_id').references(() => subtasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isWinner: integer('is_winner').default(0),
  winnerSelectedAt: text('winner_selected_at'),
  winnerSelectedBy: integer('winner_selected_by').references(() => users.id),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_comments_subtask').on(table.subtaskId),
  index('idx_comments_user').on(table.userId),
])

export const attachments = sqliteTable('attachments', {
  id: integer('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id').notNull(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_attachments_entity').on(table.entityType, table.entityId),
  index('idx_attachments_uploaded_by').on(table.uploadedBy),
])

export const warnings = sqliteTable('warnings', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  issuedBy: integer('issued_by').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason').notNull(),
  status: text('status').default('pending'),
  responseText: text('response_text'),
  respondedAt: text('responded_at'),
  clearedBy: integer('cleared_by').references(() => users.id),
  clearedAt: text('cleared_at'),
  deadline: text('deadline').notNull(),
  warningTypeId: integer('warning_type_id').references(() => warningTypes.id),
  pointsDeducted: integer('points_deducted').default(1),
  creditBefore: integer('credit_before').default(10),
  creditAfter: integer('credit_after').default(10),
  warningTypeName: text('warning_type_name'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_warnings_user').on(table.userId),
  index('idx_warnings_status').on(table.status),
  index('idx_warnings_deadline').on(table.deadline),
  index('idx_warnings_user_created').on(table.userId, table.createdAt),
])

export const warningTypes = sqliteTable('warning_types', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  points: integer('points').default(1),
  isActive: integer('is_active').default(1),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export const restrictionLevels = sqliteTable('restriction_levels', {
  id: integer('id').primaryKey(),
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

export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  groupName: text('group_name').notNull(),
  sortOrder: integer('sort_order').default(0),
})

export const rolePermissions = sqliteTable('role_permissions', {
  id: integer('id').primaryKey(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id').references(() => permissions.id, { onDelete: 'cascade' }),
}, table => [
  uniqueIndex('uq_role_permissions').on(table.roleId, table.permissionId),
  index('idx_role_permissions_role').on(table.roleId),
])

export const notificationPreferences = sqliteTable('notification_preferences', {
  id: integer('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  notificationType: text('notification_type').notNull(),
  channels: text('channels').default('["in_app"]'),
  enabled: integer('enabled').default(1),
}, table => [
  uniqueIndex('uq_notification_prefs').on(table.userId, table.notificationType),
  index('idx_notif_prefs_user').on(table.userId),
])

export const notificationTypes = sqliteTable('notification_types', {
  id: integer('id').primaryKey(),
  typeKey: text('type_key').notNull().unique(),
  typeGroup: text('type_group').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  defaultEnabled: integer('default_enabled').default(1),
})

export const tokenBlacklist = sqliteTable('token_blacklist', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  index('idx_token_blacklist_expires').on(table.expiresAt),
])

export const backgroundJobs = sqliteTable('background_jobs', {
  id: integer('id').primaryKey(),
  jobType: text('job_type').notNull().unique(),
  status: text('status').notNull().default('idle'),
  lastRunAt: text('last_run_at'),
  nextRunAt: text('next_run_at').notNull(),
  intervalMs: integer('interval_ms').notNull(),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  lastError: text('last_error'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

export const deadlineReminders = sqliteTable('deadline_reminders', {
  id: integer('id').primaryKey(),
  subtaskId: integer('subtask_id').references(() => subtasks.id, { onDelete: 'cascade' }),
  reminderType: text('reminder_type').notNull(),
  sent: integer('sent').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, table => [
  uniqueIndex('uq_deadline_reminders').on(table.subtaskId, table.reminderType),
])
