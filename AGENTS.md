# Ingaz (إنجاز) — Agent Guide

## Quick start
```bash
start.bat                          # Normal daily startup (kill old, start server+client)
start.bat setup                    # One-time: migrate schema + seed, then start
start.bat seed                     # Refresh permissions only (safe anytime)
cd server && npm run dev           # dev with tsx watch (auto-reloads on .ts changes)
cd client && npm run dev           # Vite dev server (HMR)
cd server && npm run test          # run unit/integration tests (95 tests)
cd server && npm run typecheck     # server TypeScript check
cd client && npm run typecheck     # client TypeScript check
cd server && npm run lint          # server ESLint
cd client && npm run lint          # client ESLint
```

## Test accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ingaz.com | admin123 |
| User | emp@ingaz.com | emp123 |

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
├── server/        # Express + PostgreSQL (port 3001)
├── shared/        # types.ts — shared TypeScript interfaces
├── uploads/       # uploaded files (served statically)
├── analysis/      # atomic analysis (11 sections)
├── docs/          # plans and handoff documents
└── start.bat      # kill old processes, start both
```

### Route mounting (server/src/index.ts)
Routes mounted under **both** `/api` and `/api/v1`.
```
GET /api/v1/projects/14/members  →  routes/projects.ts :: /:id/members
```

### Key chain of middleware
`authenticate` → `checkFrozen` → `requireCredit(field)` → `authorize(...roleIds)` → handler

### res.success() middleware (server/src/index.ts:113)
Applies `camelToSnake()` **automatically** to all responses. Any `camelToSnake()` calls in services are redundant (but harmless).

### Real-time
Socket.io for live updates. Events: `list:update`, `subtask:updated`. Client via `lib/socket.ts`.

### Vite proxy (client/vite.config.ts)
Routes `/api`, `/socket.io`, `/uploads` → `http://localhost:3001`

## Known Framework Quirks (PostgreSQL + Drizzle)
- **Database**: PostgreSQL via `drizzle-orm/node-postgres` + `pg` Pool
- **DB URL**: `DATABASE_URL` env var (e.g., `postgres://user:pass@host:5432/ingaz`)
- **Schema**: `server/src/db/schema.ts` — Drizzle ORM table definitions
- **Migrations**: `drizzle-kit` generates SQL files in `server/drizzle/`
- **No SQLite**: The code was migrated FROM SQLite (better-sqlite3) TO PostgreSQL. Old references in tests may remain.
- **Seed**: `server/src/seed.ts` — populates roles, users, permissions, warning types, restriction levels
- **JWT**: `Authorization: Bearer <token>` header (NOT cookies). No `withCredentials: true`.
- **Token expiry**: 7 days. Blacklist on logout (DB-backed `token_blacklist` table, in-memory Map too).
- `erasableSyntaxOnly: true` — no `public`/`private`/`protected` on constructor params
- `verbatimModuleSyntax: true` — requires `.js` in relative imports

## Execution Plan (docs/EXECUTION-PLAN.md) — ✅ COMPLETE

### 6 Phases — 16 Problems
| Phase | Focus | Problems | Status |
|-------|-------|----------|--------|
| 1 | Critical Security Fixes | C1-C4 (JWT fallback, cookie-parser, FK, setup.ts) | ✅ Done |
| 2 | Auth & Transactions | 5, 6, 10 (blacklist, transactions, tests) | ✅ Done |
| 3 | Client State & Performance | 7, 8, 9, 12 (socket stores, errors, N+1, domains) | ✅ Done |
| 4 | Testing Expansion | New test files (middleware, projects, users) | ✅ Done |
| 5 | Code Quality & Refactoring | 11, 13, 16 (statusConfig, repository, typing) | ✅ Done |
| 6 | Infrastructure & DevOps | 14, 15 (background jobs, package-lock, Docker) | ✅ Done |

### Custom Agents (.opencode/agents/)
| Agent | Purpose |
|-------|---------|
| `security-agent` | Fix security vulnerabilities |
| `db-agent` | Handle Drizzle schema + migrations |
| `client-agent` | Improve React components + stores |
| `docs-agent` | Write documentation |
| `member-system` | Build member card/avatar/badge system |

### Custom Skills (.opencode/skills/)
| Skill | Purpose |
|-------|---------|
| `phase-verify` | Run typecheck + lint + test after each phase |
| `phase-document` | Write phase completion markdown |
| `session-handoff` | Create context handoff for new sessions |
| `git-commit` | Commit phase changes |
| `member-system` | Execute member system plan (6 phases) |

