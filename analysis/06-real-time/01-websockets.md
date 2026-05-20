# 🔌 Real-Time System (Socket.IO) Analysis

## Server Setup

**File:** `server/src/index.ts:66–68`

```typescript
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
})
app.set('io', io)
```

The `io` instance is stored on the Express app (`app.set('io', io)`) so route handlers can retrieve it via `req.app.get('io')`. Services receive it through `ServiceContext.io`.

### Authentication Middleware (lines 160–168)

Every WebSocket connection is authenticated:

```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0]
  if (!token) return next(new Error('No token'))
  if (await isBlacklisted(token)) return next(new Error('Token revoked'))
  try {
    socket.data.user = jwt.verify(token, process.env.JWT_SECRET!)
    next()
  } catch { next(new Error('Invalid token')) }
})
```

- Token sourced from `handshake.auth.token` (preferred) or cookie fallback
- Blacklist check (same JWT blacklist as REST auth)
- User payload attached to `socket.data.user`

### Connection Handler (lines 170–178)

```typescript
io.on('connection', (socket) => {
  socket.on('join:user', (userId) => {
    if (socket.data.user?.id === userId) {
      socket.join(`user:${userId}`)
    }
  })
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id))
})
```

- Client joins a `user:{userId}` room on `join:user` event
- The server validates that the user can only join their own room
- No other rooms (project rooms, task rooms) exist — all broadcasts go to all connected clients or to specific user rooms

---

## 📡 Events Catalog

### Client → Server Events

| Event | Payload | Purpose | Location |
|-------|---------|---------|----------|
| `join:user` | `number` (userId) | Subscribe to user-specific notifications | `server/src/index.ts:172` |

### Server → Client Events (Broadcast `io.emit`)

| Event | Payload | Triggered By | Files |
|-------|---------|-------------|-------|
| `list:update` | `{ type: 'project'\|'task'\|'subtask', action: 'created'\|'updated'\|'deleted', data: {...} }` | CRUD operations on projects, tasks, subtasks | `ProjectService.ts:163,196,221,279`, `TaskService.ts:147,204,235,317,354`, `SubtaskService.ts:54,84,288,415,475`, `CommentService.ts:235–251` |
| `subtask:updated` | `{ id, status, winner_comment_id? }` | Subtask status change or winner selection | `SubtaskService.ts:415`, `CommentService.ts:229` |
| `comment:new` | `camelToSnake(comment)` | New comment on a subtask | `CommentService.ts:72` |
| `comment:winner-selected` | `{ commentId, subtaskId }` | Winner selected on a comment | `CommentService.ts:227` |

### Server → Client Events (Room-scoped `io.to(user:{id}).emit`)

| Event | Payload | Triggered By | Files |
|-------|---------|-------------|-------|
| `notification` | `camelToSnake(notification)` | Any `notifyUser` / `notifyAll` call | `notify.ts:68,100` |

### Notification Types (sent to user rooms)

| Type | Source Service | Condition |
|------|---------------|-----------|
| `project_created`, `project_updated`, `project_archived`, `project_deleted`, `project_completed` | ProjectService, CommentService | notifyAll |
| `task_created`, `task_updated`, `task_archived`, `task_completed` | TaskService, CommentService | notifyAll |
| `task_assigned`, `task_unassigned` | TaskService | notifyUser (to assignee) |
| `subtask_created`, `subtask_updated`, `subtask_deferred`, `subtask_reactivated` | SubtaskService | notifyAll / notifyUser |
| `subtask_assigned`, `assignment_changed` | SubtaskService | notifyUser |
| `comment` | CommentService | notifyUser (to assignee + managers) |
| `@mention` | CommentService | notifyUser (to mentioned users) |
| `winner_selected` | CommentService | notifyUser (to subtask assignees) |
| `deadline_approaching_24h`, `deadline_approaching_6h`, `deadline_overdue` | Background job (`checkDeadlines`) | notifyUser |
| `warning_ignored`, `account_frozen` | Background job (`checkExpiredWarnings`) | notifyUser |
| `daily_summary` | Background job (`autoRecoverCredit`) | notifyUser |

---

## 🖥️ Client Integration

**File:** `client/src/lib/socket.ts`

### Connection Setup

```typescript
const socket = io(import.meta.env.PROD ? '/' : 'http://localhost:3001', {
  transports: ['polling', 'websocket'],
  autoConnect: false
})
```

- **Dev:** Connects to `http://localhost:3001` directly
- **Prod:** Connects to `/` (same origin, proxied by Vite/nginx)
- **Transport:** `['polling', 'websocket']` — starts with HTTP long-polling, then upgrades to WebSocket
- **autoConnect:** `false` — connection is managed by auth state

### Connection Lifecycle (lines 9–38)

```
Auth state change
  ├── user present + new user ID
  │     ├── socket.auth = { token }
  │     ├── socket.connect()
  │     └── socket.emit('join:user', userId)
  │
  └── user cleared
        └── socket.disconnect()
```

### Event Handlers

```typescript
socket.on('connect_error', (err) => {
  if (err.message === 'Invalid token') socket.disconnect()
})
socket.on('disconnect', (reason) => { /* log unless intentional */ })
socket.on('connect', () => { /* log */ })
```

