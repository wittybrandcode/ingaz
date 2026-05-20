# Ingaz Client-Side Analysis — Components & Pages

## 📁 Directory Structure

### `client/src/components/`

| Path | Description |
|------|-------------|
| `ProjectDetail/SubtaskPanel.tsx` | Subtask list + create form within project detail |
| `ProjectDetail/TaskList.tsx` | Task list + create form within project detail |
| `AssigneePicker.tsx` | Generic searchable user picker with portal dropdown |
| `AudioPreview.tsx` | Audio file playback overlay |
| `Avatar.tsx` | Avatar display (image or initial-based) + `AvatarWithName` |
| `AvatarStack.tsx` | Stacked overlapping avatar group |
| `Comments.tsx` | Subtask comments with winner selection, real-time socket |
| `ErrorBoundary.tsx` | Class-based error boundary |
| `FilePreview.tsx` | Full-screen file/image preview carousel |
| `FileUpload.tsx` | Multi-file upload with preview, delete, confirmation |
| `KanbanBoard.tsx` | Main kanban board — 4 columns (projects/tasks/subtasks/members) |
| `KanbanColumn.tsx` | Generic scrollable column wrapper |
| `Layout.tsx` | App shell — `<Outlet />`, credit banner, scroll-to-top |
| `MemberCard.tsx` | Member card for kanban member column |
| `NotifBar.tsx` | Notification bar with color theme picker |
| `NotificationBell.tsx` | Bell icon → dropdown, warning response modal |
| `ProgressBar.tsx` | Thin reusable progress bar |
| `ProjectCard.tsx` | Project card for kanban |
| `ProjectSettingsModal.tsx` | Edit/archive/delete project, manage members, CSV export |
| `Skeleton.tsx` | `Skeleton` and `ProjectDetailSkeleton` loading placeholders |
| `StatsPill.tsx` | Small colored stat badge |
| `SubtaskCard.tsx` | Subtask card for kanban (with inline edit, status, context menu) |
| `SubtaskRow.tsx` | Subtask row for project detail (with assignee, attachment grid) |
| `SubtaskSettingsModal.tsx` | Edit/delete subtask, status, assignees |
| `TaskCard.tsx` | Task card for kanban |
| `TaskSettingsModal.tsx` | Edit/delete task, assignees |
| `TiptapEditor.tsx` | Rich text editor (TipTap) with image upload, toolbar |
| `Toast.tsx` | Toast notification system via context |
| `TopBar.tsx` | Top navigation bar with role-based menu, mobile drawer |
| `ViewModal.tsx` | Generic read-only detail modal (project/task/subtask) |

### `client/src/pages/`

| Path | Description |
|------|-------------|
| `Dashboard.tsx` | Analytics dashboard overview |
| `FrozenAccount.tsx` | Frozen account info page |
| `Login.tsx` | Login form with dev test-account picker |
| `NotificationPreferences.tsx` | Per-type notification toggle UI |
| `Profile.tsx` | User profile edit + notification list |
| `ProjectDetail.tsx` | Full project detail view (tasks, subtasks, members) |
| `Projects.tsx` | Wraps `<KanbanBoard>` in `<ErrorBoundary>` |
| `Roles.tsx` | Role CRUD + permission matrix modal |
| `SubtaskPage.tsx` | Dedicated subtask detail page |
| `Users.tsx` | User CRUD table with filters, warning issuance |
| `WarningManagement.tsx` | Admin: warning types, restriction levels, credit scores |
| `WarningsAdmin.tsx` | Admin: issue/resolve/clear warnings |

### `client/src/lib/`

| Path | Description |
|------|-------------|
| `api.ts` | Axios instance with `/api/v1` prefix, JWT interceptor, 401 redirect |
| `exportToCSV.ts` | Generic CSV export with BOM |
| `sanitize.ts` | DOMPurify HTML sanitizer |
| `socket.ts` | Socket.io client with auth, auto-connect via store subscription |
| `useFocusTrap.ts` | Focus-trap hook for modals |

### `client/src/store/`

| Path | Description |
|------|-------------|
| `authStore.ts` | Zustand store (persisted) — user, token, permissions |
| `appStore.ts` | Zustand store — users, roles, projects |

---

## 🧩 Component Architecture

### Patterns

1. **All functional components** — No class components except `ErrorBoundary` (which uses `Component` as required by React).

