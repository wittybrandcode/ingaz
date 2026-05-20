# Technical Audit Report — Ingaz (إنجاز)

**Date:** 2026-05-13
**Version:** 1.0.0
**Scope:** Full-stack audit (Express + SQLite + Socket.io / React + Vite + Zustand)
**Total Source Lines:** ~5,757 (client) + ~2,800 (server) + 193 (shared)

---

## 1. Executive Summary

Ingaz is a mature Arabic task-management SaaS with a pragmatic monolithic architecture. The codebase has undergone extensive remediation (55/56 issues resolved from prior audits, 115/115 roadmap items complete). Current stability is high in production-like behavior.

**Overall Assessment:** The application is functionally complete and stable. The architecture is appropriate for its current scale (single-server SQLite) but has clear ceilings for horizontal scaling. The most impactful improvements are in security hardening (CRITICAL: JWT secret fallback), database query optimization (N+1 in subtask assignee loading), frontend state management (prop-drilling hotspot), and test coverage (near-zero).

### Risk Ratings

| Category | Rating | Urgency |
|----------|--------|---------|
| Security | ⚠️ HIGH (1 critical, 1 high, 3 medium) | Immediate action needed |
| Performance | ⚠️ MEDIUM (1 critical N+1) | Next sprint |
| Data Integrity | ✅ Good | No immediate risk |
| UX/UI | ✅ Good | Incremental improvements |
| Code Quality | ⚠️ MEDIUM | Ongoing maintenance |
| Test Coverage | ❌ CRITICAL (near 0%) | Must initiate immediately |

---

## 2. Global Architecture Evaluation

### Strengths
- **Clean monolithic layering**: Routes → Middleware → DB helpers — predictable and easy to trace
- **Dual-route mounting** (`/api` and `/api/v1`): Backward-compatible API versioning at zero cost
- **Socket.io integration**: Well-designed real-time sync with proper room-based notifications
- **Shared types package**: Single source of truth for interfaces between client and server
- **No ORM overhead**: Direct SQLite with better-sqlite3 — fast, simple, predictable
- **Zustand stores**: Lightweight, no boilerplate, with persist middleware for auth

### Weaknesses
- **No service layer**: Business logic lives in route handlers — violates separation of concerns, makes testing difficult
- **SQLite single-writer**: Cannot horizontally scale the database — a hard ceiling
- **No migration system**: Schema defined inline in `db.ts` — risky for team collaboration
- **Dead dependency**: `recharts` (client/package.json) — installed but never imported
- **No code-splitting**: Entire React app loaded as single chunk

### Architecture Score: 7/10 — Appropriate for current scale, will need evolution

---

## 3. Scalability Readiness

| Dimension | Current State | Ceiling | Recommendation |
|-----------|--------------|---------|----------------|
| **Database** | SQLite single-file | ~10K concurrent users, ~1M rows | Plan PostgreSQL migration for v2 |
| **API** | Single Express process | ~500 concurrent req/s | Add clustering or PM2 |
| **Real-time** | Single Socket.io process | ~5K concurrent sockets | Socket.io adapter (Redis) for multi-instance |
| **Frontend** | Monolithic SPA | ~50 components | Lazy-load routes, code-split vendor chunks |
| **File storage** | Local filesystem | ~10GB | S3-compatible object storage for production |
| **Auth** | In-memory + SQLite blacklist | ~50K tokens | Redis-based blacklist for distributed deployments |

### Key Bottlenecks
1. **`GET /subtasks/task/:taskId`** — N+1 query firing `getSubtaskAssignees()` per subtask
2. **`GET /projects/:id`** — No pagination on nested tasks/members
3. **All mutations in ProjectDetail** — Full subtask list refetch after every action

### Scalability Score: 5/10 — Adequate for team deployment, needs work for production SaaS

---

## 4. Frontend UI/UX Analysis