> **Note:** The client socket does **not** register any business event listeners (`list:update`, `subtask:updated`, `comment:new`, `notification`). Those are expected to be handled by consuming components via `useEffect` + `socket.on(...)` directly.

### Store Integration

- **`authStore.ts`** — subscribed by `socket.ts` via `useAuthStore.subscribe()` to drive connection lifecycle (lines 27–38)
- **`appStore.ts`** — does **not** listen to any socket events. The `loadProjects()`, `loadUsers()`, `loadRoles()` functions are REST-only. After a socket `list:update` event, the UI must manually refetch or use component-local state.

### Vite Proxy (client/vite.config.ts:12)

```typescript
proxy: {
  '/api': 'http://localhost:3001',
  '/socket.io': 'http://localhost:3001',   // ← Socket.IO upgrade
  '/uploads': 'http://localhost:3001'
}
```

---

## 🔄 Reconnection Strategy

| Aspect | Current State |
|--------|---------------|
| **Reconnection** | Default Socket.IO reconnection is **active** (enabled by default) |
| **Exponential backoff** | Uses Socket.IO defaults: `1s, 2s, 4s, ...` (not explicitly configured) |
| **Max attempts** | Default (unlimited) |
| **Auth retry** | On reconnect, `socket.auth.token` is still set from the previous `useAuthStore` subscribe call. If token expired, `connect_error` fires and the socket disconnects. |
| **Cleanup on unmount** | Not handled centrally — individual components must clean up their own `socket.on()` listeners |

---

## ⚠️ Issues Found

### 1. Business events not consumed in store

`appStore.ts` only has REST-based `loadProjects()` / `loadUsers()` / `loadRoles()`. After a `list:update` event, no store state is updated automatically. This means:

- User A creates a project → `list:update` fires → User B's UI **does not** update unless they manually refetch
- Any page that uses `useAppStore(s => s.projects)` will show stale data

**Affects:** All CRUD real-time updates (project, task, subtotal create/update/delete)

**Mitigation:** Individual components may use `useEffect` + `socket.on('list:update', ...)` and local `setState` — but this is inconsistent and duplicates logic.

### 2. No project-scoped rooms

All `list:update` events are broadcast to **every connected client** (`io.emit`). There are no `project:{id}` rooms. This means:

- A user viewing project A gets updates about project B that they don't care about
- No server-side filtering of who should receive which updates

### 3. `ctx.io` optional but always available

The `ServiceContext.io` is typed as `io?: import('socket.io').Server | null`, and every service wraps socket emissions in `if (ctx.io)`. In practice, `io` is always set (injected by route handlers via `req.app.get('io')`). This adds unnecessary optionality and branch coverage.

### 4. `notify.ts` types `io` as `any`

```typescript
// notify.ts:48
io?: any
```

Both `notifyAll()` and `notifyUser()` accept `io` as `any`, bypassing the Socket.IO Server type.

### 5. No client-side socket listener cleanup contract

The socket module (`socket.ts`) does not expose any hook or utility for component-level listeners. If a component does:

```typescript
useEffect(() => {
  socket.on('list:update', handler)
  return () => socket.off('list:update', handler)  // ← often forgotten
}, [])
```

Missing the cleanup leads to **listener leaks** and stale closures.

### 6. `list:update` payload shape inconsistency

The `data` field varies by action:

| Action | Payload Shape | Source |
|--------|--------------|--------|
| `created` | Full entity (camelToSnake) | `ProjectService.ts:163`, `TaskService.ts:147` |
| `updated` | Partial fields only | `ProjectService.ts:196`, `TaskService.ts:204` |
| `deleted` | `{ id }` only | `ProjectService.ts:221` |

Consumers must handle all three shapes, but there's no discriminated union for this.

### 7. Polling-first transport adds latency

```typescript
transports: ['polling', 'websocket']
```

Starting with HTTP long-polling adds round-trip latency before the WebSocket upgrade. In a LAN environment, `['websocket']` would be faster.

---

## 💡 Recommendations

| Issue | Severity | Suggestion |
|-------|----------|------------|
| Stores don't consume events | **High** | Add socket event listeners to `appStore.ts` that patch `projects`/`users` arrays on `list:update` events. E.g. `socket.on('list:update', (e) => { if (e.type === 'project' && e.action === 'created') set(s => ({ projects: [...s.projects, e.data] })) })` |
| No project rooms | Medium | Add `join:project` / `leave:project` events and emit `list:update` to `project:{id}` room instead of global broadcast |
| `io` as `any` | Low | Type `io` properly as `import('socket.io').Server` in `notify.ts` |
| Listener leaks | Medium | Create a `useSocketEvent(event, handler)` hook that auto-cleans up on unmount |
| `list:update` shapes | Medium | Define a discriminated union type for the `list:update` payload in `shared/types.ts` |
| Transport order | Low | Change to `['websocket', 'polling']` for lower latency, with polling as fallback |
| `ctx.io` optional | Low | Remove the optionality — make `io` required in `ServiceContext` since it's always provided |
