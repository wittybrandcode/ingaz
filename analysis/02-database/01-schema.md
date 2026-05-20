# تحليل قاعدة البيانات — Database Schema Analysis

> الملف: `server/src/db/schema.ts` — 270 سطر

## الجداول (21 جدول)

### 1.1 roles
| العمود | النوع | القيود |
|--------|------|--------|
| id | `serial` | PRIMARY KEY |
| name | `text` | NOT NULL, UNIQUE |

**العلاقات:** Referenced by `users.roleId` (onDelete: set null), `rolePermissions.roleId` (onDelete: cascade)

### 1.2 users
| العمود | النوع | القيود |
|--------|------|--------|
| id | `serial` | PRIMARY KEY |
| name | `text` | NOT NULL |
| email | `text` | NOT NULL, UNIQUE |
| password | `text` | NOT NULL |
| roleId | `integer` | FK → roles.id (set null) |
| avatar | `text` | - |
| status | `text` | DEFAULT 'active', CHECK('active','inactive','archived') |
| creditScore | `integer` | DEFAULT 10 |
| frozenAt | `timestamp` | - |
| freezeReason | `text` | - |
| unfrozenAt | `timestamp` | - |
| lastCreditRecovery | `timestamp` | - |
| createdAt | `timestamp` | DEFAULT now() |

**المشاكل:**
- لا يوجد CHECK على `creditScore` (0-10)
- لا يوجد INDEX على `roleId`
- `avatar` بدون validation

### 1.3 projects
| العمود | النوع | القيود |
|--------|------|--------|
| id | `serial` | PRIMARY KEY |
| title | `text` | NOT NULL |
| description | `text` | - |
| createdBy | `integer` | FK → users.id (no action) |
| status | `text` | DEFAULT 'active', CHECK |
| createdAt | `timestamp` | DEFAULT now() |

**المشاكل:**
- `createdBy` FK uses NO ACTION → orphan risk on user delete
- لا يوجد INDEX على `createdBy`

### 1.4 tasks
| العمود | النوع | القيود |
|--------|------|--------|
| id | `serial` | PRIMARY KEY |
| projectId | `integer` | FK → projects.id (cascade) |
| title | `text` | NOT NULL |
| description | `text` | - |
| createdBy | `integer` | FK → users.id (no action) |
| status | `text` | DEFAULT 'active', CHECK |
| createdAt | `timestamp` | DEFAULT now() |

### 1.5 subtasks
| العمود | النوع | القيود |
|--------|------|--------|
| id | `serial` | PRIMARY KEY |
| taskId | `integer` | FK → tasks.id (cascade) |
| title | `text` | NOT NULL |
| description | `text` | - |
| assignedTo | `integer` | FK → users.id (no action) |
| status | `text` | DEFAULT 'open', CHECK |
| deadline | `timestamp` | - |
| winnerCommentId | `integer` | **❌ MISSING FK → comments.id** |
| createdAt | `timestamp` | DEFAULT now() |

**مشكلة حرجة:** `winnerCommentId` ليس له FOREIGN KEY إلى `comments.id` — لا تكامل مرجعي.

### 1.6-1.21 باقي الجداول
`project_members`, `task_assignees`, `subtask_assignees`, `notifications`, `activity_logs`, `comments`, `attachments`, `warnings`, `warning_types`, `restriction_levels`, `permissions`, `role_permissions`, `notification_preferences`, `notification_types`, `token_blacklist`, `deadline_reminders`

## مشاكل حرجة

| # | الموقع | المشكلة | الخطورة |
|---|--------|---------|---------|
| 1 | `schema.ts:60` | `subtasks.winnerCommentId` بدون FK | **حرجة** |
| 2 | Migration vs schema | `0000_watery_xavin.sql` غير متطابق مع schema.ts الحالي | **حرجة** |
| 3 | `setup.ts` | نظام ترحيل مزدوج يؤدي إلى انجرافschema | **حرجة** |
