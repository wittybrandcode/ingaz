# Technical Debt Elimination Plan

## Overview
This document tracks all remaining technical debt, bugs, and improvements across the Ingaz codebase. Each item includes priority, effort estimate, and resolution steps.

---

## PRIORITY 1 — Critical (blocks development)

### 1.1 Fix seed-test.ts TypeScript errors
**File:** `server/src/seed-test.ts`
**Errors:**
```
src/seed-test.ts(146,28): error TS7006: Parameter 'u' implicitly has an 'any' type.
src/seed-test.ts(147,26): error TS7006: Parameter 'u' implicitly has an 'any' type.
src/seed-test.ts(316,72): error TS2339: Property 'toString' does not exist on type 'never'.
src/seed-test.ts(347,60): error TS7006: Parameter 'e' implicitly has an 'any' type.
src/seed-test.ts(381,33): error TS2322: Type 'Buffer<ArrayBufferLike>' is not assignable to type 'string'.
```
**Fix:**
1. `lines 146-147`: Add explicit type for `find` callback params
2. `line 316`: Fix `content` type widening (the `taskFiles` entry's 4th element is `Buffer | string` but const inference narrows to `never` when mixing)
3. `line 347`: Add `e` param type
4. `line 381`: `createTextFile` returns `string`, `createAudioFile` returns `Buffer` — use union type for the file template content

### 1.2 Background job timestamp errors
**Files:** `server/src/index.ts` — `checkDeadlines()`, `autoRecoverCredit()`, `checkExpiredWarnings()`
**Symptoms:** `TypeError: value.toISOString is not a function` logged every 60 seconds (caught by `safeInterval`)
**Root cause:** Some timestamp columns in the database contain string values instead of Date objects. Drizzle's `PgTimestamp.mapToDriverValue` expects `Date`.
**Fix:**
1. Add a DB migration/seed fix to convert any string-typed timestamp cells to proper `Date` objects
2. Or: wrap the `update` calls in a try/catch that converts the value at runtime
3. Audit all timestamp columns: `lastCreditRecovery`, `frozenAt`, `createdAt`, `deadline`, etc.

### 1.3 No Git repository
**Path:** `/Bigg/.git` missing
**Impact:** Cannot commit, branch, diff, or track history
**Fix:**
```bash
git init
git add .
git commit -m "init: ingaz task management system"
```

---

## PRIORITY 2 — High (functional bugs)

### 2.1 seed-test.ts file-to-project mapping broken
**File:** `server/src/seed-test.ts:197-198`
**Bug:** `projFiles.indexOf([filename, originalName, content])` uses array reference comparison (always returns `-1`). All files end up under project ID 13.
**Fix:** Replace with explicit index-based or name-based mapping:
```typescript
const projFileMap: [string, number][] = [
  ['project1', 0], ['project1', 0],
  ['project2', 1], ['project2', 1], ['project2', 1],
  ['platform', 2],
]
```
Or simpler: use a parallel array with project index per file.

### 2.2 Duplicate socket + API response race
**File:** `client/src/components/KanbanBoard.tsx`
**Status:** Fixed in handlers (socket + form + loadMore all dedup via `prev.some()`)
**Validation needed:** Confirm no warnings after hard-refresh (Ctrl+F5)

### 2.3 ESLint unavailable
**File:** `client/package.json`, `server/package.json`
**Impact:** `npm run lint` fails with `'eslint' is not recognized`
**Fix:**
```bash
cd client && npm install -D eslint @eslint/js typescript-eslint
cd server && npm install -D eslint @eslint/js typescript-eslint
```
Then create `eslint.config.js` in each.

---

## PRIORITY 3 — Medium (quality & DX)

### 3.1 Server startup: ALLOWED_ORIGINS missing from .env
**File:** `server/.env`
**Warning:** `ALLOWED_ORIGINS غير معرف. سيتم استخدام http://localhost:5173 كقيمة افتراضية.`
**Fix:** Add to `.env`:
```
ALLOWED_ORIGINS=http://localhost:5173
```

### 3.2 SENTRY_DSN not configured
**File:** `server/.env`
**Warning:** `SENTRY_DSN غير معرف. سيتم تخطي تهيئة Sentry.`
**Fix:** Either add to `.env` or suppress the log in non-production.

### 3.3 TiptapEditor: no toolbar in non-minimal mode for link/image buttons in minimal mode
**File:** `client/src/components/TiptapEditor.tsx`
**Note:** The image upload button appears both in minimal (floating) and non-minimal (toolbar) modes — the `fileInputRef` is shared, which is correct. No bug, but worth confirming both paths work.

### 3.4 seed-full.ts has hardcoded SQL strings
**File:** `server/src/seed-full.ts`
**Issue:** Uses raw `INSERT INTO` strings instead of Drizzle ORM. Works but inconsistent with the rest of the codebase.
**Fix (optional):** Refactor to use `db.insert(schema.xxx).values(...)`.

### 3.5 No .gitignore
**File:** missing `.gitignore`
**Impact:** `node_modules/`, `.env`, `logs/`, `uploads/` generated files could be committed.
**Fix:** Create `.gitignore`:
```
node_modules/
.env
*.log
dist/
uploads/*
!uploads/.gitkeep
```

---

## PRIORITY 4 — Low (nice to have)

### 4.1 seed-test.ts uses `fs.writeFileSync` after Drizzle insert
**File:** `server/src/seed-test.ts`
**Issue:** File writes are synchronous, blocking the event loop during seeding. For a one-time script this is acceptable.

### 4.2 Status label localization hardcoded
**File:** `client/src/pages/SubtaskPage.tsx:17-22`
**Issue:** status labels (`open→مفتوحة`, `completed→منفذة`, etc.) are hardcoded in the component
**Fix:** Move to a shared constants file or i18n.

### 4.3 AudioPreview uses `autoPlay`
**File:** `client/src/components/AudioPreview.tsx:47`
**Issue:** `autoPlay` on the `<audio>` element may not work on all browsers (autoplay policies). Consider removing or handling the promise rejection.

### 4.4 FileUpload uses `confirm()` dialog
**File:** `client/src/components/FileUpload.tsx:53`
**Issue:** `confirm('حذف الملف؟')` is synchronous and blocks the main thread. Replace with a proper modal.

---

## Execution Plan

| Step | What | Est. time |
|------|------|-----------|
| 1 | Fix seed-test.ts type errors + file mapping | 20 min |
| 2 | Fix background job timestamp errors | 15 min |
| 3 | Initialize Git + create .gitignore | 5 min |
| 4 | Install ESLint in both projects | 10 min |
| 5 | Configure .env defaults | 5 min |
| 6 | Confirm no duplicate-key React warnings | 5 min |
| 7 | Low-priority cleanups | 30 min |

**Total:** ~90 min
