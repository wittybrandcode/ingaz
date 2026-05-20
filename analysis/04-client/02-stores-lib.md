# Client State Management & Libraries Analysis

## 🏪 Store Architecture Overview

The client uses **Zustand v5** with two stores (`authStore`, `appStore`), no selectors abstraction layer, and no derived state. The stores follow a flat pattern — each holds its own state slices, loading/error pairs, and async actions. The socket.io client is module-level singleton with store-bound lifecycle. API layer is a thin Axios wrapper with JWT injection and 401 handling.

```
client/src/
├── store/
│   ├── authStore.ts    → Zustand + persist middleware
│   └── appStore.ts     → Zustand (no persist)
├── lib/
│   ├── api.ts          → Axios instance + interceptors
│   ├── socket.ts       → Socket.io singleton
│   ├── sanitize.ts     → DOMPurify wrapper
│   ├── exportToCSV.ts  → CSV export utility
│   └── useFocusTrap.ts → Focus trap hook
├── types/index.ts      → Re-exports shared types + client-only types
└── constants.ts        → Re-exports ROLES from shared types
```

---

## 📦 Individual Store Analysis

### 1. authStore (`store/authStore.ts`) — persisted

| Aspect | Detail |
|--------|--------|
| **Middleware** | `zustand/middleware/persist` with key `'auth-storage'` |
| **State** | `user` (User \| null), `token` (string \| null), `permissions` (string[]), `loading` (boolean) |
| **Actions** | `login`, `logout`, `loadUser`, `clearToken` |
| **API calls** | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| **Loading** | Only `loading` is set, no fine-grained error state |
| **Error handling** | `loadUser` silently swallows errors (empty catch), `logout` logs but swallows |

Persists `user`, `token`, and `permissions` to localStorage under `auth-storage`. On app load, `loadUser()` is called to validate token — if it fails, user is silently set to null with `loading: false`. No retry or refresh token mechanism.

### 2. appStore (`store/appStore.ts`) — ephemeral

| Aspect | Detail |
|--------|--------|
| **Middleware** | None |
| **State** | `users`, `roles`, `projects` (each T[]) with per-resource |
| **Loading/Error** | Per-resource: `usersLoading`, `rolesLoading`, `projectsLoading`, and `usersError`, `rolesError`, `projectsError` (strings) |
| **Actions** | `loadUsers`, `loadRoles`, `loadProjects`, `updateUsers` |
| **API calls** | `GET /users`, `GET /roles`, `GET /projects` |
| **Error handling** | Each catch sets its specific error string (Arabic message) |

Not persisted — data is re-fetched on component mount. `updateUsers` allows optimistic updates via a functional updater.

### Notable absent stores

There are **no dedicated stores** for projects, tasks, subtasks, notifications, warnings, comments, or kanban state. All this state is managed locally in page components via `useState` and `useEffect`, calling `api.*` directly. This means:
- No cache layer for entity data
- No optimistic update patterns for CRUD
- No normalisation (each page refetches raw lists)
- No cross-page state sharing beyond what `useAppStore` provides

---

## 🔌 Socket.IO Integration

### Connection lifecycle (`lib/socket.ts`)

1. **Singleton socket** created at module scope with `autoConnect: false`
2. A `useAuthStore.subscribe()` listener (outside React) watches auth state:
   - On login: sets `socket.auth.token`, calls `socket.connect()`, emits `join:user`
   - On logout: calls `socket.disconnect()`
3. Connection uses polling first, then upgrades to WebSocket

### Events emitted
| Event | When | Purpose |
|-------|------|---------|
| `join:user` | On connect/login | Register user for targeted events |

### Events listened (module-level)
| Event | Handler | Purpose |
|-------|---------|---------|
| `connect_error` | Log + disconnect on `'Invalid token'` | Auth failure handling |
| `disconnect` | Log non-client disconnects | Debugging |
| `connect` | Log socket ID | Debugging |

### Events listened (component-level via `useEffect`)
| Component | Event | Cleanup |
|-----------|-------|---------|
| `ProjectDetail.tsx` | `subtask:updated`, `list:update` | `socket.off()` on unmount |
| `SubtaskPage.tsx` | `subtask:updated` | `socket.off()` on unmount |
| `KanbanBoard.tsx` | `list:update` | `socket.off()` on unmount |
| `Comments.tsx` | `comment:new`, `comment:winner-selected` | `socket.off()` on unmount |
| `NotificationBell.tsx` | `notification` | `socket.off()` on unmount |