### Per-Phase Workflow
```
1. Load context (AGENTS.md + latest docs/)
2. Load skill member-system (reads STATUS.md → determines current phase)
3. Execute fixes (parallel task agents when possible)
4. phase-verify (typecheck + lint + test)
5. phase-document (write docs/phase-N-*.md)
6. git-commit
7. Update plans/member-system/STATUS.md → next phase
8. session-handoff if context full → open new session
```

## Active Plan System

### Location: `plans/member-system/`
- `README.md` — Overview + architecture + self-resuming mechanism
- `plan.md` — Detailed 6-phase plan with code specs
- `STATUS.md` — Execution tracker (machine-readable JSON + human table)

### Resume Protocol
1. Read `plans/member-system/STATUS.md`
2. Identify `phase` and `current_step`
3. Continue from that exact point
4. No manual intervention needed between phases

### Phase Map
| Phase | Name | File |
|-------|------|------|
| 1 | Member API | `server/src/services/MemberService.ts` |
| 2 | Member Store | `client/src/store/memberStore.ts` |
| 3 | MemberCard + MemberList | `client/src/components/` |
| 4 | Online Status via Socket | `server/index.ts` + `client/lib/socket.ts` |
| 5 | Action Icons + Assign/Warn | Modals |
| 6 | MemberDetailModal | Full detail modal |

## Problems Discovered (from analysis/)

### 🔴 Critical
| # | Problem | Location | Fix |
|---|---------|----------|-----|
| C1 | JWT_SECRET 'fallback-secret' hardcoded | `server/src/index.ts` | Remove fallback, validate env |
| C2 | cookie-parser imported but not used | `server/src/index.ts` | `app.use(cookieParser())` |
| C3 | subtasks.winnerCommentId missing FK | `server/src/db/schema.ts:60` | Add FK → comments.id |
| C4 | Dual migration system → schema drift | `server/src/db/setup.ts` | Unify migration logic |

### 🟡 High Priority
| # | Problem | Location |
|---|---------|----------|
| 5 | No token_blacklist check in authenticate | `server/src/middleware/auth.ts` |
| 6 | No transactions in complex operations | `server/src/services/*.ts` |
| 7 | N+1 in CSV export | `client/src/components/ProjectSettingsModal.tsx` |
| 8 | Socket events don't update stores directly | `client/src/lib/socket.ts`, `client/src/store/*.ts` |
| 9 | No Error Boundaries on most pages | `client/src/pages/*.tsx` |
| 10 | Low test coverage (43 tests) | `server/src/__tests__/` |

### 🟢 Nice to Have
| # | Problem | Location |
|---|---------|----------|
| 11 | statusConfig duplicated 6+ times | `client/src/components/` |
| 12 | No domain stores (useState everywhere) | `client/src/store/` |
| 13 | No Repository layer | `server/src/services/` |
| 14 | No background job queue | `server/src/` |
| 15 | No package-lock.json | `server/` |
| 16 | Notification.related: any | `shared/types.ts` |

## Relevant Files
### Server
- `server/src/index.ts` — Express setup, res.success(), Socket.IO, route mounting
- `server/src/db/schema.ts` — Drizzle ORM schema (21 tables)
- `server/src/db/setup.ts` — migration + seed orchestration
- `server/src/middleware/auth.ts` — authenticate, authorize, requireCredit, checkFrozen
- `server/src/routes/*.ts` — 10 route files (thin wrappers)
- `server/src/services/*.ts` — 10 service files (business logic)
- `server/src/seed.ts` — database seeding
- `server/src/__tests__/` — auth.test.ts (6), tasks.test.ts (16), warnings.test.ts (21)

### Client
- `client/src/store/authStore.ts` — persisted Zustand store
- `client/src/store/appStore.ts` — ephemeral Zustand store
- `client/src/lib/socket.ts` — Socket.io singleton
- `client/src/lib/api.ts` — Axios instance + interceptors
- `client/src/pages/*.tsx` — 8 page components
- `client/src/components/*.tsx` — ~25 components

### Shared
- `shared/types.ts` — 16 interfaces + ROLES_VALUES

### Analysis
- `analysis/` — 11 sections, 14 markdown files
- `docs/EXECUTION-PLAN.md` — full execution plan