### Visual Consistency: 8/10
- Tailwind CSS v4 with consistent color palette and design tokens
- RTL-first design with Cairo font — excellent Arabic UX
- 6 color themes in KanbanBoard
- Status badges with consistent color coding (gray/blue/yellow/green/red)

### UX Friction Points

| Issue | Location | Severity |
|-------|----------|----------|
| **No loading skeleton in ProjectDetail** — just a text "جاري التحميل..." | `ProjectDetail.tsx:212` | MEDIUM |
| **Infinite spinner on load failure** — no error state, no retry | `ProjectDetail.tsx:212` | HIGH |
| **No confirmation for status changes** — accidental clicks change subtask state | `SubtaskRow.tsx:231-234` | LOW |
| **`loadSubtasks` called redundantly** — after socket already updated state | `ProjectDetail.tsx:164,180,187,193` | LOW |
| **No optimistic updates** — every action shows loading spinner before feedback | All mutation handlers | MEDIUM |
| **No drag-and-drop** — Kanban is a click-based board, not truly drag-and-drop | `KanbanBoard.tsx` | LOW (by design) |

### Responsiveness
- Uses Tailwind responsive prefixes (`lg:`, `sm:`, `grid-cols-2 sm:grid-cols-3`)
- Kanban board uses `overflow-x-auto` for horizontal scroll on small screens
- Modals are mobile-friendly (`max-w-lg w-full mx-4`)
- **Missing**: Hamburger menu for mobile nav — TopBar items overflow on small screens

### Accessibility

| Issue | Location | Severity |
|-------|----------|----------|
| **No `aria-label` on icon-only buttons** throughout | Multiple files | HIGH |
| **No keyboard navigation** for Kanban cards or dropdown pickers | KanbanBoard, AssigneePicker | HIGH |
| **Color-only status indicators** — no text labels on some cards | SubtaskCard status bar | MEDIUM |
| **No focus indicators** on custom styled buttons | Global (Tailwind default removes outline) | MEDIUM |
| **No `role` attributes** on interactive divs | Multiple cards | MEDIUM |
| `dangerouslySetInnerHTML` with user content — screen reader risk | SubtaskPage, ProjectDetail | MEDIUM |

### UX Score: 7/10 — Good Arabic-first UX, needs accessibility investment

---

## 5. Backend Engineering Analysis

### Route Architecture

| File | Lines | Endpoints | Complexity |
|------|-------|-----------|------------|
| `routes/warnings.ts` | 375 | 14 | HIGH — warning lifecycle + credit system |
| `routes/subtasks.ts` | 318 | 9 | HIGH — status transitions + notifications |
| `routes/projects.ts` | 229 | 9 | MEDIUM |
| `routes/tasks.ts` | 204 | 8 | MEDIUM |
| `routes/upload.ts` | 161 | 3 | MEDIUM |
| `routes/notifications.ts` | 150 | 8 | MEDIUM |
| `routes/auth.ts` | 97 | 5 | LOW |
| `routes/comments.ts` | 93 | 2 | LOW |
| `routes/users.ts` | 100 | 6 | LOW |
| `routes/roles.ts` | 77 | 7 | LOW |
| `routes/analytics.ts` | 54 | 1 | LOW |

### Middleware Chain Consistency

Pattern: `authenticate` → `checkFrozen` → `requireCredit(f)` → `authorize(...roles)` → handler

**Inconsistencies found:**
- `authorizePermission('...')` is used instead of `authorize()` in some routes — intentional but inconsistent mix
- `checkFrozen` is applied BEFORE `authorize`, meaning frozen admins are also blocked — intentional by design
- `requireCredit` checks field-by-field via restriction levels — flexible but adds query per request

### Error Handling Strategy

- Custom `res.success()` / `res.fail()` envelope pattern — consistent
- Always returns `{ success: true/false, data/error }` — predictable
- No centralized error handler — each route catches and responds individually
- No structured logging — just `console.error` in catch blocks

### Backend Score: 7/10 — Solid but lacks service layer and centralized error handling

---

## 6. Database Structure Review

### Schema Quality: 8/10