All component-level listeners properly call `socket.off()` in the effect cleanup.

### Strengths of socket integration
- Centralised auth→socket lifecycle via `useAuthStore.subscribe` (no manual connection mgmt)
- `autoConnect: false` prevents premature connections before auth
- All component listeners are cleaned up on unmount
- Token invalidation on the server disconnect error is handled

### Weaknesses of socket integration
- The `subscribe` callback at line 27-38 is **outside React** — it never unmounts and has no cleanup. This is intentional for the singleton, but means re-renders/state changes in components can't influence it.
- No reconnection backoff configuration beyond socket.io defaults
- No store updates happen in response to socket events — components call `api.*` directly and update local state. The socket is purely a "trigger to re-fetch" signal.

---

## 🌐 API Layer (`lib/api.ts`)

### Architecture
- Axios instance with `baseURL: '/api/v1'`
- Two interceptors: request (inject JWT) and response (unwrap + 401)

### Request interceptor
```ts
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```
Pulls token from Zustand store at call-time (not closure-captured), so login/logout cycles are handled.

### Response interceptor — success path
```ts
if (res.data && typeof res.data === 'object' && 'success' in res.data) {
  if (!res.data.success) return Promise.reject(res.data.error || 'Unknown error');
  res.data = res.data.data;
}
```
Unwraps the `{ success: true, data: ... }` envelope that the server sends. This is a **convention, not a guarantee** — any endpoint that doesn't include a `success` field passes through unmodified.

### Response interceptor — error path (401)
```ts
if (err.response?.status === 401) {
  useAuthStore.getState().clearToken?.();
  // redirect to /login unless already there
}
```
Clear token and redirect on 401. Uses `window.location.href` instead of router navigation (hard reload, full page re-render). Checks `window.location.pathname.startsWith('/login')` to avoid redirect loops.

### API call patterns across pages
- **Direct `api.get/post/put/delete` in components** — no service layer, no hooks
- **AbortController** used in `ProjectDetail.tsx` for cleanup on unmount
- **Local `useState`** for loading/error in each page component
- **Error handling**: try/catch with toast notification or console.error

---

## 🛠️ Utility Functions

### `lib/sanitize.ts` — DOMPurify wrapper
```ts
sanitizeHTML(html: string): string
```
Allows a limited set of HTML tags/attrs (b, i, u, a, img, etc.). Used where user-generated rich text is rendered (comments, descriptions). Reasonable security baseline.

### `lib/exportToCSV.ts` — CSV export
```ts
exportToCSV(rows: string[][], filename: string): void
```
Creates Blob URL, triggers download, cleans up. Includes UTF-8 BOM for Arabic/Excel compatibility.

### `lib/useFocusTrap.ts` — Focus trap hook
```ts
useFocusTrap(open: boolean): RefObject<HTMLDivElement>
```
Traps Tab/Shift+Tab within the referenced element while `open` is true. Focuses first focusable on open, restores previous focus on close. Used in modals/dialogs for accessibility.

### `constants.ts` — Re-exports
```ts
export { ROLES } from './types'
```
Thin re-export of `ROLES_VALUES` from shared types for convenience.

### `types/index.ts` — Type definitions
- Re-exports all shared types from `@shared/types`
- Exports `ROLES_VALUES`, `ROLES`, `STATUS_LABELS`
- Defines client-only types: `AuthState`, `SubtaskData`, `CreditUser`, `Permission`, `Comment`, `FreezeStatus`, `NotifType`

---

## ✅ Strengths

1. **Zustand choice is appropriate** — lightweight, no boilerplate, works well with React 19. The `persist` middleware on authStore is correctly applied.
2. **API interceptor pattern is clean** — centralised JWT injection and 401 handling avoids repetition across all components.
3. **Socket lifecycle tied to auth state** — connecting on login, disconnecting on logout, and setting `autoConnect: false` prevents race conditions.
4. **Proper socket cleanup** — every component-level `socket.on` has a corresponding `socket.off` in the effect return.
5. **Focus trap implementation** is a solid accessibility foundation for modals.
6. **CSV export includes BOM** — correct for Arabic text and Excel compatibility.
7. **DOMPurify whitelist** approach (rather than blacklist) is security best practice.
8. **Per-resource loading/error state** in appStore allows granular UI feedback.