2. **Zustand for state management** — Two stores:
   - `useAuthStore` — Persisted (`auth-storage` in localStorage), holds `user`, `token`, `permissions`, `loading`, and actions (`login`, `logout`, `loadUser`).
   - `useAppStore` — Non-persisted, holds `users`, `roles`, `projects` with loading/error state.

3. **Axios for HTTP** — Singleton instance with interceptors for JWT injection and 401 handling.

4. **Socket.io for real-time** — `lib/socket.ts` subscribes to the auth store and auto-connects/disconnects. Events: `list:update`, `subtask:updated`, `comment:new`, `comment:winner-selected`, `notification`.

5. **Context for toast** — `ToastProvider` wraps at `Layout.tsx` level, exposes `useToast()` hook.

6. **Focus trap** — Custom `useFocusTrap` hook used in all modals and mobile drawer.

7. **Lazy loading** — All pages are `lazy(() => import(...))` in `App.tsx` with a `Suspense` fallback.

8. **CSS** — Tailwind CSS throughout. No CSS modules or styled-components. Inline `style` props for dynamic colors.

9. **No routing library beyond react-router-dom v6** — Standard `<Routes>`/`<Route>`/`<Outlet>` with `useParams`, `useNavigate`, `useSearchParams`, `useLocation`.

### Key Architecture Decisions

- **KanbanBoard is the core** — `Projects.tsx` wraps it in `ErrorBoundary`. It loads ALL data (projects, tasks, subtasks, users) in parallel with pagination, and manages all selection state.
- **Modal-driven editing** — Settings, view, create — all done via modals rendered conditionally. No route-based editing except dedicated pages.
- **Optimistic updates** — SubtaskPanel and ProjectDetail page use temp IDs and optimistic state updates that roll back on error.
- **Portal for dropdowns** — `AssigneePicker` uses `createPortal` to render its dropdown on `document.body` for correct z-indexing.
- **Shared types** — All interfaces live in `shared/types.ts`, imported in both client and server.

---

## 📄 Page Analysis

### `Dashboard.tsx`
- Fetches `/analytics/dashboard` on mount.
- Renders: summary cards (4), status distribution bar chart, project progress bars, user performance, recent activity.
- Includes CSV export.
- **Clean separation** — compact, one `useEffect`, clear error/loading states.

### `Login.tsx`
- Simple form with email/password, toggle password visibility.
- Dev-only test account `<select>` with hardcoded credentials (20+ users).
- Redirects to `/frozen` if `user.frozen_at` is set.
- **Security concern**: test credentials visible in source in dev mode, but acceptable for dev.

### `ProjectDetail.tsx`
- Fetches project data + lazy-loads subtasks on task selection.
- Uses `AbortController` refs to cancel stale requests.
- Socket listeners for real-time updates on subtasks and list items.
- Optimistic task creation with temp ID.
- Breadcrumb navigation, inline description editing via Tiptap, member management, file upload.
- **One of the most complex pages** — 268 lines, 9 `useState` calls, but well-structured.

### `Projects.tsx`
- Single-line wrapper: `<ErrorBoundary><KanbanBoard /></ErrorBoundary>`.

### `Users.tsx`
- Table with search + role/status filters.
- Inline editing (name, email, role, status).
- Warning-issuance modal with preset reasons.
- Archive/restore user.
- **Handles all CRUD in one file** — 324 lines, but well organized with `useMemo` for filtering.

### `WarningsAdmin.tsx`
- Tab-filtered list of warnings (all/pending/responded/cleared).
- Issue warning form, clear/sustain buttons, frozen users hover card.
- Good use of `useSearchParams` for tab state.

### `WarningManagement.tsx`
- Three tabs: warning types CRUD table, restriction level editor (with per-permission toggles), credit score table.
- Edit-in-place for types; checkbox-based level editing.

### `Roles.tsx`
- Role cards with inline name editing, delete, and permission management modal.
- Permission modal uses grouped collapsible sections with checkboxes.
- Prevents modification of default roles (`ADMIN`, `DEPUTY`, `EMPLOYEE`).

### `SubtaskPage.tsx`
- Dedicated subtask view with breadcrumb, assignees, description (sanitized HTML), file attachments (image/audio/file thumbnails), and embedded `<Comments />`.
- Socket listener for real-time subtask updates with debounce.

