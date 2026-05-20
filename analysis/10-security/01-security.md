# 🔐 Security Analysis — Ingaz Server

## 🔐 Authentication Analysis

### Implementation
- **Library:** `jsonwebtoken` v9.0.2
- **Secret:** `JWT_SECRET` env variable (validated at startup — fatal error if missing)
- **Token lifetime:** 7 days (`TOKEN.EXPIRY = '7d'`)
- **Token storage:** `Authorization: Bearer <token>` header OR `token` cookie
- **Password hashing:** `bcryptjs` with 10 salt rounds
- **Blacklist:** In-memory `Map` + DB-backed `token_blacklist` table for persistence; periodic cleanup every 1 hour

### Auth flow
```
POST /api/auth/login  →  validate(loginSchema)  →  AuthService.login()  →  JWT
GET  /api/auth/me     →  authenticate middleware  →  AuthService.me()
POST /api/auth/logout →  authenticate → blacklistToken() + clear cookie
```

### Issues
1. **⚠️ Token lifetime is long (7 days)** — No refresh token mechanism. Revoked tokens remain valid until expiry unless blacklisted.
2. **⚠️ In-memory blacklist is lost on restart** — `tokenBlacklist` is a Map<> that resets on server restart. The DB-backed `tokenBlacklist` table is checked but the cleanup query has a logic bug: cleanup uses `eq(expiresAt, floor(now/1000))` which only matches exact seconds. Expired tokens may not be cleaned properly.
3. **⚠️ cookie-parser not initialized** — `authenticate` middleware reads `req.cookies?.token`, but `cookie-parser()` is never called in `index.ts`. Cookie-based auth silently fails.
4. **⚠️ Socket.io token auth** — Falls back to parsing cookie header manually (`socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0]`). This is fragile and doesn't support multiple cookies.
5. **✅ Login rate limiting** — Auth endpoint has a separate rate limiter: 100 requests per 15 minutes.
6. **✅ SameSite cookie** — Login sets `httpOnly`, `sameSite: 'lax'`, `secure` in production.

## 🛡️ Authorization Analysis

### RBAC Implementation
- **3 static roles:** ADMIN (1), DEPUTY (2), EMPLOYEE (3) — defined in `constants.ts`
- **Fine-grained permissions** — `role_permissions` + `permissions` tables with ~30 permission keys
- **Two authorization middleware layers:**
  - `authorize(...roleIds)` — Role-level check (e.g., `authorize(ROLES.ADMIN, ROLES.DEPUTY)`)
  - `authorizePermission(key)` — Permission-level check (e.g., `authorizePermission('tasks.assign')`)
- **ADMIN & DEPUTY bypass** — `hasPermission()` and `authorizePermission()` both short-circuit for `ROLES.ADMIN` and `ROLES.DEPUTY`

### Route protection summary

| Area | Auth Required | Frozen Check | Credit Check | Role Gating | Permission Gating |
|------|:---:|:---:|:---:|:---:|:---:|
| Auth endpoints | ✅ | ❌ | ❌ | ❌ | ❌ |
| User CRUD | ✅ | ❌ | ❌ | ✅ (ADMIN) | ❌ |
| Project CRUD | ✅ | ✅ | ✅ (create) | ✅ (ADMIN/DEPUTY) | ✅ (assign) |
| Task CRUD | ✅ | ✅ | ✅ (create) | ✅ (update/delete) | ✅ (assign) |
| Subtask CRUD | ✅ | ✅ (post/put) | ✅ (create) | ✅ (delete) | ✅ (assign) |
| Comments | ✅ | ❌ | ❌ | ❌ | ❌ |
| Notifications | ✅ | ❌ | ❌ | ❌ | ❌ |
| Roles/Permissions | ✅ | ❌ | ❌ | ✅ (ADMIN) | ❌ |
| Warnings | ✅ | ❌ | ❌ | ✅ (ADMIN/DEPTH) | ❌ |
| Uploads | ✅ | ❌ | ❌ | ❌ | ❌ |
| Analytics | ✅ | ❌ | ❌ | ❌ | ❌ |
| Health | ❌ | ❌ | ❌ | ❌ | ❌ |