| Aspect | Rating | Notes |
|--------|--------|-------|
| Normalization | ✅ Good | Proper 3NF with junction tables for M:N |
| Indexing | ✅ Good | Covers foreign keys and common queries |
| Constraints | ✅ Good | UNIQUE, CHECK, NOT NULL, FK with CASCADE |
| Data types | ✅ Good | Appropriate types for all columns |
| Migrations | ❌ None | Inline `CREATE TABLE IF NOT EXISTS` — no versioning |

### Existing Indexes (16 total)

| Index | Table | Columns |
|-------|-------|---------|
| `idx_attachments_entity` | attachments | entity_type, entity_id |
| `idx_comments_subtask` | comments | subtask_id |
| `idx_comments_user` | comments | user_id |
| `idx_role_permissions_role` | role_permissions | role_id |
| `idx_warnings_user` | warnings | user_id |
| `idx_warnings_status` | warnings | status |
| `idx_warnings_deadline` | warnings | deadline |
| `idx_tasks_project` | tasks | project_id |
| `idx_subtasks_task` | subtasks | task_id |
| `idx_subtasks_assigned` | subtasks | assigned_to |
| `idx_task_assignees_task` | task_assignees | task_id |
| `idx_task_assignees_user` | task_assignees | user_id |
| `idx_subtask_assignees_subtask` | subtask_assignees | subtask_id |
| `idx_subtask_assignees_user` | subtask_assignees | user_id |
| `idx_notifications_user_read` | notifications | user_id, read |
| `idx_notifications_created` | notifications | created_at |

### Missing Indexes

| Table | Suggested Index | Reason |
|-------|----------------|--------|
| `notifications` | `(user_id, created_at)` | Frequent "get my notifications ordered by date" |
| `attachments` | `(uploaded_by)` | Filter by uploader |
| `activity_logs` | `(user_id, created_at)` | User activity timeline |
| `project_members` | `(user_id)` | "Find my projects" queries |
| `warnings` | `(user_id, created_at)` | User warning history |

### Database Score: 7/10 — Good schema, missing migration system, a few missing indexes

---

## 7. Security Assessment

### Critical & High Findings

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| S1 | **Hardcoded JWT fallback secret** `'ingaz-dev-secret-key-2026'` | **CRITICAL** | `middleware/auth.ts:6`, `index.ts:100` | Remove fallback; make JWT_SECRET required and validated at startup |
| S2 | **Subtask description not sanitized on creation** — stored XSS vector | **HIGH** | `subtasks.ts:78-81` | Add `sanitize-html` to description on both create and update |
| S3 | **Rate limit bypass** via `/api/auth/login` (unprotected prefix) | **MEDIUM** | `index.ts:75` | Apply auth limiter to both `/api` and `/api/v1` prefixes |
| S4 | **Avatar upload has no MIME filter** — arbitrary file types accepted | **MEDIUM** | `auth.ts:18` | Add `fileFilter` restricting to image MIME types |
| S5 | **Client-side sanitizer is regex-based** — bypassable | **MEDIUM** | `client/src/lib/sanitize.ts:1-15` | Replace with DOMPurify or rely entirely on server-side sanitization |
| S6 | **Helmet default CSP** — no nonce or script-src directives | **MEDIUM** | `index.ts:44` | Configure CSP with nonce-based script policy |
| S7 | **`cookie-parser` not imported** — cookie auth path is dead code | **LOW** | `index.ts` (missing import) | Either import and use cookies, or remove cookie-setting code |
| S8 | **Socket.io accepts blacklisted tokens** — no blacklist check on WS connection | **LOW** | `index.ts:96-103` | Add token blacklist check in socket `connection` event |
| S9 | **Any user can comment on any subtask** — no project membership check | **LOW** | `comments.ts:20-91` | Verify user is project member or assignee before allowing comment |
| S10 | **User enumeration** — any authenticated user can list all users | **LOW** | `users.ts:12-35` | Consider adding role-based access to user listing |

