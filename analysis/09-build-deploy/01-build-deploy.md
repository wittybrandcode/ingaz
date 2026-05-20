# ⚙️ Build & Deploy Analysis — Ingaz Server

## ⚙️ Build Configuration

### TypeScript (`server/tsconfig.json`)

| Setting | Value | Notes |
|---------|-------|-------|
| `target` | `es2023` | Modern JS output |
| `module` | `esnext` | Native ESM |
| `moduleResolution` | `bundler` | Compatible with tsx/Vite bundler |
| `strict` | `true` | Full strict mode |
| `noEmit` | `true` | Never emit JS — runtime relies on tsx/Node |
| `erasableSyntaxOnly` | `true` | No `public`/`private`/`protected` on constructor params |
| `verbatimModuleSyntax` | `true` | Requires explicit `type` imports |
| `isolatedModules` | `true` | Safe for transpilers |
| `allowImportingTsExtensions` | `true` | Imports use `.js` extensions but resolve to `.ts` at runtime via tsx |

**Notable:** No `paths` or `baseUrl` aliases configured. Imports are relative (`../../services/AuthService.js`).

### Run Scripts (`server/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `tsx watch src/index.ts` | Development with auto-reload |
| `start` | `tsx src/index.ts` | Production start (requires tsx) |
| `typecheck` | `tsc --noEmit` | TypeScript checking |
| `lint` | `eslint 'src/**/*.ts' --fix` | ESLint with auto-fix |
| `format` | `prettier --write 'src/**/*.ts'` | Prettier formatting |
| `test` | `vitest run` | Run tests once |
| `test:watch` | `vitest` | Watch mode |
| `seed` | `tsx src/seed.ts` | Seed roles/permissions/users |
| `seed-data` | `tsx src/seed-data.ts` | Seed sample data |
| `seed-full` | `tsx src/seed-full.ts` | Full seed |
| `backup` | `tsx scripts/backup.ts` | Database backup |
| `db:generate` | `drizzle-kit generate` | Generate SQL migrations |
| `db:migrate` | `drizzle-kit migrate` | Run migrations |
| `db:push` | `drizzle-kit push` | Push schema (dev only) |
| `db:studio` | `drizzle-kit studio` | Drizzle Studio GUI |

### Linting (`server/eslint.config.js`)

- ESLint v9 with flat config
- `@eslint/js` + `typescript-eslint` v8
- Run: `npm run lint`

### Drizzle ORM (`server/drizzle.config.ts`)

- Dialect: PostgreSQL
- Schema: `./src/db/schema.ts`
- Output: `./drizzle/`
- Commands: `db:generate`, `db:migrate`, `db:push`, `db:studio`

## 🚀 Development Workflow

### Daily startup (Windows)
```batch
start.bat
```
1. Kills processes on ports 3001 & 5173
2. Starts `server` with `tsx watch`
3. Waits for health check (`GET /api/health` → 200)
4. Starts `client` with `npm run dev` (Vite)
5. Opens browser at `http://localhost:5173`

### One-time setup
```batch
start.bat setup
```
1. Runs `src/setup.ts` — applies schema changes (drops/creates CHECK constraints, adds columns)
2. Runs seed script (roles, permissions, users, notification types)

### Manual seed
```batch
start.bat seed
```
Refreshes permissions only — safe with live data.

### Dev commands
```bash
cd server
npm run typecheck    # always first before editing
npm run lint         # fix warnings
npm run test         # run tests
npm run dev          # tsx watch with auto-reload
```

### Key quirk
`tsx watch` auto-reloads on `.ts` changes but only if the server was started *after* the code changes. If the server was running before edits, the old process must be killed first (start.bat handles this).

## 🐳 Deployment

### Current state: **No containerization or CI/CD**

- **No Dockerfile** — app runs directly via `tsx` or `node`
- **No docker-compose** — no container orchestration
- **No CI/CD config** — no GitHub Actions, GitLab CI, or similar
- **No .nvmrc or .node-version** — Node.js version not pinned
- **No Procfile** — not configured for Heroku or similar platforms

### Production readiness assessment

| Requirement | Status | Notes |
|-------------|--------|-------|
| Build step | ❌ | `tsc --noEmit` typechecks but does not emit JS. `npm run start` uses `tsx` which is a dev tool. |
| Compiled output | ❌ | No `build`/`dist` script. Runtime depends on `tsx` (TS interpreter, not compiled). |
| Package manager lock | ❌ | No `package-lock.json` committed (not in repo) |
| Environment management | ⚠️ Partial | `.env` is read but `.env.example` is missing |
| Process manager | ❌ | No PM2, forever, or systemd config |
| Containerization | ❌ | No Docker |
| CI/CD | ❌ | No pipeline config |
| Health checks | ✅ | `/api/health` endpoint exists |
| Error monitoring | ⚠️ Partial | Sentry configured but `SENTRY_DSN` is commented out in `.env` |
| Logging | ✅ | pino with structured JSON logging + pino-pretty for dev |