### Issues
1. **⚠️ Comments, Notifications, Uploads have no role/permission gating** — Any authenticated user (including EMPLOYEE) can create comments, list notifications, upload files after `authenticate`. The business logic in service methods or the cascading middleware should enforce that only members of a project can comment on its subtasks.
2. **✅ Credit system** — `requireCredit('canCreateTasks')` gate on task/subtask creation refers to user's `restrictionLevels` row. This is a well-designed additional protection layer.
3. **✅ Service-layer membership check** — Beyond middleware, `TaskService.create()` and `SubtaskService.create()` check project membership for EMPLOYEE role (`isProjectManager()`), providing defense-in-depth.
4. **⚠️ Frozen check inconsistency** — `checkFrozen` is applied on task/subtask POST/PUT but NOT on comments, notifications, project list, task list, or uploads. A frozen user can still read data and upload files.

## ⚔️ Vulnerability Assessment

### SQL Injection
- **Status: ✅ Protected**
- Drizzle ORM parameterizes all queries. Raw `sql` template literals are used sparingly and safely (e.g., `sql`\`... IN (${sql.join(...)})\`` which is parameterized).
- The `getBulkSubtaskAssignees` function joins SQL parameters correctly.

### XSS (Cross-Site Scripting)
- **Status: ✅ Protected (partial)**
- **helmet CSP:** Content-Security-Policy header with `'self'` for scripts + nonce-based scripts. `'unsafe-inline'` allowed for styles.
- **sanitize-html:** Task titles are sanitized via `sanitize-html` in `TaskService.create()` — test verifies `<script>` tags are stripped.
- **⚠️ Not all user input is sanitized** — Comments, descriptions, project titles are stored as-is. The `sanitize-html` library is only used in `TaskService.create()`.
- **⚠️ CSP uses `unsafe-inline` for styles** — Reduces CSP effectiveness against CSS-based attacks.

### CSRF (Cross-Site Request Forgery)
- **Status: ⚠️ Partial**
- No explicit CSRF tokens. Protection relies on:
  - SameSite=Lax on auth cookie (only for cookie-based auth)
  - `Authorization: Bearer` header is the primary auth method (not susceptible to CSRF as custom headers trigger preflight)
- **⚠️ Cookie auth path is vulnerable** — Since cookie-parser is not initialized, this is a moot point for now, but if fixed, cookie-based auth would be vulnerable to CSRF.

### Rate Limiting
- **Status: ✅ Good**
- Global: 1000/15min (production), 5000/15min (development)
- Auth: 100/15min — protects against brute force
- `standardHeaders: true` — uses `RateLimit-*` headers

### File Upload Security
- **Status: ✅ Good (with gaps)**
- **Size limit:** 10MB per file (includes 2-stage check: multer limit + `file-type` MIME validation)
- **MIME validation:** `file-type` reads magic bytes for real MIME detection (double-check, not relying on extension)
- **Extension filter:** whitelist (jpeg, jpg, png, gif, pdf, doc, docx, xls, xlsx, zip, rar, txt)
- **Filename:** Randomized UUID — no path traversal risk
- **Avatar upload:** 5MB limit, only image MIME types, same UUID naming
- **⚠️ No malware scanning** — Uploaded files are not scanned for viruses.
- **⚠️ No file type enforcement for avatars** — Avatar uses only `fileFilter` on mimetype, no `file-type` double-check.

### Security Headers
- **Status: ✅ Enabled via helmet**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 0` (modern; helmet v8 disables this)
- `Strict-Transport-Security` (if HTTPS)
- CSP with nonces
- **⚠️ No `Referrer-Policy`** — Not explicitly set by helmet's defaults.
- **⚠️ No `Permissions-Policy`** — Not set.

### CORS
- **Status: ✅ Configured**
- `ALLOWED_ORIGINS` env variable (default: `http://localhost:5173`)
- Multiple origins supported (comma-separated)
- `credentials: true` — allows cookies
- **⚠️ Not validated at runtime** — `ALLOWED_ORIGINS` is validated at startup (URL parsing) but not on each request.

### Input Validation
- **Status: ✅ Good**
- **Zod schemas** for every write endpoint: login, user CRUD, project CRUD, task CRUD, subtask CRUD, warnings, comments, roles, notifications, profile updates, uploads
- **Field lengths constrained:** title 200, description 5000, email 254, password 128, reason 2000, text 2000
- **`validate()` middleware** returns first error with 400 status
- **⚠️ Error messages leak field names** — Zod error messages are in Arabic and reveal internal validation rules.