### Security Score: 6/10 — One critical issue needs immediate remediation

---

## 8. Performance Assessment

### Database Query Performance

| # | Issue | Severity | File:Line |
|---|-------|----------|-----------|
| P1 | **N+1 query**: `getSubtaskAssignees()` called per subtask in `.map()` loop | **CRITICAL** | `subtasks.ts:40-43` |
| P2 | **No pagination** on `GET /projects/:id` (returns ALL tasks + members) | **HIGH** | `projects.ts:111-117` |
| P3 | **No pagination** on `GET /tasks/project/:projectId` | **HIGH** | `tasks.ts:34-42` |
| P4 | **No pagination** on `GET /subtasks/task/:taskId` | **HIGH** | `subtasks.ts:33-44` |
| P5 | **Full refetch after every mutation** in ProjectDetail | **MEDIUM** | `ProjectDetail.tsx:164,180,187,193` |

### Bundle Performance

| # | Issue | Severity | File:Line |
|---|-------|----------|-----------|
| P6 | **`recharts` dead dependency** — installed but never imported | **MEDIUM** | `client/package.json:32` |
| P7 | **No code-splitting** — all pages in single chunk | **MEDIUM** | `App.tsx` |
| P8 | **No `React.memo`** on list item components (5 components identified) | **MEDIUM** | `TaskCard`, `SubtaskCard`, `ProjectCard`, `MemberCard`, `SubtaskRow` |
| P9 | **Prop drilling**: 37 props passed to SubtaskRow — every parent render re-renders all subtask rows | **MEDIUM** | `ProjectDetail.tsx:398-438` |

### Real-time Stability

| # | Issue | Severity | File:Line |
|---|-------|----------|-----------|
| P10 | **Anonymous socket handler** — `socket.off('subtask:updated')` removes ALL listeners | **LOW** | `ProjectDetail.tsx:95`, `SubtaskPage.tsx:54` |

### Performance Score: 6/10 — One critical N+1, bundle splitting needed

---

## 9. Accessibility & Responsive Audit

| Standard | Status | Notes |
|----------|--------|-------|
| WCAG 2.1 A | ⚠️ Partial | Missing ARIA labels, keyboard nav, focus indicators |
| WCAG 2.1 AA | ❌ Not met | Color contrast, screen reader support gaps |
| RTL support | ✅ Excellent | Full Arabic RTL with Cairo font |
| Mobile responsive | ⚠️ Partial | Modals work, but TopBar overflows; no hamburger menu |
| Keyboard navigation | ❌ Missing | Dropdown pickers, modals (except focus trap) not keyboard-accessible |
| Screen reader | ⚠️ Partial | `aria-modal` and `aria-labelledby` on modals only |

### Specific Findings

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| A1 | Icon-only buttons lack `aria-label` | SubTaskRow action buttons, card action buttons | HIGH |
| A2 | No keyboard navigation for AssigneePicker | `AssigneePicker.tsx` | HIGH |
| A3 | No focus-visible styles (Tailwind removes default outline) | Global | MEDIUM |
| A4 | TopBar nav items overflow on mobile | `TopBar.tsx` | MEDIUM |
| A5 | Kanban cards rely on color-only status indicators | `SubtaskCard.tsx` | MEDIUM |
| A6 | `dangerouslySetInnerHTML` without accessible alternative | `SubtaskPage.tsx:128` | MEDIUM |

### Accessibility Score: 4/10 — Needs significant investment for compliance

---

## 10. Code Quality Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| Total files | ~68 source files | Manageable |
| Average file length | ~110 lines | Good |
| Largest file | `server/src/seed-full.ts` (520 lines) | Acceptable (seed script) |
| Second largest | `client/src/pages/ProjectDetail.tsx` (455 lines) | Warning — violates SRP |
| Third largest | `client/src/components/KanbanBoard.tsx` (414 lines) | Warning — violates SRP |
| `strict: true` (client) | ✅ Yes | Good |
| `strict: false` (server) | ❌ No | Should enable |
| `noUnusedLocals` (client) | ✅ true | Good |
| `noUnusedParameters` (client) | ✅ true | Good |
| ESLint config | Root only, outdated server override `*.js` | Needs update for TS |
| Duplicated code | `ROLES` constants defined in 3 places (`shared/types.ts`, `server/constants.ts`, `client/constants.ts`) | Minor DRY violation |

