# Ingaz — خطة التنفيذ الاحترافية

> مستوحاة من منهجية [Ralph Agent Loop](https://fullstackrecipes.com/r/ralph.json) للتطوير التكراري الآلي، و [OpenCode Agents](https://opencode.ai/docs/agents/) + [Skills](https://opencode.ai/docs/skills/) للتنظيم

---

## فهرس

1. [النظرة العامة](#1-النظرة العامة)
2. [هندسة الأدوات](#2-هندسة-الأدوات)
3. [الـ Skills المخصصة](#3-الـ-skills-المخصصة)
4. [الـ Agents المخصصة](#4-الـ-agents-المخصصة)
5. [بروتوكول الجلسات](#5-بروتوكول-الجلسات)
6. [المراحل التنفيذية](#6-المراحل-التنفيذية)
7. [مصفوفة التبعيات](#7-مصفوفة-التبعيات)
8. [مخطط التدفق](#8-مخطط-التدفق)

---

## 1. النظرة العامة

### المشكلة
تطبيق Ingaz (إنجاز) يعاني من **16 مشكلة** مكتشفة عبر التحليل الذري الشامل، موزعة كالتالي:
- 🔴 **4 Critical** — تهدد استقرار وأمان التطبيق
- 🟡 **6 High Priority** — تؤثر على الأداء والتجربة
- 🟢 **6 Nice to Have** — تحسينات طويلة المدى

### المنهجية
سنتبع **Ralph iteration loop** المُكيَّف لبيئة OpenCode:

```
لكل مرحلة:
  1. Load Context → قراءة AGENTS.md + docs/phase-*.md
  2. Analyze → فهم المشكلة وموقعها بالضبط
  3. Plan → وضع خطة تغيير دقيقة
  4. Execute → تنفيذ التغييرات (مع sub-agents للتوازي)
  5. Verify → typecheck + lint + test
  6. Document → كتابة docs/phase-N-*.md
  7. Handoff → تحديث AGENTS.md + إنشاء مستند التسليم
```

### مبدأ التنفيذ
- **مرحلة واحدة = جلسة واحدة** (أو جزء من جلسة إذا كانت قصيرة)
- **عند امتلاء السياق** → ننهي المرحلة، نوثّق، ونفتح جلسة جديدة
- **التوازي** → المهام المستقلة تُنفَّذ عبر `task` sub-agents في وقت واحد

---

## 2. هندسة الأدوات

### 2.1 OpenCode Agents — مَن يفعل ماذا

سننشئ 4 agents مخصصة عبر ملفات markdown في `.opencode/agents/`:

```
.opencode/agents/
├── security-agent.md    # معالجة الثغرات الأمنية
├── db-agent.md          # تعديلات قاعدة البيانات و Drizzle
├── client-agent.md      # تحسينات واجهة المستخدم
└── docs-agent.md        # توثيق التغييرات
```

#### a. security-agent (subagent)
```
الغرض:     معالجة الثغرات الأمنية
الصلاحيات: read + edit + bash (git diff, npm run typecheck...)
الاستخدام: عندما نجد مشكلة مثل JWT_SECRET fallback أو cookie-parser غير مفعّل
```

#### b. db-agent (subagent)
```
الغرض:     تعديلات Drizzle ORM + الترحيلات + الـ FK
الصلاحيات: read + edit + bash
الاستخدام: لإضافة FOREIGN KEY أو تعديل schema.ts
```

#### c. client-agent (subagent)
```
الغرض:     تحسينات واجهة React
الصلاحيات: read + edit + bash
الاستخدام: لإصلاح Error boundaries، socket stores، duplicate statusConfig
```

#### d. docs-agent (subagent)
```
الغرض:     كتابة التوثيق
الصلاحيات: read + write (فقط)
الاستخدام: بعد كل مرحلة — كتابة docs/phase-N-*.md
```

### 2.2 Task Sub-agents — التنفيذ المتوازي

السيرفر الرئيسي يستخدم `task()` لتشغيل مهام متوازية:
- مثلاً: إصلاح 3 مشاكل في السيرفر دفعة واحدة
- كل sub-agent مستقل، يقرأ ملفه، ينفذ، يرجع النتيجة

### 2.3 الأدوات المدمجة المستخدمة

| الأداة | الاستخدام |
|--------|-----------|
| `task` (general) | تشغيل sub-agents للتنفيذ المتوازي |
| `task` (explore) | البحث السريع في الكود قبل التعديل |
| `bash` | typecheck, lint, test, git |
| `read`/`edit`/`write` | تعديل الملفات |
| `glob`/`grep` | البحث عن الأنماط |
| `skill` | تحميل مهارة قابلة لإعادة الاستخدام |

---

## 3. الـ Skills المخصصة

سننشئ 4 skills لإعادة الاستخدام عبر المراحل:

```
.opencode/skills/
├── phase-verify/SKILL.md     # التحقق من الجودة بعد كل مرحلة
├── phase-document/SKILL.md   # توثيق المرحلة كتابةً
├── session-handoff/SKILL.md  # تسليم السياق بين الجلسات
└── git-commit/SKILL.md       # تسجيل التغييرات في Git
```

### 3.1 phase-verify

```
---name: phase-verify
description: Run typecheck + lint + test after completing a phase
---
1. Run `cd server && npm run typecheck`
2. If errors: fix them, re-run
3. Run `cd client && npm run typecheck`
4. If errors: fix them, re-run
5. Run `cd server && npm run lint`
6. Fix any lint warnings
7. Run `cd server && npm run test`
8. All 43 tests must pass
```

### 3.2 phase-document

```
---name: phase-document
description: Write phase completion markdown to docs/
---
1. Create `docs/phase-<N>-<title>.md`
2. Include:
   - Phase number and title
   - Problems addressed (with links to analysis/)
   - Files modified (full paths)
   - Changes summary (what was done and why)
   - Verification results (typecheck ✓, lint ✓, test ✓)
   - Known issues / follow-ups
3. Update `AGENTS.md` progress section
```

### 3.3 session-handoff

```
---name: session-handoff
description: Create handoff document for next session
---
1. Read current AGENTS.md Progress + Key Decisions sections
2. Read latest docs/phase-*.md
3. Create `docs/session-handoff-<date>.md` containing:
   - Current session state
   - What was completed
   - What remains (next phases)
   - Context to restore (relevant file paths, decisions)
   - Command to run at session start
```

### 3.4 git-commit

```
---name: git-commit
description: Commit changes with conventional commit message
---
1. Run `git status` to review changes
2. Run `git diff` to verify content
3. Stage specific files: `git add <files>`
4. Commit with message format:
   `phase-N: <area>: <brief description>`
5. Do NOT push unless asked
```

---

## 4. الـ Agents المخصصة

سنقوم بإنشاء agents عبر `.opencode/agents/`:

### 4.1 security-agent

```markdown
---
description: Fixes security vulnerabilities in the Ingaz server
mode: subagent
permission:
  read: allow
  edit: allow
  bash:
    "*": ask
    "cd server && npm run typecheck": allow
    "cd client && npm run typecheck": allow
    "git diff": allow
    "git status": allow
    "cd server && npm run test": allow
---
You are a security-focused agent for the Ingaz application.

## Your responsibilities:
- Fix hardcoded secrets (JWT_SECRET fallback, etc.)
- Enable missing middleware (cookie-parser, helmet)
- Add missing authentication/authorization checks
- Fix token blacklist verification
- Remove insecure patterns

## Always:
1. Read the relevant analysis file from analysis/ first
2. Understand the problem completely
3. Make minimal, focused changes
4. Run typecheck after changes
5. Report what you changed and why
```

### 4.2 db-agent

```markdown
---
description: Handles database schema changes and migrations
mode: subagent
permission:
  read: allow
  edit: allow
  bash:
    "*": ask
    "cd server && npm run typecheck": allow
    "cd server && npm run db:generate": allow
    "cd server && npm run db:migrate": allow
    "git diff": allow
    "git status": allow
---
You are a database agent for the Ingaz application (PostgreSQL + Drizzle ORM).

## Your responsibilities:
- Add missing FOREIGN KEY constraints
- Fix schema migrations
- Add missing indexes
- Add CHECK constraints
- Fix setup.ts migration logic

## Always:
1. Read analysis/02-database/01-schema.md for context
2. Read the current schema.ts before making changes
3. Generate migration after schema changes
4. Run typecheck after changes
5. The schema is in server/src/db/schema.ts
```

### 4.3 client-agent

```markdown
---
description: Improves React frontend code and state management
mode: subagent
permission:
  read: allow
  edit: allow
  bash:
    "*": ask
    "cd client && npm run typecheck": allow
    "git diff": allow
    "git status": allow
---
You are a client-side React agent for the Ingaz application.

## Your responsibilities:
- Add Error Boundaries to pages
- Fix socket event handling in stores
- Eliminate duplicate code (statusConfig)
- Add domain stores (projectStore, taskStore, subtaskStore)
- Fix N+1 queries in components

## Always:
1. Read analysis/04-client/ for context
2. Understand existing patterns before changing
3. Maintain RTL support (Arabic UI)
4. Run typecheck after changes
5. Report what you changed and why
```

### 4.4 docs-agent

```markdown
---
description: Writes phase documentation
mode: subagent
permission:
  read: allow
  write: allow
  bash: deny
---
You are a documentation agent for the Ingaz project.

## Your responsibilities:
- Write phase completion documents in docs/
- Update AGENTS.md progress section
- Create session handoff documents
- Ensure all documentation is in clear Arabic or English
- Link to relevant analysis/ files

## Always:
1. Read the previous phase doc for continuity
2. Include all modified files with paths
3. Include verification results
4. Keep it concise but complete
```

---

## 5. بروتوكول الجلسات

### 5.1 متى نفتح جلسة جديدة

نفتح جلسة OpenCode جديدة عندما:

1. **امتلاء السياق** — بعد 3-4 مراحل أو ~30 أداة استخدام
2. **تغيير المجال** — من Backend (server) إلى Frontend (client)
3. **طلب المستخدم** — المستخدم يريد متابعة العمل لاحقاً
4. **فشل معقد** — خطأ يستدعي تحققاً عميقاً

### 5.2 محتوى التسليم (Handoff Document)

```
docs/session-handoff-YYYY-MM-DD.md
├── Session: <رقم الجلسة>
├── Completed Phases: <القائمة>
├── Next Phase: <المرحلة التالية>
├── Context:
│   ├── Last modified files
│   ├── Current state of the code
│   ├── Any pending changes / stashes
│   └── Known blockers
├── Commands:
│   └── <أوامر البدء>
└── Decisions:
    └── <قرارات مهمة اتخذت>
```

### 5.3 استعادة السياق

عند فتح جلسة جديدة، ننفذ:
1. `type AGENTS.md` — قراءة الملخص الكامل
2. `type docs/session-handoff-*.md` — قراءة آخر تسليم
3. `type docs/phase-<N>-*.md` — قراءة آخر مرحلة مكتملة
4. التحقق من `git status` للتأكد من الوضع الحالي

### 5.4 تنسيق أسماء الملفات

```
docs/phase-01-critical-fixes.md      # المرحلة 1
docs/phase-02-auth-middleware.md      # المرحلة 2
docs/phase-03-database-constraints.md # المرحلة 3
docs/session-handoff-2026-05-20.md   # تسليم الجلسة
```

---

## 6. المراحل التنفيذية

### 🔴 المرحلة 1: Critical Security Fixes
**الهدف:** إزالة الثغرات الأمنية الحرجة

| # | المشكلة | الملفات المتأثرة | المقاربة |
|---|---------|-----------------|----------|
| C1 | JWT_SECRET fallback | `server/src/index.ts` | إزالة fallback، قراءة من env |
| C2 | cookie-parser غير مفعّل | `server/src/index.ts` | تفعيل middleware |
| C3 | subtasks.winnerCommentId بلا FK | `server/src/db/schema.ts` | إضافة FK → comments.id |
| C4 | setup.ts ترحيل مزدوج | `server/src/db/setup.ts` | إعادة هيكلة المنطق |

**التقنية:**
1. استدعاء `security-agent` لإصلاح C1, C2
2. استدعاء `db-agent` لإصلاح C3, C4 (بالتوازي)
3. `phase-verify` → typecheck + lint + test
4. `phase-document` → `docs/phase-01-critical-fixes.md`
5. `git-commit` → `git add -A && git commit -m "phase-01: fix critical security and db issues"`

**معيار النجاح:**
- ✅ typecheck server يمر
- ✅ typecheck client يمر
- ✅ lint بلا أخطاء
- ✅ 43 اختبار تنجح
- ✅ JWT_SECRET بدون fallback
- ✅ cookie-parser مفعّل
- ✅ FK موجود

---

### 🟡 المرحلة 2: Authentication & Authorization
**الهدف:** تقوية المصادقة والترخيص

| # | المشكلة | الملفات المتأثرة |
|---|---------|-----------------|
| 5 | token_blacklist غير مُفحَص | `server/src/middleware/auth.ts` |
| 6 | لا Transactions في الخدمات | `server/src/services/*.ts` |
| 10 | تغطية اختبارية ضعيفة | `server/src/__tests__/*.test.ts` |

**التقنية:**
1. إضافة `isBlacklisted()` في `auth.ts`
2. إضافة `db.transaction()` لجميع العمليات المركبة
3. إضافة اختبارات للمشاكل الموجودة

**التنفيذ المتوازي:**
- `task(general)` → إصلاح blacklist check
- `task(general)` → إضافة transactions
- `task(general)` → كتابة tests جديدة

---

### 🟡 المرحلة 3: Client State & Performance
**الهدف:** تحسين إدارة الحالة والأداء في الواجهة

| # | المشكلة | الملفات المتأثرة |
|---|---------|-----------------|
| 8 | Socket لا يحدّث الـ stores | `client/src/lib/socket.ts`, `client/src/store/*.ts` |
| 9 | لا Error boundaries | `client/src/pages/*.tsx` |
| 12 | لا Domain stores | `client/src/store/*.ts` |
| 7 | N+1 في CSV export | `client/src/components/ProjectSettingsModal.tsx` |

**التقنية:**
1. `client-agent` → إنشاء domain stores + ربط socket
2. `client-agent` → إضافة Error boundaries لكل الصفحات
3. `client-agent` → إصلاح N+1

---

### 🟡 المرحلة 4: Testing Expansion
**الهدف:** رفع تغطية الاختبارات

| # | المجال | عدد الاختبارات المتوقعة |
|---|--------|------------------------|
| Middleware | 8-10 | authenticate, authorize, requireCredit, checkFrozen |
| Projects | 6-8 | CRUD + members |
| Users | 4-6 | CRUD + status changes |
| Notifications | 4-6 | CRUD + preferences |
| Upload | 3-5 | upload, get, delete |

**التقنية:**
- إنشاء `server/src/__tests__/middleware.test.ts`
- إنشاء `server/src/__tests__/projects.test.ts`
- إنشاء `server/src/__tests__/users.test.ts`
- استخدام `better-sqlite3` (in-memory) كما في الاختبارات الحالية

---

### 🟢 المرحلة 5: Code Quality & Refactoring
**الهدف:** تحسين جودة الكود وإزالة التكرار

| # | المشكلة | المقاربة |
|---|---------|----------|
| 11 | statusConfig مكرر 6 مرات | source واحد مشترك |
| 13 | لا Repository layer | طبقة تجريد للـ db |
| 16 | Notification.related: any | typing دقيق |

---

### 🟢 المرحلة 6: Infrastructure & DevOps
**الهدف:** تحسين البنية التحتية

| # | المشكلة | المقاربة |
|---|---------|----------|
| 14 | Background jobs | Queue (Bull/BullMQ) |
| 15 | package-lock.json | npm install ينتجه |
| - | Docker | Dockerfile + compose |

---

## 7. مصفوفة التبعيات

```
Phase 1 (Critical)
  ├── لا تبعيات
  └── ضروري لـ Phase 2 (لأن التصحيحات الأمنية أساس)

Phase 2 (Auth + Transactions)
  └── يعتمد على Phase 1 (نفس الملفات)

Phase 3 (Client)
  ├── مستقل عن Phase 2
  └── يمكن تنفيذه بالتوازي مع Phase 2

Phase 4 (Tests)
  ├── يعتمد على Phase 1 (البنية الأساسية)
  ├── يعتمد على Phase 2 (الخدمات المعدّلة)
  └── يمكن أن يبدأ بعد Phase 2

Phase 5 (Refactoring)
  └── يعتمد على Phase 3 (العميل)

Phase 6 (Infrastructure)
  └── مستقل — يمكن في أي وقت
```

### خريطة التنفيذ المتوازي

```
الجلسة 1:
├── Phase 1 (Critical) — إلزامي
└── Handoff → docs/session-handoff-1.md

الجلسة 2:
├── Phase 2 (Auth) — بالتوازي مع ← Phase 3 (Client)
└── Handoff → docs/session-handoff-2.md

الجلسة 3:
├── Phase 4 (Tests)
└── Handoff → docs/session-handoff-3.md

الجلسة 4:
├── Phase 5 (Refactoring) — بالتوازي مع ← Phase 6 (Infrastructure)
└── Final Summary
```

---

## 8. مخطط التدفق

```
                    ┌──────────────┐
                    │  Start       │
                    │  Read Context│
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Phase N     │
                    │  [Load Skill]│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌───▼───┐ ┌─────▼──────┐
       │Task Agent A │ │Task B │ │Task C      │
       │(independent)│ │(indep)│ │(independent)│
       └──────┬─────┘ └───┬───┘ └─────┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼───────┐
                    │  Verify      │
                    │  [Skill]     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼─────┐ ┌───▼───┐ ┌─────▼──────┐
       │  Document  │ │Commit │ │ Handoff?   │
       │  [Skill]   │ │[Skill]│ │ (context   │
       └────────────┘ └───────┘ │  full?)    │
                                └──┬──┬──────┘
                           No ──────┘  │ Yes
                                       │
                                ┌──────▼───────┐
                                │ New Session  │
                                │ [Handoff Doc]│
                                └──────────────┘
```

---

## 9. بدء التنفيذ

### أول أمر في كل جلسة
```bash
# 1. قراءة الملخص
type AGENTS.md | head -80

# 2. قراءة آخر مرحلة
dir docs\phase-*.md | select -Last 1

# 3. قراءة آخر تسليم (إن وجد)
dir docs\session-handoff-*.md | select -Last 1

# 4. التحقق من الوضع
git status
```

### أول أمر عند بدء المرحلة الأولى
```bash
cd server && npm run typecheck  # التأكد من الوضع الحالي
cd client && npm run typecheck
cd server && npm run test       # 43 test يجب أن تنجح
```
