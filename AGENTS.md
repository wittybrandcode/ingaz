# Ingaz (إنجاز) — Agent Guide

## Quick start
```bash
start.bat                          # Normal daily startup (kill old, start server+client)
start.bat setup                    # One-time: migrate schema + seed, then start
start.bat seed                     # Refresh permissions only (safe anytime)
cd server && npm run dev           # dev with tsx watch (auto-reloads on .ts changes)
cd client && npm run dev           # Vite dev server (HMR)
cd server && npm run test          # run unit/integration tests (43 tests)
cd server && npm run backup        # backup database
```

## Test accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ingaz.com | admin123 |
| Deputy | deputy@ingaz.com | deputy123 |
| Employee | emp@ingaz.com | emp123 |

## Before editing
```bash
cd server && npm run typecheck     # always first
cd client && npm run typecheck     # always first
```
Then `npm run lint` and fix warnings.

## Architecture

### Directory layout
```
Bigg/
├── client/        # React + Vite (port 5173)
├── server/        # Express + SQLite (port 3001)
├── shared/        # types.ts — shared TypeScript interfaces
├── uploads/       # uploaded files (served statically)
└── start.bat      # kill old processes, start both
```

### Route mounting (server/src/index.ts)
Routes are mounted under **both** `/api` and `/api/v1`. All paths in code are relative to those prefixes.
```
GET /api/v1/projects/14/members  →  routes/projects.ts :: /:id/members
```

### Key chain of middleware (applied per-route):
`authenticate` → `checkFrozen` → `requireCredit(field)` → `authorize(...roleIds)` → handler

### Real-time
Socket.io for live updates. Server emits `list:update` (project/task/subtask CRUD) and `subtask:updated`. Client connects automatically via `lib/socket.ts`.

### Vite proxy (client/vite.config.ts)
Routes `/api`, `/socket.io`, `/uploads` → `http://localhost:3001`

## The task assignment system

### Roles (defined identically client + server)
```
ADMIN   = 1   # full access, no membership needed
DEPUTY  = 2   # same as ADMIN for task creation
EMPLOYEE = 3  # needs project membership to create tasks
```

### Project membership (`project_members` table)
- **Who can assign:** ADMIN or DEPUTY only (checked via `authorize(ROLES.ADMIN, ROLES.DEPUTY)`)
- **Who gets assigned:** Only EMPLOYEE users (`role_id === 3`). ADMIN/DEPUTY don't need membership.
- **Role value:** Always `'manager'` (the column supports `'manager'` / `'member'` but only `'manager'` is used)
- **API:** `GET|POST|DELETE /projects/:id/members`
- **Duplicate prevention:** SQLite UNIQUE(project_id, user_id) constraint → 409

### Task creation gating (`server/src/routes/tasks.ts:49`)
```typescript
if (req.user.role_id === ROLES.EMPLOYEE && !isProjectManager(req.user.id, project_id)) {
  return res.fail(403, 'لا تملك صلاحية إنشاء مهام في هذا المشروع');
}
```
- ADMIN/DEPUTY: create tasks in any project, any project's tasks
- EMPLOYEE: must be project member (checked via `isProjectManager()` in `server/src/db.ts:291`)

### Subtask creation gating (`server/src/routes/subtasks.ts:62`)
Same logic: EMPLOYEE must be project manager of the task's parent project.

### Credit / restriction layer
All task/subtask creation also passes `requireCredit('can_create_tasks')`. Users with low credit scores may be restricted regardless of membership.

### UI member dropdown filter (both ProjectSettingsModal.tsx and ProjectDetail.tsx)
```typescript
users.filter(u => u.role_id === 3 && !members.some(m => m.user_id === u.id))
```
Only EMPLOYEEs not already members appear as click-to-add buttons.

## Key files for the assignment system
| File | Purpose |
|------|---------|
| `shared/types.ts` | ProjectMember, ProjectDetail, User, ROLES_VALUES |
| `server/src/db.ts:291` | `isProjectManager()` — the central gating function |
| `server/src/routes/projects.ts:127-166` | Members CRUD (GET/POST/DELETE /:id/members) |
| `server/src/routes/tasks.ts:49` | EMPLOYEE membership check on task creation |
| `server/src/routes/subtasks.ts:62` | EMPLOYEE membership check on subtask creation |
| `server/src/middleware/auth.ts` | authenticate, authorize, requireCredit, checkFrozen |
| `client/src/components/ProjectSettingsModal.tsx` | Member management UI in settings modal |
| `client/src/pages/ProjectDetail.tsx` | Member management UI in project detail page |

## Service Layer (`server/src/services/`)

### Architecture
Route handlers are thin wrappers. Business logic lives in service classes:

```
routes/*.ts  →  validate/auth middleware  →  service method  →  response
```

Each service:
- Extends `BaseService(db)` where `db` is the `better-sqlite3` instance
- Throws `AppError(statusCode, message)` for business rule failures
- Accepts `ServiceContext` for operations needing user context + socket.io
- Handles activity logs, notifications, and socket events internally

### Services overview
| Service | Route file | Key methods |
|---------|-----------|-------------|
| `ProjectService` | `routes/projects.ts` | list, getById, create, update, archive, permanentDelete, getMembers, addMember, removeMember |
| `TaskService` | `routes/tasks.ts` | list, listByProject, create, update, archive, getAssignees, addAssignee, removeAssignee |
| `SubtaskService` | `routes/subtasks.ts` | list, listByTask, getById, create, update, delete, getAssignees, addAssignee, removeAssignee |
| `CommentService` | `routes/comments.ts` | getBySubtask, create |
| `UserService` | `routes/users.ts` | list, create, update, archive, restore |
| `AuthService` | `routes/auth.ts` | login, me, updateProfile, updateAvatar, logout |
| `WarningService` | `routes/warnings.ts` | listWarningTypes, create/update/deleteWarningType, listLevels, updateLevel, listCreditScores, getMyLevel, list, listMy, create, respond, clear, sustain, getFreezeStatus, unfreeze |
| `NotificationService` | `routes/notifications.ts` | list, unreadCount, markRead, markAllRead, getPreferences, updatePreference, dailySummary, updateBatchTypes |
| `UploadService` | `routes/upload.ts` | upload, getFiles, getFilesBulk, deleteFile |
| `RoleService` | `routes/roles.ts` | list, create, update, delete, getPermissions, updatePermissions, listAllPermissions |
| `AnalyticsService` | `routes/analytics.ts` | dashboard |

### Helper types
- `AppError` — throw from services with HTTP status code
- `ServiceContext` — `{ userId, roleId, userName?, userAvatar?, io? }`
- `tryCatch(handler)` — wraps route handlers to catch `AppError` → `res.fail()`

## Code style (from .prettierrc)
- no semicolons, single quotes, trailing commas
- 120 char width, 2-space indent
- avoid parens on single-param arrow functions

## Framework quirks
- `tsx watch` auto-reloads on .ts changes (but NOT if server was started before code changes — kill old process first)
- `shared/` is imported as `@shared/types` in client, resolved via Vite alias
- DB is SQLite via `better-sqlite3` (synchronous). Schema auto-migrates on server start in `db.ts`
- JWT in `Authorization: Bearer` header (NOT cookies). No `withCredentials: true` needed.
- Token expiry: 7 days. Blacklist on logout.
- No migration tool — schema is defined inline in `db.ts`
- `erasableSyntaxOnly: true` in tsconfig — no `public`/`protected`/`private` on constructor params or methods; use explicit field assignment instead