### Top Warnings

| File | Lines | Issue |
|------|-------|-------|
| `ProjectDetail.tsx` | 455 | Too many responsibilities (project view, task/subtask CRUD, members, files, real-time) |
| `KanbanBoard.tsx` | 414 | Board layout + data fetching + modals + theme picker + notification bar |
| `SubtaskRow.tsx` | 328 | Too many props (37), form state lifted to grandparent |
| `WarningsAdmin.tsx` | 375 | Too many responsibilities |

### Code Quality Score: 7/10 — Clean TypeScript, but some files violate SRP

---

## 11. Technical Debt Index

### Immediate (Next Sprint)

| # | Item | Effort | Impact | Category |
|---|------|--------|--------|----------|
| TD1 | Remove hardcoded JWT secret fallback | 30 min | CRITICAL | Security |
| TD2 | Sanitize subtask description server-side | 30 min | HIGH | Security |
| TD3 | Fix N+1 query in `getSubtaskAssignees` | 1 hour | HIGH | Performance |
| TD4 | Apply auth rate limiter to both `/api` and `/api/v1` | 15 min | MEDIUM | Security |
| TD5 | Remove dead `recharts` dependency | 5 min | LOW | Maintenance |

### Short-term (Next 2 Sprints)

| # | Item | Effort | Impact | Category |
|---|------|--------|--------|----------|
| TD6 | Add `React.memo` to list item components | 1 hour | MEDIUM | Performance |
| TD7 | Add `AbortController` to `loadSubtasks` | 30 min | MEDIUM | Reliability |
| TD8 | Add `aria-label` to icon-only buttons | 1 hour | MEDIUM | Accessibility |
| TD9 | Replace custom sanitizer with DOMPurify | 1 hour | MEDIUM | Security |
| TD10 | Split `ProjectDetail.tsx` into smaller components | 4 hours | MEDIUM | Maintainability |

### Medium-term (Next Month)

| # | Item | Effort | Impact | Category |
|---|------|--------|--------|----------|
| TD11 | Add React.lazy code-splitting for routes | 2 hours | MEDIUM | Performance |
| TD12 | Enable `strict: true` on server tsconfig | 4 hours | MEDIUM | Reliability |
| TD13 | Add Vite `manualChunks` for vendor splitting | 1 hour | LOW | Performance |
| TD14 | Implement basic test infrastructure | 8 hours | HIGH | Quality |
| TD15 | Add centralized error handling middleware | 2 hours | MEDIUM | Maintainability |

### Estimated Total: ~27 hours of technical debt

---

## 12. Business Logic Consistency Review

### Core Domain Rules

| Rule | Status | Verified In |
|------|--------|-------------|
| ADMIN can do everything | ✅ | `permissions` returns all 28 permissions |
| DEPUTY cannot manage users/roles/archive projects | ✅ | `seed.ts:110-115` |
| EMPLOYEE needs project membership to create tasks | ✅ | `tasks.ts:49` |
| EMPLOYEE needs project membership to create subtasks | ✅ | `subtasks.ts:64-70` |
| Credit score gates task creation | ✅ | `requireCredit('can_create_tasks')` |
| Frozen accounts block all actions | ✅ | `checkFrozen` middleware |
| Warning auto-escalation after 48h | ✅ | `index.ts` background job |
| Credit auto-recovery +1/24h (max 10) | ✅ | `index.ts` background job |
| Soft-delete for users and tasks | ✅ | `status = 'archived'` |
| Hard-delete for subtasks | ✅ | `subtasks.ts:234-248` |

### Inconsistencies

