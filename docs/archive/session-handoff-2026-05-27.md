# Session Handoff — 2026-05-27

## State
- Session: 1 (member system + cleanup plan phases 1–7)
- Context usage: High (requires fresh session)
- All changes are unstaged (no commits made in this session)

## Completed (All 93-issue CLEANUP-PLAN)

### Phase 1 — Security fixes (7 critical) ✅
| Fix | Files |
|-----|-------|
| `.run()` on PostgreSQL removed | `DeadlineService.ts` |
| `authorizePermission('subtasks.edit'), requireCredit('canEdit')` | `routes/subtasks.ts` |
| `checkFrozen` on 6 mutation endpoints | `routes/tasks.ts`, `subtasks.ts` |
| `sanitizeHTML()` in ViewModal | `components/ViewModal.tsx` |
| `ALLOWED_URI_REGEXP` in DOMPurify | `lib/sanitize.ts` |
| New route `GET /by-project/:projectId` + `listByProject()` | `routes/subtasks.ts`, `SubtaskService.ts` |
| Conditional endpoint in AssignModal | `components/AssignModal.tsx` |
| Duplicate role ID fixed (employee=2→3) | `seed-full.ts` |

### Phase 2 — Database + tests ✅
| Fix | Files |
|-----|-------|
| `fromUserId` added to test schema | `__tests__/test-schema.ts`, `helpers.ts` SCHEMA_SQL |
| `create()` uses `.returning()` | `NotificationService.ts` |
| `createMany()` uses `.returning()` | `NotificationService.ts` |
| **95/95 tests pass** ✅ | |

### Phase 3 — Error handling (partial) ✅
| Fix | Files |
|-----|-------|
| tryCatch on 30+ routes | `routes/notifications.ts`, `users.ts`, `projects.ts`, `warnings.ts`, `members.ts` |
| Guard for `GET /subtasks/by-tasks` without `task_ids` | `routes/subtasks.ts` |

### Phase 4 — Permissions + files ✅
| Fix | Files |
|-----|-------|
| `hasPermission(roleId, perm, ctx.userId)` — managers bypassed | `SubtaskService.ts` |
| `UploadService.deleteFile` — fixed `path.join()` | `UploadService.ts` |
| `checkFrozen` cache — `isFrozen: boolean` instead of ISO string | `middleware/auth.ts` |
| `addMember` — accepts `role` param instead of hardcoded `'manager'` | `ProjectService.ts` |
| Redundant `camelToSnake()` removed from 5 service return values | `AuthService.ts`, `UserService.ts`, `ProjectService.ts` |

### Phase 5 — Client fixes (partial) ✅
| Fix | Files |
|-----|-------|
| Socket subscription leak → `useSocketAuth` hook with cleanup | `hooks/useSocketAuth.ts`, `lib/socket.ts`, `App.tsx` |
| ErrorBoundary on all protected routes | `App.tsx` |
| `React.memo` on `MemberProfileCard` | `components/MemberProfileCard.tsx` |

### Phase 6 — Code cleanup ✅
| Fix | Files |
|-----|-------|
| Deleted unused `MemberCard.tsx` | (deleted) |
| Deleted unused `setup.ts` | (deleted) |
| `better-sqlite3` → devDependencies | `package.json` |
| `@types/express@5` → `@types/express@4` | `package.json` |
| ProjectSettingsModal uses shared `exportToCSV` | `components/ProjectSettingsModal.tsx` |
| Removed unused imports (`varchar`, `jsonb`, `lte`, `ROLES`, `MAX_NOTES`, `MAX_LINK`, `getDb`, `sql`) | `schema.ts`, `index.ts`, `auth.ts`, `validation.ts`, `seed-full.ts` |

### Phase 7 — Infrastructure (partial) ✅
| Fix | Files |
|-----|-------|
| GitHub Actions CI workflow | `.github/workflows/ci.yml` |

## Remaining Work

### High Priority
1. **Transactions (H1)** — Wrap multi-step writes in `db.transaction()`:
   - `WarningService.create()` and `respond()`
   - `AuthService.login()` and `updateProfile()`
   - `UserService.create()`
   - Backend jobs: `checkExpiredWarnings`, `autoRecoverCredit`
2. **N+1 in `NotificationService.createMany()` (H2)** — Batch `isEnabled` check with single query:
   ```sql
   SELECT user_id, notification_type, enabled
   FROM notification_preferences
   WHERE (user_id, notification_type) IN (${...})
   ```

### Medium Priority
3. **KanbanBoard → Zustand stores (H9)** — Migrate from `useState` to `useProjectStore`, `useTaskStore`, `useSubtaskStore`
4. **Centralized error toast (H11)** — Hook into api.ts error interceptor to show toasts globally
5. **Centralized socket event bus (A2)** — `lib/eventBus.ts` to decouple socket events from components

### Low Priority
6. **Split KanbanBoard (A1)** — Extract `ProjectsColumn`, `TasksColumn`, `SubtasksColumn`, `MembersColumn`
8. **Batch `sendDailySummaries` (L8)** — Use `createMany()` instead of loop

## Current Git State
- **Branch:** (not specified — likely main/master)
- **Unstaged changes:** ~40 modified files, 3 untracked (`.github/`, `client/src/hooks/`, new docs)
- **No commits made in this session**

## Commands
```bash
# Full verification at start
cd server && npm run typecheck && npm run lint && npm run test
cd client && npm run typecheck && npm run lint

# Daily dev
start.bat

# Run specific tests
cd server && npm run test
```

## Key Decisions Made This Session
1. **`/subtasks/by-project/:projectId` route** — Created new route + service method with `innerJoin` on `tasks` table, instead of chained API calls
2. **Removed `camelToSnake()` from service returns** — `res.success()` middleware already applies it; socket emits still use it locally
3. **`isFrozen: boolean` in frozenCache** — Changed from ISO string to boolean for clarity
4. **`addMember` default role `'member'`** — Changed from hardcoded `'manager'`; route passes `req.body.role`
5. **`useSocketAuth` hook** — Moved module-level subscription to `useEffect` with cleanup, breaking circular dep
6. **Test schema drift fix** — Added `fromUserId` column to both `test-schema.ts` and `SCHEMA_SQL` instead of mocking `../db/index.js`
7. **`better-sqlite3` moved to devDeps** — Only used in tests; needed `--legacy-peer-deps`

## Architecture Reference
- **DB:** PostgreSQL 16 + Drizzle ORM (pgTable in `schema.ts`)
- **Test DB:** SQLite (better-sqlite3) via `test-schema.ts` + `SCHEMA_SQL`
- **`db.execute()` returns `{ rows, command, rowCount, fields }`** — access `.rows`
- **`res.success()`** applies `camelToSnake()` automatically
- **api.ts interceptor** auto-unwraps `{ success, data }` → `res.data = res.data.data`
- **`erasableSyntaxOnly: true`** — no `public`/`private`/`protected` on constructor params
- **`verbatimModuleSyntax: true`** — requires `.js` in relative imports