### `Profile.tsx`
- Avatar upload via file input + FormData.
- Name + password update form.
- Notification list with mark-read.

### `NotificationPreferences.tsx`
- Grouped toggleable notification types with expand/collapse.

### `FrozenAccount.tsx`
- Informational page — shows freeze reason, user details, warning list.
- Logout button.

---

## 🛣️ Routing (`App.tsx`)

```
/login          → Login
/frozen         → FrozenAccount
/               → ProtectedRoute → Layout → <Outlet>
  /             → Navigate → /projects
  /dashboard    → Dashboard
  /projects     → Projects (KanbanBoard)
  /projects/:id → ProjectDetail
  /subtasks/:id → SubtaskPage
  /users        → AdminRoute → Users
  /roles        → AdminRoute → Roles
  /warnings     → AdminRoute → WarningsAdmin
  /warnings/manage → AdminRoute → WarningManagement
  /profile      → Profile
  /notifications/preferences → NotificationPreferences
```

- **ProtectedRoute**: checks `loading` → shows spinner, then `user` → redirect to `/login`, then `frozen_at` → redirect to `/frozen`.
- **AdminRoute**: checks `role_id === ROLES.ADMIN` → redirect to `/dashboard`.
- All pages lazy-loaded.
- 401 interceptor in `api.ts` clears token and redirects to `/login`.

---

## ✅ Strengths

1. **Clean separation of concerns** — Components are small, focused, single-responsibility (e.g., `ProgressBar.tsx` at 27 lines, `StatsPill.tsx` at 26 lines).

2. **Real-time architecture** — Socket.io integration is well-done: auto-connect via store subscription, granular events, debounced reloads.

3. **Optimistic updates** — SubtaskPanel and ProjectDetail use temp IDs and optimistic state that rolls back on failure, providing instant UI feedback.

4. **Error handling** — Pages have loading/error/empty states. Axios interceptor handles 401 globally. ErrorBoundary wraps the KanbanBoard.

5. **Focus management** — Custom `useFocusTrap` hook used consistently in all modals and the mobile drawer.

6. **Sanitization** — `DOMPurify` used in `sanitize.ts` before rendering HTML from Tiptap content. Mitigates XSS from rich text input.

7. **Modal pattern** — Consistent: fixed overlay → white card with `fadeUp` animation → `useFocusTrap` → close on backdrop/escape. All settings modals follow the same layout pattern.

8. **TypeScript usage** — Full typing of props, API responses, and store state. Shared types between client and server in `shared/types.ts`.

9. **CSV export** — Utility function (`exportToCSV.ts`) with BOM for Arabic Excel compatibility.

10. **Optimized rendering** — `React.memo` on `SubtaskRow` and `MemberCard`. `useMemo` for filtered lists. Socket listeners use refs to avoid stale closures.

11. **Consistent loading UX** — Skeleton components, spinner, inline "جاري..." text on buttons during loading.

12. **RTL support** — All text is Arabic, breadcrumbs use `ArrowRight`, file preview arrows respect `document.dir`.

---

## ❌ Weaknesses / Problems Found

### Critical Issues

#### 1. No request deduplication for app store
**File**: `store/appStore.ts` — `loadUsers`, `loadRoles`, `loadProjects`
**Problem**: `loadUsers()` is called imperatively from multiple components (`ProjectSettingsModal.tsx:44`, `ProjectDetail.tsx:64`, `Users.tsx:74`, `WarningsAdmin.tsx:39`). Every page mount triggers a separate API call, even if another component already fetched the data. No caching/cooldown mechanism.
**Impact**: Unnecessary network requests, potential race conditions.

#### 2. No pagination on `loadUsers` / `loadRoles`
**File**: `store/appStore.ts:32-46`
**Problem**: `loadUsers` calls `GET /users` with no pagination params. `loadRoles` calls `GET /roles` without params. If the user base grows large, this will degrade.
**Impact**: Scalability issue.

#### 3. Empty `loading` never set to false on error
**File**: `store/appStore.ts:37`
**Problem**: In the `catch` block, `usersLoading` is set to `false` correctly, but `loadRoles` on line 45 does the same — OK here. But `loadProjects` on line 53 has the same pattern — also OK. However, **`authStore.ts:30`** in the `catch` of `loadUser` sets `loading: false` correctly. So this is actually fine.