| # | Rule | Expected | Actual | Severity |
|---|------|----------|--------|----------|
| B1 | Comment creation requires project membership | Any authenticated user can comment | No membership check | LOW |
| B2 | Task display authorization | Any user can view any task | No project membership check on read | LOW (by design for transparency) |
| B3 | Upload authorization | EMPLOYEE can upload to tasks they created | Check exists but the logic is in upload.ts:79-85, not in middleware | LOW |

### Business Logic Score: 9/10 — Highly consistent, minor edge cases

---

## 13. Risk Analysis For Future Expansion

| Expansion | Risk Level | Blockers |
|-----------|------------|----------|
| Multi-tenant (orgs/projects isolation) | 🔴 HIGH | SQLite single-file, no tenant_id columns, permission system is role-only |
| PostgreSQL migration | 🟡 MEDIUM | better-sqlite3 sync API vs async pg — requires architecture change |
| Docker/Kubernetes deployment | 🟡 MEDIUM | No Dockerfile, no containerization config |
| Mobile app (React Native) | 🟢 LOW | API is platform-agnostic, JWT auth works for mobile |
| Third-party API (public REST) | 🟡 MEDIUM | No API key auth, rate limiting is basic |
| Analytics/reporting module | 🟢 LOW | Existing dashboard analytics endpoint, recharts already in deps |
| Dark mode | 🟢 LOW | Tailwind makes this easy, just need CSS variables |
| PWA / offline support | 🟡 MEDIUM | Zustand persist exists, but no service worker or offline strategy |
| Webhook system | 🟡 MEDIUM | Notification system exists, needs webhook delivery channel |
| i18n (English) | 🔴 HIGH | All UI text hardcoded in Arabic — no i18n library, no string extraction |

### Expansion Risk Score: 5/10 — Some areas are ready, multi-tenancy and i18n are major concerns

---

## 14. Recommended Refactoring Priorities

### Phase 1 — Security & Stability (Week 1)
1. **CRITICAL**: Remove hardcoded JWT secret fallback
2. **HIGH**: Sanitize subtask descriptions server-side
3. **MEDIUM**: Apply auth rate limiter to `/api/auth/login`
4. **MEDIUM**: Add `AbortController` to `loadSubtasks` in ProjectDetail
5. **MEDIUM**: Add error state + retry button in ProjectDetail load failure

### Phase 2 — Performance (Week 2)
1. **CRITICAL**: Fix N+1 query in `GET /subtasks/task/:taskId` — batch fetch assignees
2. **HIGH**: Add limit/offset pagination to `GET /projects/:id` nested data
3. **MEDIUM**: Remove `recharts` dead dependency
4. **MEDIUM**: Add `React.memo` to list item components
5. **MEDIUM**: Add `React.lazy` code-splitting for pages

### Phase 3 — Quality (Week 3)
1. **MEDIUM**: Split `ProjectDetail.tsx` — extract task list, subtask create form
2. **MEDIUM**: Replace custom sanitizer with DOMPurify
3. **MEDIUM**: Enable `strict: true` on server tsconfig
4. **LOW**: Add `aria-label` to all icon-only buttons
5. **LOW**: Remove dead `cookie-parser` or implement properly

### Phase 4 — Test Infrastructure (Week 4)
1. **HIGH**: Set up integration tests for auth flow (critical path)
2. **HIGH**: Set up API validation tests for task/subtask CRUD
3. **MEDIUM**: Add UI interaction tests for key flows
4. **MEDIUM**: Add real-time feature tests for socket events
5. **LOW**: Add regression tests for core business logic

---

## 15. Suggested Modernization Roadmap

### Now (Q2 2026)
- ✅ Security fixes (Phase 1 above)
- ✅ N+1 query fix
- ✅ Error handling in ProjectDetail

### Q3 2026
- ✅ Code-splitting + bundle optimization
- ✅ Accessibility pass (ARIA labels, keyboard nav)
- ✅ Test infrastructure (vitest integration + API tests)
- ✅ Server strict mode enabled

