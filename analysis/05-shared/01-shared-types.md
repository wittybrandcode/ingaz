# 📦 Shared Types Analysis

## Overview

The shared types live in `shared/types.ts` — a single-file module re-exported by both client and server via the `@shared/types` path alias.

### Interface Catalog

| Interface | Lines | Key Fields | Extends |
|-----------|-------|------------|---------|
| `User` | 3–15 | id, name, email, role_id, role_name, avatar, status, frozen_at?, freeze_reason?, credit_score?, warnings? | — |
| `Project` | 17–30 | id, title, description, created_by, status, tasks_count, subtasks_count?, completed_count?, members?[] | — |
| `ProjectMember` | 32–43 | id, project_id, user_id, role ('manager'\|'member'), name, email, avatar, role_id, role_name | — |
| `Assignee` | 45–57 | id, task_id?, subtask_id?, user_id, assigned_by, name, email, avatar, role_id, role_name | — |
| `ProjectDetail` | 59–62 | tasks: Task[], members: ProjectMember[] | `Project` |
| `Task` | 64–76 | id, title, description, subtasks_count, completed_count, status, assignees?[] | — |
| `Subtask` | 78–91 | id, task_id, title, description, assigned_to, status, deadline, winner_comment_id?, assignees?[] | — |
| `Comment` | 93–104 | id, subtask_id, user_id, content, is_winner?, created_at | — |
| `Attachment` | 106–117 | id, filename, original_name, mime_type, file_size, uploaded_by?, entity_type?, entity_id? | — |
| `Warning` | 119–138 | id, user_id, issued_by, reason, status, points_deducted?, credit_before?, credit_after? | — |
| `WarningType` | 140–146 | id, name, description?, points, is_active | — |
| `RestrictionLevel` | 148–164 | id, name, name_ar, min_score, color, icon, can_login, can_create_projects, can_create_tasks, … | — |
| `Role` | 166–170 | id, name, permissions?[] | — |
| `Notification` | 172–184 | id, user_id, title, message, type, read, related_type?, related_id?, **related: any** | — |
| `DashboardData` | 186–192 | counts, status_distribution[], recent_activity[], project_progress[], tasks_by_user[] | — |

### Constants

```typescript
// shared/types.ts:194-200
export const ROLES_VALUES = { ADMIN: 1, DEPUTY: 2, EMPLOYEE: 3 } as const
export const ROLES = ROLES_VALUES  // alias
export const STATUS_LABELS: Record<string, string> = { /* Arabic labels */ }
```

---

## 🔗 Cross-Boundary Usage

### Client → Server Flow

```
shared/types.ts
      │
      ├── @shared/types     ← Vite alias resolves to ../shared (client/vite.config.ts:8)
      │     └── client/src/types/index.ts  ← re-exports all + adds client-only types
      │           ├── AuthState
      │           ├── SubtaskData (extends Subtask)
      │           ├── CreditUser
      │           ├── Permission
      │           ├── Comment (client-specific, snake_case)
      │           ├── FreezeStatus
      │           └── NotifType
      │
      └── @shared/types     ← tsconfig paths alias (client/tsconfig.json:20)
            └── client/tsconfig.json includes "../shared" in its `include`
```

**Client tsconfig** (`client/tsconfig.json`):
```json
{
  "include": ["src", "../shared"],
  "compilerOptions": {
    "paths": { "@shared/*": ["../shared/*"] }
  }
}
```

**Server tsconfig** (`server/tsconfig.json`):
```json
{
  "include": ["src"]  // does NOT include ../shared
}
```

The server does **not** import from `@shared/types` directly — it imports from `../shared/types.ts` manually in route files that use shared types, or uses its own Drizzle ORM schema types. The `client/src/types/index.ts` is purely a client-side adapter.

### Express Request Augmentation

`server/src/types/express.d.ts` adds to `express-serve-static-core`:

```typescript
declare module 'express-serve-static-core' {
  interface Response {
    success(data: any, status?: number): void
    fail(status: number, error: string): void
  }
  interface Request {
    user: { id: number; email: string; name: string; avatar?: string | null; role_id: number }
  }
}
```