Let me re-check: `authStore.ts:29-31` — `catch { set({ loading: false }) }` — correct.

#### 4. Potential memory leak — `AbortController` refs not cleaned up
**File**: `pages/ProjectDetail.tsx:38-39, 56-59, 75-78`
**Problem**: `abortRef` and `subtaskAbortRef` are manually aborted before new requests, but if a component unmounts during an in-flight request, the controller is never aborted. The effect cleanup doesn't abort.
**Impact**: Potential "setState on unmounted component" warning.

#### 5. `dangerouslySetInnerHTML` with potentially incomplete sanitization
**Files**: `ViewModal.tsx:37`, `ProjectDetail.tsx:196`, `ProjectSettingsModal.tsx:169`, `SubtaskSettingsModal.tsx:175`, `TaskSettingsModal.tsx:128`, `SubtaskPage.tsx:132`, `Comments.tsx:144`
**Problem**: The `sanitize.ts` allows `'class'` as an allowed attribute (`ALLOWED_ATTR: ['href', 'target', 'class', 'src', 'alt']`). This means user-controlled HTML can inject arbitrary CSS classes, which could be used for CSS-based data exfiltration or styling attacks.
**Impact**: Low-severity XSS vector through class manipulation.

#### 6. `socket.ts` — global singleton with no disconnect on logout edge case
**File**: `lib/socket.ts:27-39`
**Problem**: The store subscription checks `state.user.id !== prevUserId`, but if a user logs in with the same ID as before (re-login), `prevUserId` won't change, so `socket.connect()` and `join:user` won't be re-emitted.
**Impact**: Room membership could be stale on re-login as same user.

### Moderate Issues

#### 7. Duplicate `statusConfig` definitions
- `SubtaskCard.tsx:15-21` defines status config for kanban subtask cards
- `SubtaskPanel.tsx:9-11` defines a `StatusConfig` interface (type only)
- `ProjectDetail.tsx:24-30` defines another status config
- `SubtaskPage.tsx:17-22` defines yet another
- `WarningsAdmin.tsx:58-64` defines warning status config
- `ViewModal.tsx:21-28` defines status labels + colors
**Impact**: Changing a status means updating 6 different places. High maintenance burden.

#### 8. Hardcoded URL patterns
**Files throughout**
**Problem**: URLs are built with string concatenation everywhere: `/projects/${project.id}/members`, `/subtasks/${subtaskId}/assignees`, `/uploads/${file.filename}`, etc. No centralized URL constants or API client methods.
**Impact**: Changing an endpoint requires searching across files.

#### 9. `useAppStore` prop drilling for `users` and `roles`
**Files**: `ProjectSettingsModal.tsx`, `TaskSettingsModal.tsx`, `SubtaskSettingsModal.tsx`, `ProjectDetail.tsx`
**Problem**: These components access `users` and `roles` directly from the global store, instead of receiving them as props. This couples them to the global store and makes testing harder.
**Impact**: Components are not reusable outside the app context.

#### 10. `confirm()` dialogs for destructive actions
**Files**: Many — `ProjectSettingsModal.tsx:58`, `SubtaskSettingsModal.tsx:75`, etc.
**Problem**: Uses the native `confirm()` dialog for delete/archive confirmations. Blocking, unstyled, and non-customizable. Better to use a custom confirm dialog.
**Impact**: Poor UX — unstyled, blocks the main thread.

#### 11. Test credentials exposed in production-adjacent code
**File**: `Login.tsx:76-121`
**Problem**: The dev test-account select is gated by `import.meta.env.DEV`, which is fine. But the credentials are hardcoded in the component. If `import.meta.env.DEV` is ever misconfigured, they'd leak to production.
**Impact**: Minor — good practice to move to env variables.

#### 12. Inline event handlers in JSX (performance)
**Files**: Many — `KanbanBoard.tsx:272` has inline `onSubmit`, `SubtaskCard.tsx:89-93` has inline click handlers, etc.
**Problem**: Many handlers are defined inline in JSX as arrow functions (e.g., `onClick={() => doSomething()}`). This creates new function references on every render.
**Impact**: Minor — `React.memo` on `SubtaskRow` and `MemberCard` is partially defeated by inline handlers on parent components.

#### 13. No error boundaries beyond KanbanBoard
**File**: `App.tsx` — only `Projects.tsx` uses `<ErrorBoundary>`. Other pages have no error boundary.
**Impact**: A crash on Dashboard, Users, etc. would show a blank page or unhandled error.