### Q4 2026
- ✅ Component extraction (refactor ProjectDetail, KanbanBoard)
- ✅ Service layer extraction (move business logic out of route handlers)
- ✅ PostgreSQL readiness assessment + migration tooling
- ✅ Dockerfile + docker-compose for reproducible deployments

### Q1 2027
- ✅ PostgreSQL migration (async + connection pooling)
- ✅ Multi-instance Socket.io with Redis adapter
- ✅ File storage migration to S3-compatible
- ✅ i18n infrastructure (react-intl or similar)

---

## 16. Production Stability Recommendations

| # | Recommendation | Priority | Rationale |
|---|---------------|----------|-----------|
| PR1 | Add health check endpoint (`GET /health`) | HIGH | Needed for load balancers and container orchestration |
| PR2 | Implement structured logging (pino or winston) | HIGH | Current `console.error` is not production-grade |
| PR3 | Add request ID middleware for request tracing | MEDIUM | Essential for debugging production issues |
| PR4 | Configure PM2 or similar process manager | MEDIUM | Auto-restart on crash, zero-downtime deploys |
| PR5 | Add database backup script (SQLite `.backup`) | HIGH | No backup strategy exists |
| PR6 | Set up error monitoring (Sentry or similar) | MEDIUM | Current errors are silent (console.error only) |
| PR7 | Add CORS production origin validation | MEDIUM | `ALLOWED_ORIGINS` env var must be validated at startup |
| PR8 | Remove `secure: false` in production cookie config | LOW | Currently line 44 in auth.ts has `secure: process.env.NODE_ENV === 'production'` — correct |

---

## 17. Long-Term Maintainability Score

| Factor | Score | Notes |
|--------|-------|-------|
| Code readability | 8/10 | Clean TypeScript, consistent naming |
| Modularity | 6/10 | Some god components, no service layer |
| Testability | 2/10 | Near-zero test coverage |
| Configurability | 6/10 | .env for secrets, but hardcoded defaults |
| Documentation | 7/10 | Good AGENTS.md, ROADMAP.md, plans |
| Dependency freshness | 7/10 | React 19, TypeScript 6, Vite 8 — very modern |
| Error resilience | 4/10 | Silent failures, no structured logging |
| Security posture | 6/10 | Good foundations, critical gaps |

### Overall Maintainability Score: 5.75/10 — Solid codebase, critical gaps in testing and error handling

---

## 18. Final Strategic Recommendations

### Top 5 Actions This Week
1. **Fix hardcoded JWT secret** — 30 min, CRITICAL security impact
2. **Sanitize subtask descriptions** — 30 min, HIGH security impact  
3. **Fix N+1 query in subtask assignees** — 1 hour, CRITICAL performance impact
4. **Add error state to ProjectDetail** — 1 hour, HIGH UX impact
5. **Remove dead `recharts` dependency** — 5 min, LOW effort

### Top 5 Actions This Month
1. **Build test infrastructure** — Start with auth flow and task lifecycle integration tests
2. **Add `React.lazy` code-splitting** — Reduce initial bundle by ~40%
3. **Enable server `strict: true`** — Catch 50+ potential type errors
4. **Accessibility pass** — ARIA labels + keyboard nav on critical paths
5. **Extract `ProjectDetail.tsx`** — Split into 3-4 focused components

### Verdict
> Ingaz is a **well-architected, functionally complete application** with strong business logic consistency and an excellent Arabic-first UX. The codebase is clean and modern (React 19, TypeScript 6, Vite 8). The critical path to production readiness is:
> 1. Fix the security gaps (especially the JWT secret)
> 2. Add test coverage
> 3. Optimize the database queries for scale
> 4. Improve accessibility
>
> The architecture is appropriate for a single-server team deployment. For SaaS-scale production, a planned migration path to PostgreSQL and multi-instance infrastructure should begin within 6 months.

---

*Report generated by automated codebase analysis on 2026-05-13*