> **Note:** The server route handler files use `res.success()` / `res.fail()` pervasively. The augmentation is at `server/src/types/express.d.ts` — **not** at `server/src/routes/types.d.ts` (that path does not exist).

---

## ⚠️ Type Issues

### 1. `Notification.related: any` (line 182–183)
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
related: any
```
The `related` field is typed as `any` with an ESLint suppression. It should be a union of related entity types or a proper generic. The `NotificationService.list()` enriches notifications with the related entity, but the consumer must cast.

### 2. `ProjectMember.role` type vs. reality
```typescript
role: 'manager' | 'member'
```
Only `'manager'` is ever inserted (`ProjectService.addMember` line 320). The `'member'` variant is declared but never used.

### 3. `Task.status` enum completeness
```typescript
status: 'active' | 'open' | 'in_progress' | 'completed' | 'archived'
```
The `SubtaskService` sets `'completed'` and `'in_progress'` on tasks (lines 50–51, 207–208), but `TaskService.list()` filters out only `'archived'` (line 19). The `'active'` status appears in the type but is never set by the service — tasks are created without a status, so they default to whatever the DB column default is. This is a **runtime** vs **type** mismatch.

### 4. `Subtask.status` vs DB status checks
```typescript
status: 'open' | 'completed' | 'cancelled' | 'deferred'
```
The `SubtaskService.checkDeadlines` background job (in `server/src/index.ts:226`) uses `sql` conditions filtering out `'approved'` and `'rejected'` — statuses not in the shared type at all. These appear to be dead conditions or a future feature.

### 5. Server uses `any` extensively
All services use `any` for Drizzle query results despite having access to the DB schema types. Examples:
- `SubtaskService.ts:297` — `const [oldSubtask] = await this.db.select().from(...)` → typed as `any`
- `TaskService.ts:173` — same pattern
- `ProjectService.ts:170` — same pattern

### 6. No shared `tsconfig.json`
The `shared/` directory has no `tsconfig.json`. The client includes it in `include`, but the server does not. This means:
- Server files that import `../shared/types.ts` get type-checked via the server tsconfig (which includes `"src"` — the import is resolved, but the shared directory itself has no compilation context)
- There's no strict mode enforcement on the shared types independently

### 7. Client-side `Comment` duplicates shared `Comment`
The client defines its own `Comment` type (`client/src/types/index.ts:34–39`) with **snake_case** fields (`subtask_id`, `user_id`, etc.), while the shared `Comment` in `shared/types.ts:93–104` uses **camelCase** (`subtaskId`, `userId`). This is confusing — the client's Comment represents the API response shape (after `camelToSnake` transform), while the shared Comment represents the canonical model. They should be aligned or one should be removed.

### 8. `Assignee` field naming inconsistency
```typescript
// shared/types.ts:45-57
interface Assignee {
  id: number
  task_id?: number
  subtask_id?: number
  user_id: number   // ← snake_case
  assigned_by: number | null  // ← snake_case
  ...
}
```
This uses snake_case while other types use camelCase. This is likely because it mirrors the DB column names directly rather than being transformed by `camelToSnake()`.

### 9. No `PaginatedResponse<T>` generic
Every list endpoint returns `{ data, total, pages, page, pageSize }` manually. There is no shared generic type for paginated responses, leading to duplication across services.

---

## 💡 Recommendations

| Issue | Severity | Suggestion |
|-------|----------|------------|
| `related: any` | Medium | Replace with a discriminated union or generic `<T>` |
| `ProjectMember.role` | Low | Drop `'member'` from the union if not planned |
| `Task.status` gaps | Medium | Ensure all statuses that the DB/ORM sets are in the union; add `'in_progress'` to initial create or set a default |
| `any` in services | Medium | Use Drizzle's `typeof` inference or explicit row types |
| Shared tsconfig | Low | Add `shared/tsconfig.json` with `"composite": true` for project references |
| Duplicate `Comment` | High | Remove the client-side `Comment` type; unify field casing convention |
| `Assignee` snake_case | Low | Convert to camelCase to match other canonical types |
| Pagination generic | Medium | Add `PaginatedResponse<T> { data: T[]; total: number; pages: number; page: number; pageSize: number }` |