#### 14. Mixed CSS — Tailwind + inline styles
**Files**: Many
**Problem**: The app mixes Tailwind classes with inline `style={{}}` for dynamic colors. This works but makes it hard to maintain a consistent theme. The inline styles reference hardcoded hex values that duplicate what could be Tailwind config values.

#### 15. `NotificationBell.tsx` — polls every 2 minutes as fallback
**File**: `NotificationBell.tsx:78-81`
**Problem**: If socket disconnects, it falls back to polling `GET /notifications` every 2 minutes. Good for reliability, but no cleanup of interval if component unmounts during polling. Also, the interval is set once on mount but `load` is captured in closure.
**Impact**: Potential memory leak (minor — the interval will be cleared on unmount via the effect return).

#### 16. Over-fetching in `handleExportCSV` (ProjectSettingsModal)
**File**: `ProjectSettingsModal.tsx:82-87`
**Problem**: Exporting CSV makes N+1 API calls — one for tasks, then one per task for subtasks. For a project with 50 tasks, that's 51 requests.
**Impact**: Slow export for large projects.

#### 17. `ViewModal.tsx` — `SubtaskView` fetches attachments inside the modal
**File**: `ViewModal.tsx:144-150`
**Problem**: Each time a subtask view modal opens, it triggers a new API call for attachments. No caching for repeated views.
**Impact**: Unnecessary network requests.

---

## 🎯 Recommendations

### High priority

1. **Centralize API constants** — Create an `api/endpoints.ts` or similar with URL builders: `projectMembers(id)`, `subtaskAssignees(id)`, etc. Eliminates string concatenation everywhere.

2. **Unify `statusConfig`** — Extract to `shared/statusConfig.ts` shared between client and server. Single source of truth for task/subtask/warning status definitions.

3. **Replace `confirm()` dialogs** — Build a lightweight `<ConfirmDialog>` modal component with promise-based API (e.g., `await confirm('هل أنت متأكد؟')`).

4. **Add error boundary** — Wrap the `<Routes>` or `<Layout>` in `ErrorBoundary` to catch crashes on any page.

5. **Safe request cancellation on unmount** — Add `useEffect` cleanup in `ProjectDetail.tsx` to abort in-flight requests on unmount.

### Medium priority

6. **API layer abstraction** — Instead of calling `api.get(...)` directly in components, create service modules (e.g., `services/projectService.ts`, `services/userService.ts`) that handle URL construction, error normalization, and caching.

7. **Store-based caching for app data** — Add a "last fetched" timestamp or TTL to `useAppStore` actions to avoid redundant `loadUsers()` calls from multiple components.

8. **Reduce N+1 in CSV export** — Either add a server-side export endpoint or use a batch subtask endpoint.

9. **Extract inline handlers** — For list items (cards, rows), wrap handlers in `useCallback` and pass stable references to child components using `React.memo`.

10. **Pagination for `loadUsers`** — Add pagination support to the users endpoint and the store, at least server-side.

### Low priority

11. **Centralize theme colors** — Define the dynamic colors (status colors, priority colors) in Tailwind config or CSS variables instead of inline hex values.

12. **Normalize socket room management** — Ensure `socket:join:user` is re-emitted on re-login by checking token change, not just user ID.

13. **Narrow DOMPurify `ALLOWED_ATTR`** — Remove `'class'` from allowed attributes unless specific use cases require it.

14. **Move test credentials** — Move dev login credentials to an environment variable or JSON file, keeping the component clean.

15. **Consolidate modal patterns** — The three settings modals (`ProjectSettingsModal`, `TaskSettingsModal`, `SubtaskSettingsModal`) share ~70% structural code (header, footer, attachment grid, assignee picker). Extract a common `SettingsModal` layout wrapper.

---

## Summary

The client codebase is **well-structured and production-quality** with strong patterns:

- Functional components with hooks
- Zustand for global state
- Axios + Socket.io for API/real-time
- Consistent lazy-loading, error states, and optimistic updates
- RTL-first Arabic interface
- Clean separation of reusable UI primitives

**Main risks**: Duplicated status configurations, N+1 API patterns, missing error boundaries on most pages, and native `confirm()` dialogs. None are blockers, but addressing them would significantly improve maintainability and UX.
