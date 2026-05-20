# Phase 2: Auth, Transactions & Testing

> Completion date: 2026-05-20

## Problems Addressed

| # | Problem | Files | Fix |
|---|---------|-------|-----|
| 5 | Blacklist DB query bug + no persistence | `server/src/middleware/auth.ts` | Fixed `eq`→`gte` in `isBlacklisted`, store `exp` in seconds consistently, call `persistBlacklist` from `blacklistToken` |
| 6 | No transactions in complex ops | 5 service files | Wrapped 9 multi-table operations in `this.db.transaction()` |
| 10 | Only 43 tests | `server/src/__tests__/middleware.test.ts` | Added 12 new middleware tests (now 55 total) |

## Files Modified

| File | Change |
|------|--------|
| `server/src/middleware/auth.ts` | P5: fixed time units (seconds, not ms), `eq`→`gte`, add `persistBlacklist` call from `blacklistToken`, add `onConflictDoNothing`, fix `cleanupBlacklist` |
| `server/src/services/RoleService.ts` | P6: `updatePermissions` wrapped in transaction |
| `server/src/services/CommentService.ts` | P6: `selectWinner` wrapped in transaction |
| `server/src/services/WarningService.ts` | P6: `sustain` and `clear` wrapped in transactions |
| `server/src/services/SubtaskService.ts` | P6: `update`, `delete`, `addAssignee`, `removeAssignee` wrapped + helper overloads with `tx` param |
| `server/src/services/ProjectService.ts` | P6: `permanentDelete` wrapped in transaction |
| `server/src/__tests__/middleware.test.ts` | P10: new file — 12 tests for authenticate, authorize, checkFrozen, requireCredit, isBlacklisted |
| `server/src/__tests__/helpers.ts` | Added `transaction` polyfill for SQLite test DB |

## Verification

| Check | Result |
|-------|--------|
| Server typecheck | ✅ Passed |
| Client typecheck | ✅ Passed |
| Tests | ✅ **55/55 passed** (auth:6, tasks:16, warnings:21, middleware:12) |

## Key Decisions

1. **Blacklist time units**: Standardized on seconds everywhere (matching JWT's `exp` field). The previous code mixed ms (in-memory Map) with seconds (DB queries), making the DB blacklist check never match.
2. **Transaction overload pattern**: In `SubtaskService`, helper methods `updateTaskStatus`/`updateProjectStatus` now accept an optional `tx` parameter. When called from a transaction block, `tx` is passed; otherwise they use `this.db`.
3. **`.onConflictDoNothing()`**: Added to `persistBlacklist` to prevent duplicate key errors if the same token is blacklisted twice.
