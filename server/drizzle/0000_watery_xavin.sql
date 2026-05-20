CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text,
	"file_size" integer,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "attachments_entity_type_check" CHECK ("attachments"."entity_type" IN ('project', 'task', 'subtask'))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subtask_id" integer,
	"user_id" integer,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deadline_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"subtask_id" integer,
	"reminder_type" text NOT NULL,
	"sent" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "deadline_reminders_type_check" CHECK ("deadline_reminders"."reminder_type" IN ('24h', '6h', 'overdue'))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"notification_type" text NOT NULL,
	"channels" text DEFAULT '["in_app"]',
	"enabled" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "notification_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"type_key" text NOT NULL,
	"type_group" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_enabled" integer DEFAULT 1,
	CONSTRAINT "notification_types_type_key_unique" UNIQUE("type_key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"title" text NOT NULL,
	"message" text,
	"type" text DEFAULT 'info',
	"read" integer DEFAULT 0,
	"related_type" text,
	"related_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"group_name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'manager',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "project_members_role_check" CHECK ("project_members"."role" IN ('manager', 'member'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_by" integer,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "projects_status_check" CHECK ("projects"."status" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "restriction_levels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ar" text NOT NULL,
	"min_score" integer DEFAULT 0,
	"color" text DEFAULT '#22c55e',
	"icon" text DEFAULT 'CheckCircle2',
	"show_banner" integer DEFAULT 0,
	"can_login" integer DEFAULT 1,
	"can_create_projects" integer DEFAULT 1,
	"can_create_tasks" integer DEFAULT 1,
	"can_edit" integer DEFAULT 1,
	"can_assign" integer DEFAULT 1,
	"can_submit" integer DEFAULT 1,
	"can_comment" integer DEFAULT 1,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer,
	"permission_id" integer
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subtask_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"subtask_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"assigned_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer,
	"title" text NOT NULL,
	"description" text,
	"assigned_to" integer,
	"status" text DEFAULT 'pending',
	"deadline" timestamp,
	"submission_text" text,
	"submission_link" text,
	"manager_notes" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "subtasks_status_check" CHECK ("subtasks"."status" IN ('pending', 'in_progress', 'submitted', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "task_assignees" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"assigned_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"title" text NOT NULL,
	"description" text,
	"created_by" integer,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "token_blacklist" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"expires_at" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role_id" integer,
	"avatar" text,
	"status" text DEFAULT 'active',
	"credit_score" integer DEFAULT 10,
	"frozen_at" timestamp,
	"freeze_reason" text,
	"unfrozen_at" timestamp,
	"last_credit_recovery" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_status_check" CHECK ("users"."status" IN ('active', 'inactive', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "warning_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"points" integer DEFAULT 1,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "warnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"issued_by" integer,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending',
	"response_text" text,
	"responded_at" timestamp,
	"cleared_by" integer,
	"cleared_at" timestamp,
	"deadline" timestamp NOT NULL,
	"warning_type_id" integer,
	"points_deducted" integer DEFAULT 1,
	"credit_before" integer DEFAULT 10,
	"credit_after" integer DEFAULT 10,
	"warning_type_name" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "warnings_status_check" CHECK ("warnings"."status" IN ('pending', 'responded', 'cleared', 'sustained', 'ignored'))
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_subtask_id_subtasks_id_fk" FOREIGN KEY ("subtask_id") REFERENCES "public"."subtasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_reminders" ADD CONSTRAINT "deadline_reminders_subtask_id_subtasks_id_fk" FOREIGN KEY ("subtask_id") REFERENCES "public"."subtasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask_assignees" ADD CONSTRAINT "subtask_assignees_subtask_id_subtasks_id_fk" FOREIGN KEY ("subtask_id") REFERENCES "public"."subtasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask_assignees" ADD CONSTRAINT "subtask_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtask_assignees" ADD CONSTRAINT "subtask_assignees_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_cleared_by_users_id_fk" FOREIGN KEY ("cleared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_warning_type_id_warning_types_id_fk" FOREIGN KEY ("warning_type_id") REFERENCES "public"."warning_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_logs_user_created" ON "activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_attachments_entity" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_uploaded_by" ON "attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "idx_comments_subtask" ON "comments" USING btree ("subtask_id");--> statement-breakpoint
CREATE INDEX "idx_comments_user" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_deadline_reminders" ON "deadline_reminders" USING btree ("subtask_id","reminder_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notification_prefs" ON "notification_preferences" USING btree ("user_id","notification_type");--> statement-breakpoint
CREATE INDEX "idx_notif_prefs_user" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "idx_notifications_created" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_project_members" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_project_members_user" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_permissions" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "idx_role_permissions_role" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subtask_assignees" ON "subtask_assignees" USING btree ("subtask_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_subtask_assignees_subtask" ON "subtask_assignees" USING btree ("subtask_id");--> statement-breakpoint
CREATE INDEX "idx_subtask_assignees_user" ON "subtask_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subtasks_task" ON "subtasks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_subtasks_assigned" ON "subtasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_assignees" ON "task_assignees" USING btree ("task_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignees_task" ON "task_assignees" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignees_user" ON "task_assignees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_project" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_token_blacklist_expires" ON "token_blacklist" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_warnings_user" ON "warnings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_warnings_status" ON "warnings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_warnings_deadline" ON "warnings" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "idx_warnings_user_created" ON "warnings" USING btree ("user_id","created_at");