### Session Management
- **Status: ⚠️ Minimal**
- JWT-based (stateless). No server-side sessions.
- Blacklist for logout (in-memory + DB).
- **No refresh token rotation.** Once a token is stolen, it's valid for 7 days.
- **No device tracking** — No `new_login` notification is implemented despite the notification type existing.
- **No concurrent session limiting.**

## ✅ Existing Protections Summary

| Protection | Status |
|---|---|
| SQL injection prevention | ✅ Drizzle ORM |
| XSS (input sanitization) | ✅ Partial (sanitize-html used inconsistently) |
| XSS (CSP headers) | ✅ Helmet + nonces |
| CSRF | ⚠️ Partial (Bearer token reliance) |
| Rate limiting | ✅ Global + auth endpoint |
| Brute force protection | ✅ Auth endpoint limited |
| Password hashing | ✅ bcryptjs (10 rounds) |
| JWT authentication | ✅ With blacklist |
| RBAC authorization | ✅ Roles + fine-grained permissions |
| Credit restriction system | ✅ Custom implementation |
| Frozen account detection | ✅ In-memory cache + DB |
| File upload validation | ✅ Size + MIME + extension |
| Security headers | ✅ Helmet |
| CORS | ✅ Configured |
| Input validation | ✅ Zod schemas |
| Error handling | ✅ Centralized error handler |
| Request ID tracing | ✅ crypto.randomUUID() per request |
| Logging | ✅ pino with structured logs |
| Error monitoring | ✅ Sentry (optional) |
| Token blacklist | ✅ In-memory + DB persistence |
| Activity logging | ✅ addActivityLog() |
| HTTPS | ⚠️ Not enforced at app level |

## ❌ Missing Protections

| Protection | Impact | Priority |
|---|---|---|
| **No compiled build** | Source code exposed if server is compromised | Medium |
| **cookie-parser not initialized** | Cookie auth broken | **High** |
| **No refresh tokens** | Stolen JWT valid for 7 days | Medium |
| **No brute force per-user** | Attacker can try different users at 100/15min | Medium |
| **No request size limiter** | No body size limit on file uploads beyond multer | Low |
| **No HSTS without HTTPS** | `upgradeInsecureRequests: []` in CSP but no HSTS without HTTPS | Low |
| **No permissions policy** | Browser features not restricted | Low |
| **No referrals policy** | Referrer leakage possible | Low |
| **No API key for health** | Health endpoint exposes memory/uptime | Low |
| **No email confirmation** | Users created directly without verification | Medium (product decision) |
| **No password policy** | No complexity requirements beyond min 6 chars | Low (product decision) |
| **In-memory blacklist lost on restart** | Reboot invalidates the in-memory blacklist portion | Medium |

## 💡 Recommendations

### Critical (fix immediately)
1. **Fix cookie-parser** — Either `app.use(cookieParser())` in `index.ts` or remove `cookie-parser` from dependencies and document that only `Authorization: Bearer` header is supported.
2. **Add input sanitization to all text fields** — Apply `sanitize-html` to comments, project descriptions, user names, and notification content. Currently only task titles are sanitized.

### High Priority
3. **Add permission gating to comments and uploads** — `authorizePermission('comments.create')` and enforce that users can only upload to entities they have access to.
4. **Implement refresh token rotation** — Use short-lived access tokens (15min) with long-lived refresh tokens (7 days) stored in DB, with rotation on each refresh.
5. **Add project-level access checks** — Even after `authenticate`, verify the user has `projects.view` permission or is a member of the project before returning data.
6. **Add `checkFrozen` to all write endpoints** — Currently missing on comments, notifications, uploads.

### Medium Priority
7. **Improve token blacklist cleanup** — Fix the `expiresAt` query to use `lte` (less than or equal) instead of `eq` for cleanup.
8. **Add concurrent session limiting** — Track active tokens per user and limit maximum sessions.
9. **Add per-user rate limiting** — In addition to global IP-based rate limiting, add per-user rate limiting for critical endpoints.
10. **Replace multer with a disk space quota system** — Track total upload size per user/project to prevent disk exhaustion.

### Low Priority
11. **Add `Permissions-Policy` and `Referrer-Policy` headers** — Configure helmet's `permissionsPolicy` and `referrerPolicy`.
12. **Add API key authentication for external services** — If the analytics endpoint is consumed by external dashboards.
13. **Run security audit** — `npm audit`, Snyk, or GitHub Dependabot for vulnerability scanning in CI.
14. **Add helmet `hsts` configuration** — Enable `Strict-Transport-Security` when HTTPS is available.
