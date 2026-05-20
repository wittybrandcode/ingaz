# 🧪 Testing Analysis — Ingaz Server

## 🧪 Test Framework

- **Framework:** [Vitest](https://vitest.dev) v4.1.6
- **Config:** `server/vitest.config.ts` — `globals: true`, `environment: 'node'`, pattern `src/__tests__/**/*.test.ts`
- **Run:** `npm run test` (vitest run) / `npm run test:watch` (vitest watch)
- **HTTP assertions:** `supertest` v7.2.2 + `@types/supertest` available in devDependencies but not used in current tests
- **DB:** In-memory SQLite via `better-sqlite3` + `drizzle-orm/better-sqlite3` for test isolation

## 📋 Test Suite Details

### 3 test files, 43 tests total

| File | Tests | Coverage |
|------|-------|----------|
| `src/__tests__/auth.test.ts` | 6 | AuthService: login (valid/wrong password/non-existent/inactive user), me (valid/invalid id) |
| `src/__tests__/tasks.test.ts` | 16 | TaskService (6) + SubtaskService (10): CRUD, role gating (ADMIN/DEPUTY/EMPLOYEE), HTML sanitization, pagination, status transitions, 404 handling |
| `src/__tests__/warnings.test.ts` | 21 | WarningService: warning types CRUD (4), restriction levels (2), credit scores (2), warning lifecycle create/respond/clear/sustain (7), freeze/unfreeze (4), pagination (2) |

### Pattern

All tests use a shared `createTestDb()` helper that creates an in-memory SQLite DB with a full schema, seed data (roles, restriction levels, warning types). Tests use `vi.mock()` extensively to mock:

- `../db/index.js` — replaces schema + helper functions (`isProjectManager`, `getTaskAssignees`, etc.)
- `../middleware/auth.js` — replaces `authenticate`, `authorize`, `checkFrozen`, `requireCredit` with no-op pass-through
- `../notify.js` — replaces notification functions with `vi.fn()`

Two test utility files exist alongside tests:
- **`__tests__/helpers.ts`**: `createTestDb()`, `seedUser()`, `seedProject()`, `seedTask()`, `seedSubtask()`, `seedProjectMember()`, `generateToken()`
- **`__tests__/test-schema.ts`**: Full SQLite Drizzle schema mirroring `db/schema.ts` for test DB isolation

## ✅ Test Coverage Assessment

| Area | Status | Details |
|------|--------|---------|
| **Auth** | ✅ Basic | Login flow (success, wrong password, missing user, inactive user), me endpoint |
| **Auth** | ❌ Missing | Token expiry, refresh, blacklist, password change, avatar upload, logout |
| **Task CRUD** | ✅ Good | Create with role gating (ADMIN/DEPUTY/EMPLOYEE ± membership), list, listByProject, HTML sanitization |
| **Task CRUD** | ❌ Partial | No update tests, no archive/delete tests, no assignee tests |
| **Subtask CRUD** | ✅ Good | Create with role gating, status transitions (open→cancelled, open→deferred→open, invalid), listByTask, getById 404, delete |
| **Subtask CRUD** | ❌ Partial | No update tests for title/description/assignee, no assignee management |
| **Warnings** | ✅ Comprehensive | Types CRUD, levels CRUD, credit scores, warning lifecycle (create→respond→clear/sustain), freeze/unfreeze, pagination |
| **Projects** | ❌ Missing | No project tests at all |
| **Comments** | ❌ Missing | No comment tests at all |
| **Notifications** | ❌ Missing | No notification tests at all |
| **Users** | ❌ Missing | No user CRUD tests |
| **Roles/Permissions** | ❌ Missing | No role or permission tests |
| **Uploads** | ❌ Missing | No file upload tests |
| **Analytics** | ❌ Missing | No analytics tests |
| **API Integration** | ❌ Missing | No HTTP-level tests (supertest available but unused) |
| **Middleware** | ❌ Missing | No unit tests for auth middleware (authenticate, authorize, checkFrozen, requireCredit) |
| **Background jobs** | ❌ Missing | No tests for deadline reminders, credit recovery, expired warnings |

## ⚠️ Testing Gaps

1. **No integration/API tests** — `supertest` is installed but never used. All tests mock express middleware to pass-through, meaning nothing tests the actual middleware chain, route wiring, or error handling paths.

2. **No project tests** — `ProjectService` (2nd most important service) has zero test coverage.

3. **No middleware unit tests** — `authenticate`, `authorize`, `checkFrozen`, `requireCredit`, `authorizePermission`, `errorHandler` are never tested directly.

4. **No notification tests** — `NotificationService` (notification preferences, daily summary, batch updates) has no coverage.

5. **No user tests** — `UserService` (create/update/archive/restore) has no coverage.

6. **No file upload tests** — `UploadService` and the multer middleware are untested.

7. **No analytics tests** — `AnalyticsService.dashboard()` is untested.

8. **Heavy mocking** — All tests mock `../middleware/auth.js` to pass-through, which bypasses the actual security gating (JWT verification, credit checks, frozen checks). The role-gating tests use `mockIsProjectManager` which is set per-test, meaning the tests verify the service layer logic but not the middleware integration.

9. **No E2E tests** — No end-to-end or Playwright/Cypress tests exist.

10. **No test coverage reporting** — No `c8`, `istanbul`, or `@vitest/coverage` configuration.

## 💡 Recommendations

1. **Add ProjectService tests** — Start with the same pattern (in-memory SQLite, service-level tests) for `ProjectService.list`, `create`, `update`, `archive`, `permanentDelete`, `getMembers`, `addMember`, `removeMember`.

2. **Add middleware unit tests** — Test `authenticate` with valid/missing/expired/blacklisted tokens, `authorize` with correct/wrong roles, `checkFrozen` with frozen/normal users, `requireCredit` with different credit levels.

3. **Add integration tests with supertest** — Spin up the express app with a test DB and hit actual HTTP endpoints. This would catch route wiring, middleware ordering, and error handling issues.

4. **Add notification tests** — `list`, `unreadCount`, `markRead`, `markAllRead`, `getPreferences`, `updatePreference`, `updateBatchTypes`.

5. **Add user service tests** — Create/update/archive/restore with role gating.

6. **Configure coverage** — Add `@vitest/coverage-v8` and set coverage thresholds in `vitest.config.ts`.

7. **Test background jobs** — The `checkDeadlines()`, `autoRecoverCredit()`, and `checkExpiredWarnings()` functions in `index.ts` are complex enough to warrant dedicated tests.

8. **Add edge case tests** — Deadlines, date parsing, concurrent operations, large payloads.

9. **Separate test helpers** — The massive SQL schema string in `helpers.ts` could be extracted to its own file for maintainability.

10. **Add CI test job** — Run tests as a required step in any CI pipeline.