### Dependencies size

**Production dependencies:** 20 packages (99 dependencies total incl. transitive on disk)

**Key production deps:**
- `express` (web framework)
- `drizzle-orm` + `pg` / `better-sqlite3` (DB)
- `jsonwebtoken` + `bcryptjs` (auth)
- `helmet`, `cors`, `express-rate-limit` (security)
- `socket.io` (real-time)
- `multer` + `file-type` (file uploads)
- `sanitize-html`, `zod` (validation)
- `pino` (logging)
- `@sentry/node` (error tracking)

**Dev dependencies:** 16 packages. Notable: `tsx` v4, `typescript` v6, `vitest` v4, `supertest` v7, `eslint` v9, `drizzle-kit`

## 📦 Dependencies Analysis

### Strengths
- ✅ **Modern stack** — Express v4.21, TypeScript v6, Drizzle ORM v0.45, Vitest v4
- ✅ **No deprecated libraries** — All deps are current
- ✅ **Sensible middleware** — helmet, cors, rate-limit, zod validation
- ✅ **SQL injection prevention** — Drizzle ORM parameterizes all queries
- ✅ **Security-aware stack** — bcryptjs (not plain sha), sanitize-html, file-type for MIME verification

### Issues
1. **pg + better-sqlite3 both in production deps** — `pg` is dev database but `better-sqlite3` is used only in tests. Adding `better-sqlite3` as a production dependency (not devDependency) unnecessarily bloats production installs.
2. **No compiled build** — Running via `tsx` in production is unusual. Most Express apps compile with `tsc` and run with `node dist/index.js`. `tsx` is a development tool and its production performance characteristics are untested.
3. **No package-lock.json** — Missing `package-lock.json` means non-deterministic installs across environments.
4. **cookie-parser not used** — `cookie-parser` is in dependencies but `index.ts` never calls `app.use(cookieParser())`. The `authenticate` middleware reads `req.cookies?.token` directly without cookie-parser — this will always be `undefined` and tokens from cookies will never work. **(Bug)** .
5. **Node.js version not specified** — No `engines` field in `package.json`, no `.nvmrc`, no `.node-version`.

## ⚠️ Issues

1. **`cookie-parser` is imported but never initialized** — The `authenticate` middleware at `middleware/auth.ts:85` attempts `req.cookies?.token`, but cookie-parser middleware is never applied in `index.ts`. Token authentication via cookies silently fails; only `Authorization: Bearer` header works.
2. **No build step for production** — `npm run start` uses `tsx` to run TS directly. This is suitable for development but not production. TypeScript errors would only be caught at runtime if `typecheck` isn't run first.
3. **Sentry DSN is commented out** — In `.env`, `SENTRY_DSN` is commented. Error monitoring is effectively disabled by default.
4. **Seed scripts (data, full) referenced but not created** — `seed-data` and `seed-full` scripts in `package.json` but `src/seed-data.ts` and `src/seed-full.ts` may not exist or are incomplete. Only `seed.ts` is comprehensive.
5. **Uploads dir checks** — `multer` disk storage writes to `path.join(process.cwd(), 'uploads')` but there's no runtime check that this directory exists. If the directory is missing, file uploads will fail silently.
6. **No connection pooling for migrations** — `migrate.ts` creates a new Pool instead of reusing `getPool()`. This is a minor duplication but works.
7. **Vite proxy from client** — The client relies on the Vite dev server proxying `/api`, `/socket.io`, `/uploads` to `localhost:3001`. In production, a reverse proxy (nginx/Caddy) would be needed.

## 💡 Recommendations

1. **Add a production build script** — `"build": "tsc -p tsconfig.build.json"` with a `tsconfig.build.json` that sets `noEmit: false`, `outDir: dist`, and excludes test files.
2. **Fix cookie-parser** — Either add `app.use(cookieParser())` to `index.ts` or remove `cookie-parser` from dependencies and document that only Bearer token auth is supported.
3. **Create Dockerfile** — Multi-stage Docker build: build stage with `tsc`, production stage with only `dist/` and production dependencies.
4. **Move better-sqlite3 to devDependencies** — It's only needed for tests.
5. **Add CI/CD config** — GitHub Actions workflow: `typecheck` → `lint` → `test` → `build` (optional).
6. **Pin Node.js version** — Add `"engines": { "node": ">=20.0.0" }` to `package.json` and create `.nvmrc`.
7. **Uncomment Sentry DSN or provide .env.example** — Document all required env vars in a `.env.example` file.
8. **Add production process manager** — Configure PM2 ecosystem file or create a systemd service file.
9. **Create uploads directory on startup** — Add `fs.existsSync` check and create in `index.ts`.
10. **Add production start script** — `"start:prod": "node dist/index.js"` (after build step).
