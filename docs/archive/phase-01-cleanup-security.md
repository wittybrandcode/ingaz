# Phase 1: إصلاحات أمنية حرجة + أعطال

> Completion date: 2026-05-27

## Problems Addressed

| # | Problem | File | Fix |
|---|---------|------|-----|
| C2 | `.run()` on PostgreSQL — all deadlines silently fail | `DeadlineService.ts:106` | Removed `.run()`, improved `tryInsert` to log errors |
| C3 | `PUT /subtasks/:id` no `authorizePermission` | `subtasks.ts:62` | Added `authorizePermission('subtasks.edit'), requireCredit('canEdit')` |
| C4 | 6 endpoints missing `checkFrozen` | `tasks.ts:56,65,71`, `subtasks.ts:67,76,82` | Added `checkFrozen` to all mutation endpoints |
| C5 | XSS in ViewModal — `dangerouslySetInnerHTML` no sanitize | `ViewModal.tsx:37` | Added `sanitizeHTML(text)` |
| C6 | XSS via `sanitize.ts` — `javascript:` URLs allowed | `sanitize.ts` | Added `ALLOWED_URI_REGEXP` |
| C10 | AssignModal assigns to wrong entity type | `AssignModal.tsx:26` | Conditional endpoint + new route/service `listByProject` |
| C12 | `seed-full.ts` duplicate role ID (deputy=employee=2) | `seed-full.ts:52` | Changed employee ID to 3 |

## Files Modified

| File | Change |
|------|--------|
| `server/src/routes/subtasks.ts` | C3: added `authorizePermission('subtasks.edit'), requireCredit('canEdit')` to PUT handler; C4: added `checkFrozen` to DELETE, POST assignees, DELETE assignees; created `GET /by-project/:projectId` route |
| `server/src/services/SubtaskService.ts` | Added `listByProject(projectId)` method — joins `subtasks` → `tasks` on `projectId` |
| `server/src/services/DeadlineService.ts` | C2: removed `.run()`; improved `tryInsert` `catch` to log error |
| `server/src/seed-full.ts` | C12: changed `INSERT INTO roles (id, ...) VALUES (2, 'employee')` → `(3, 'employee')` |
| `client/src/components/ViewModal.tsx` | C5: added `sanitizeHTML` import, wrapped `dangerouslySetInnerHTML` value |
| `client/src/lib/sanitize.ts` | C6: added `ALLOWED_URI_REGEXP` to `DOMPurify.sanitize` options |
| `client/src/components/AssignModal.tsx` | C10: conditional endpoint — `tasks/project/:id` vs `subtasks/by-project/:id` |

## Verification

| Check | Result |
|-------|--------|
| Server typecheck | ✅ 0 errors |
| Client typecheck | ✅ 0 errors |
| Server lint | ✅ 0 errors, 460 warnings (baseline: `no-explicit-any` + unused-vars) |
| Client lint | ✅ 0 errors, 27 warnings (baseline) |
| Tests | ✅ 84/95 pass — 11 failures are pre-existing (`from_user_id` missing in test schema, Phase 2 target) |

## Key Decisions

1. **New `/subtasks/by-project/:projectId` route**: The CLEANUP-PLAN referenced a non-existent route. Created a proper `listByProject` service method using `innerJoin` with `tasks` table on `projectId`. This avoids chained API calls (fetch tasks → fetch subtasks by task IDs).

2. **`tryInsert` error logging**: The CLEANUP-PLAN recommended adding `console.error` instead of silent `catch {}`. This helps debugging without changing behavior (still returns `false` on failure).

3. **checkFrozen ordering**: Kept `checkFrozen` after `authenticate` (must have user) and after/before `authorizePermission` as appropriate for each route context.

4. **Route ordering in subtasks.ts**: Placed `by-project/:projectId` before `/:id` to avoid Express route parameter collision.

## Follow-ups

- Phase 2: Fix test schema drift (`from_user_id`), NotificationService `RETURNING` bugs, dependency injection cleanup
- Phase 2: Fix `hasPermission()` called without `userId` (C13) — SubtaskService.ts:270,351
