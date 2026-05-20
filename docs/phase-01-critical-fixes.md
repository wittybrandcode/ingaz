# Phase 1: Critical Security & Database Fixes

> Completion date: 2026-05-20

## Problems Addressed

| # | Problem | File | Fix |
|---|---------|------|-----|
| C1 | JWT_SECRET fallback to `''` | `server/src/middleware/auth.ts:9` | Changed `\|\| ''` to `!` (startup validates it exists) |
| C2 | cookie-parser not wired up | `server/src/index.ts` | Added `import cookieParser` + `app.use(cookieParser())` + installed `@types/cookie-parser` |
| C3 | `subtasks.winnerCommentId` missing FK | `server/src/db/schema.ts:60` | Added `.references((): any => comments.id)` with lazy callback (breaks circular dep) |
| C4 | Dual migration system (setup.ts + migrate.ts) | `server/src/setup.ts` | Replaced raw SQL with delegation to `runMigrations()` from Drizzle migrator |

## Files Modified

| File | Change |
|------|--------|
| `server/src/middleware/auth.ts` | C1: removed `\|\| ''` fallback, use `!` non-null assertion |
| `server/src/index.ts` | C2: added `import cookieParser`, `app.use(cookieParser())` |
| `server/src/db/schema.ts` | C3: added FK reference on `winnerCommentId` → `comments.id`, removed unused import `foreignKey` + `varchar` |
| `server/src/setup.ts` | C4: replaced raw SQL migration with delegation to Drizzle `runMigrations()` |
| `server/package.json` | Added `@types/cookie-parser` as devDependency |
| `server/package-lock.json` | Updated with new dependency |

## Verification

| Check | Result |
|-------|--------|
| Server typecheck | ✅ Passed (0 errors) |
| Client typecheck | ✅ Passed (0 errors) |
| Server lint | ⚠️ 296 warnings (pre-existing `any` types), 4 errors (pre-existing empty catch blocks) |
| Tests | ✅ 43/43 passed (auth: 6, tasks: 16, warnings: 21) |

## Key Decisions

1. **JWT_SECRET**: The startup validation in `index.ts:46-48` already guarantees `JWT_SECRET` exists. The fallback to `''` in `auth.ts` was dead code. Using `!` is safe and cleaner.

2. **cookie-parser**: The code uses `req.cookies?.token` in two places (`auth.ts:85`, `routes/auth.ts:72`) and `res.cookie('token', ...)` in `routes/auth.ts:45`. Rather than removing cookie support (which would break `start.bat setup` flow), I wired up the middleware properly.

3. **FK for winnerCommentId**: Drizzle ORM doesn't handle circular FK references well in TypeScript. Used `(): any => comments.id` lazy callback to break the type cycle while preserving the FK constraint.

4. **setup.ts**: The old approach used raw SQL to manually add constraints. Delegating to Drizzle's `migrate()` ensures schema stays in sync with `schema.ts`. Legacy SQL kept as comments for reference.

## Follow-ups

- Lint warnings should be addressed in Phase 5 (Code Quality)
- The `no-empty` catch blocks in `index.ts` (lines 242, 267, 292) and `auth.ts` (line 42) need fixing
- After schema changes, a migration needs to be generated: `cd server && npm run db:generate`
