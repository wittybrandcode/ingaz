# Ingaz (إنجاز) — Agent Guide

## Quick start
```bash
start.bat                          # Normal daily startup (kill old, start server+client)
start.bat setup                    # One-time: migrate schema + seed, then start
start.bat seed                     # Refresh permissions only (safe anytime)
cd server && npm run dev           # dev with tsx watch (auto-reloads on .ts changes)
cd client && npm run dev           # Vite dev server (HMR)
cd server && npm run test          # 95 tests (95 pass ✅)
cd server && npm run typecheck     # 0 errors
cd client && npm run typecheck     # 0 errors
cd server && npm run lint          # 0 errors, 460 warnings (all no-explicit-any + unused-vars)
cd client && npm run lint          # 0 errors, 27 warnings
```

## Test accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ingaz.com | admin123 |
| User | emp@ingaz.com | emp123 |

## Architecture

### Directory layout
```
Bigg/
├── client/          # React + Vite (port 5173) — 12 pages, 38 components, 6 stores
├── server/          # Express + PostgreSQL (port 3001) — 13 routes, 15 services, 8 middleware
├── shared/          # types.ts — 16 interfaces
├── uploads/         # uploaded files (served statically)
├── docs/            # ROADMAP.md + archived plans + system design reference
├── .opencode/       # 5 agents, 5 skills, 1 plan system
└── start.bat
```

### Entrypoints
- **Server:** `server/src/index.ts` — Express app + Socket.IO + BackgroundJobService (4 jobs)
- **Client:** `client/src/main.tsx` → `App.tsx` — React 19 + React Router DOM + lazy pages

### Route mounting (server/src/index.ts)
All routes mounted under **both** `/api` and `/api/v1` prefixes (dual mount).
```
POST /api/v1/auth/login          →  auth.ts      (rate-limited: 100/15min)
GET  /api/v1/members             →  members.ts    (no authorizePermission — all users)
PUT  /api/v1/subtasks/:id        →  subtasks.ts   (fixed: authorizePermission added in Phase 1 cleanup)
```

### Middleware chain (full order)
```
rateLimiter (1000/5000 per 15min)
→ helmet (CSP with nonces)
→ cors (ALLOWED_ORIGINS env)
→ express.json (1mb)
→ cookieParser
→ requestId (UUID)
→ pinoLogger
→ res.success() / res.fail() helpers
→ Route:
    authenticate → checkFrozen → requireCredit(field) → authorize(...roleIds) → handler
```

### res.success() middleware (server/src/index.ts:120)
Applies `camelToSnake()` **automatically** to all JSON responses. Any manual `camelToSnake()` calls in services are redundant (but harmless).

### Socket.IO
- Auth via `socket.handshake.auth.token` or cookie, verified against JWT + blacklist
- Events: `list:update`, `subtask:updated`, `comment:new`, `online:list`, `user:online`, `user:offline`, `user:status`
- **IMPORTANT**: Client `lib/socket.ts` had module-level `useAuthStore.subscribe()` with **no cleanup** — creates subscription leaks on Vite HMR. ✅ Fixed in `hooks/useSocketAuth.ts` (Phase 5)

### Vite proxy (client/vite.config.ts)
Proxies `/api`, `/socket.io`, `/uploads` → `http://localhost:3001`

## Critical Known Bugs (Won't Fix Without This File)

### 🔴 .run() method doesn't exist on PostgreSQL  ✅ Fixed (Phase 1)
`server/src/services/DeadlineService.ts:106` used `.run()` (SQLite-only). All deadline reminders silently failed. **Fix:** removed `.run()`.

### 🔴 PUT /subtasks/:id has no authorizePermission  ✅ Fixed (Phase 1)
`server/src/routes/subtasks.ts:62` — any authenticated user could edit any subtask. **Fix:** added `authorizePermission('subtasks.edit'), requireCredit('canEdit')`.

### 🔴 Frozen users can still mutate data  ✅ Fixed (Phase 1)
6 endpoints (DELETE/POST tasks and subtasks) lacked `checkFrozen`. **Fix:** added `checkFrozen` to all 6 mutation endpoints.

### 🔴 XSS in ViewModal  ✅ Fixed (Phase 1)
`client/src/components/ViewModal.tsx:37` used `dangerouslySetInnerHTML` without `sanitizeHTML()`. **Fix:** added `sanitizeHTML(text)`.

### 🔴 XSS via sanitize.ts missing ALLOWED_URI_REGEXP  ✅ Fixed (Phase 1)
`client/src/lib/sanitize.ts` — DOMPurify allowed `javascript:` URLs. **Fix:** added `ALLOWED_URI_REGEXP`.

### 🔴 NotificationService returns wrong notifications  ✅ Fixed (Phase 2)
`create()` and `createMany()` fetched last N notifications instead of using `RETURNING` clause. Race condition exposes other users' notifications. **Fix:** use `.returning()`.

### 🔴 11 tests fail  ✅ Fixed (Phase 2)
`notifications.test.ts` (6) + `deadlines.test.ts` (5) — `SqliteError: table notifications has no column named from_user_id`. Test schema (`test-schema.ts` + `helpers.ts` SCHEMA_SQL) was missing `from_user_id` column present in production schema. **Fix:** added column + `RETURNING` clause.

### 🔴 AssignModal assigns to wrong entity type  ✅ Fixed (Phase 1)
`client/src/components/AssignModal.tsx:26-38` — when `assignType='subtask'`, still fetched tasks endpoint. **Fix:** conditional endpoint + new `/subtasks/by-project/:projectId` route.