---

## ❌ Weaknesses / Problems Found

### 1. No dedicated stores for domain entities (projects, tasks, subtasks, notifications, warnings)
- All entity state lives in `useState` inside page components
- No data normalisation — same API responses fetched by different pages
- No stale-while-revalidate pattern
- No optimistic updates (every mutation followed by a refetch or manual local state patch)
- Forces each page to manage its own loading/error state, leading to code duplication

### 2. authStore lacks granular error and loading states
- `login` has no loading indicator or error state on the store itself
- `logout` silently catches errors
- No `error` field in the store — components must handle errors themselves or use try/catch

### 3. API unwrap pattern is fragile
- The success-path interceptor checks `'success' in res.data`, which can false-positive if the API returns an object with a `success` property that isn't the envelope
- The unwrap `res.data = res.data.data` mutates the Axios response silently — could confuse debugging

### 4. 401 redirect uses `window.location.href` instead of React Router navigation
- Forces a full page reload, losing all component state
- Should use the router's `navigate()` from react-router-dom

### 5. No token refresh mechanism
- Token expires after 7 days; 401 immediately redirects to login with no attempt at silent refresh
- No axios retry interceptor for 401 -> refresh -> retry pattern

### 6. Socket event handling doesn't update stores
- Socket events like `list:update` and `subtask:updated` trigger component-local refetches rather than updating a central store
- No debouncing of re-fetches triggered by socket events

### 7. No global error boundary for API failures
- Each page has try/catch with `console.error` — no centralised error reporting mechanism
- Sentry (`@sentry/react`) is installed but never imported or configured anywhere in the observed code

### 8. `loadUser` in authStore has empty catch
```ts
catch { set({ loading: false }); }
```
Silently swallows any error during token validation. User sees no indication that the session check failed.

### 9. Socket subscription in module scope has no teardown
The `useAuthStore.subscribe()` at the bottom of `socket.ts` runs once at module import and never unsubscribes. While intentional for a singleton, it means the store's subscription callback cannot be cleaned up if the socket module is ever hot-reloaded.

### 10. No custom React hooks for data fetching
There are zero custom hooks in `hooks/` (directory is empty). Every page duplicates the fetch/loading/error pattern. Compare to the server's well-structured service layer — the client has no equivalent abstraction.

### 11. `useAppStore.updateUsers` is underutilised
It exists but is only used once in `Users.tsx`. Other mutations (project create, warning creation) call `loadUsers()` which fully refetches.

---

## 🎯 Recommendations

1. **Introduce domain stores** — At minimum, a `projectStore` and `taskStore` with keys by ID, to cache entities and reduce refetching. Consider Zustand slices pattern or `zustand/context` for scoped state.

2. **Create a data-fetching hook** — A `useFetch` or `useApi` hook that wraps the axios pattern with loading/error states, abort controller integration, and optional cache. This would eliminate the repeated `useState/useEffect/api.get` pattern across pages.

3. **Add token refresh** — Implement a `/auth/refresh` endpoint on the server and an axios response interceptor that attempts refresh before clearing token on 401.

4. **Fix 401 redirect** — Replace `window.location.href` with React Router's `navigate()` to avoid full page reload and preserve app state.

5. **Wire up Sentry** — `@sentry/react` is in dependencies but never initialised. Add `Sentry.init()` in `main.tsx` and integrate with the axios error handler.

6. **Add error state to authStore** — Include an `error` field on the store so components can show login failure messages without local state.

7. **Debounce socket-triggered refetches** — When `list:update` fires, debounce the refresh callback to avoid multiple re-fetches during rapid changes.

8. **Fix fragile API unwrap** — Change the condition to check `res.data.success === true` (strict equality) rather than `'success' in res.data`, or check for `res.config._envelope` to opt in per-request.

9. **Clean up socket module subscription** — Store the unsubscribe function returned by `useAuthStore.subscribe()` and call it on HMR/dispose if possible, or accept this as a known limitation.

10. **Consider React Query / TanStack Query** — For a project of this complexity, a dedicated data-fetching and cache library would eliminate most of the boilerplate and provide stale-while-revalidate, retries, optimistic updates, and devtools out of the box.