### 🔴 hasPermission() called without userId bypasses manager check  ✅ Fixed (Phase 4)
`SubtaskService.ts:270,351` calls `hasPermission(roleId, perm)` without `userId`. Managers denied incorrectly. **Fix:** pass `ctx.userId`.

### 🔴 UploadService.deleteFile uses wrong path  ✅ Fixed (Phase 4)
`file.filename` instead of `path.join(process.cwd(), 'uploads', file.filename)`. Files never actually deleted. **Fix:** added full path.

## Known Framework Quirks (PostgreSQL + Drizzle)
- **DB:** PostgreSQL 16 via `drizzle-orm/node-postgres` + `pg` Pool
- **DB URL:** `DATABASE_URL` env var
- **Schema:** `server/src/db/schema.ts` — 21 tables (pgTable)
- **Migrations:** `drizzle-kit` generates SQL in `server/drizzle/`. NEVER use `.run()` — it's SQLite-only.
- **`db.execute()` returns `{ rows, command, rowCount, fields }`** — access `.rows` for result array.
- **Transactions added** — WarningService.create/respond, AuthService.login/updateProfile, UserService.create wrapped ✅
- **tryCatch added** to 30+ route handlers (notifications, users, projects, warnings, members) ✅
- **JWT:** `Authorization: Bearer <token>` header only. No cookies. 7-day expiry. Blacklist on logout.
- `erasableSyntaxOnly: true` — no `public`/`private`/`protected` on constructor params
- `verbatimModuleSyntax: true` — requires `.js` in relative imports
- **`@types/express@4` with `express@4`** (resolved Phase 6)

## Test Infrastructure
- **Vitest** with `globals: true`, `environment: node`
- Uses **SQLite** (better-sqlite3) in-memory — NOT PostgreSQL
- Dual schema maintenance: `schema.ts` (production), `test-schema.ts` (test), `SCHEMA_SQL` (helpers.ts) — all 3 must stay in sync
- Tests that mock `../db/index.js` (auth, projects, tasks, users, warnings, middleware) pass ✅
- Tests that DON'T mock `../db/index.js` (notifications, deadlines) pass ✅ (Phase 2: schema drift fixed + RETURNING clause)
- `better-sqlite3` is in `devDependencies` (moved from deps in Phase 6)
- 6 of 15 services have zero tests: AnalyticsService, BackgroundJobService, CommentService, MemberService, RoleService, UploadService

## Client Architecture
- **State management:** Zustand (6 stores: auth, app, member, project, task, subtask)
- **Auth store** is persisted to localStorage; all others are ephemeral
- **`api.ts` interceptor** auto-unwraps `{ success, data }` → `res.data = res.data.data`. Do NOT add extra `.data` in component code.
- **KanbanBoard** split into 4 column components: ProjectsColumn, TasksColumn, SubtasksColumn, MembersColumn ✅
- **Error Boundaries** on all protected routes ✅
- **Centralized error toast** in api.ts interceptor via global toast() ✅
- **Socket event handling** centralized in `lib/eventBus.ts` with React hooks ✅

## ✅ الإنجاز — Completed (Phases 1–7)

All 93 issues from ANALYSIS-REPORT.md have been resolved across 7 phases (10 critical + 18 high + 65 medium/low). Remaining tasks consolidated into one file below.

## Relevant Files

### Server (75+ source files)
- `index.ts` — Express setup, res.success/fail, Socket.IO, route mounting, 4 background jobs
- `db/schema.ts` — Drizzle pgTable definitions (21 tables)
- `db/index.ts` — Pool singleton, `getDb()`, `addActivityLog`, helpers (returns `any`)
- `middleware/auth.ts` — authenticate, authorize, authorizePermission, checkFrozen, requireCredit
- `middleware/errorHandler.ts` — global error handler (⚠️ defines own AppError interface with `status` not `statusCode`)
- `routes/subtasks.ts` — C3 fixed: authorizePermission + requireCredit; C4 fixed: checkFrozen on 3 endpoints; new `GET /by-project/:projectId` route
- `services/*.ts` — 15 service files, all extend BaseService
- `lib/case-transform.ts` — `camelToSnake` (recursive, handles Date/RegExp/Array)
- `lib/onlineUsers.ts` — in-memory `Set<number>` (doesn't scale horizontally)
- `__tests__/` — 10 test files, 8 test suites (95 tests ✅)
- `__tests__/helpers.ts` — test factory functions (seedUser, seedProject, generateToken)
- `__tests__/test-schema.ts` — ✅ in sync with production schema (Phase 2)

### Client (65+ source files)
- `main.tsx` → `App.tsx` — routing with lazy-loaded pages
- `lib/api.ts` — Axios instance, auto-unwraps `{ success, data }`
- `lib/socket.ts` — Socket.IO singleton (✅ subscription leak fixed via `hooks/useSocketAuth.ts`)
- `lib/sanitize.ts` — DOMPurify wrapper (✅ ALLOWED_URI_REGEXP added in Phase 1)
- `store/*.ts` — 6 Zustand stores (authStore persisted to localStorage)
- `pages/*.tsx` — 12 pages (lazy loaded)
- `components/*.tsx` — 38 components
- `components/*Column.tsx` — 4 column components (Projects, Tasks, Subtasks, Members)

### Shared
- `shared/types.ts` — 16 interfaces (snake_case, matches API response)
- ⚠️ `fromUserId` missing from `Notification` type (API returns it)
- ⚠️ `unfrozenAt` missing from `User` type

## Roadmap
- `docs/ROADMAP.md` — All remaining work (12 issues) unified in one file
