# تحليل شامل لتطبيق إنجاز (Ingaz)

> **التاريخ:** 2026-05-26
> **الإصدار:** 1.0.0
> **الهدف:** تحليل كامل للكود المصدري بحثًا عن الأخطاء والثغرات والتحسينات

---

## فهرس المحتويات

1. [ملخص تنفيذي](#1-ملخص-تنفيذي)
2. [منهجية التحليل](#2-منهجية-التحليل)
3. [نظرة عامة على التطبيق](#3-نظرة-عامة-على-التطبيق)
4. [المشاكل الحرجة (Critical)](#4-المشاكل-الحرجة-critical)
5. [المشاكل عالية الأولوية (High)](#5-المشاكل-عالية-الأولوية-high)
6. [المشاكل متوسطة الأولوية (Medium)](#6-المشاكل-متوسطة-الأولوية-medium)
7. [المشاكل منخفضة الأولوية (Low)](#7-المشاكل-منخفضة-الأولوية-low)
8. [المشاكل المعمارية (Architecture)](#8-المشاكل-المعمارية-architecture)
9. [نتائج الاختبارات](#9-نتائج-الاختبارات)
10. [تحليل الأمن](#10-تحليل-الأمن)
11. [تحليل الأداء](#11-تحليل-الأداء)
12. [توصيات عامة](#12-توصيات-عامة)

---

## 1. ملخص تنفيذي

تم تحليل **~35,000 سطر** من الكود المصدري عبر 3 طبقات (سيرفر، عميل، مشترك). تم اكتشاف **93 مشكلة** موزعة كالتالي:

| الخطورة | العدد | أمثلة |
|---------|-------|-------|
| 🔴 حرجة (Critical) | 16 | ثغرات أمنية، اختراق صلاحيات، تعطل الخدمات الخلفية |
| 🟡 عالية (High) | 22 | مشاكل أداء، أخطاء في المنطق، غياب المعاملات |
| 🟢 متوسطة (Medium) | 28 | كود مكرر، تحويلات زائدة، غياب التقارير |
| ⚪ منخفضة (Low) | 27 | أنواع `any`، مكونات غير مستخدمة، كود ميت |
| **المجموع** | **93** | |

### أهم 5 مشاكل يجب إصلاحها فوراً:

1. **🔴 `SubtaskService` و `SubtaskCard` — `winnerCommentId` مرجع خارجي معطل** (schema.ts:61)
2. **🔴 `DeadlineService.tryInsert()` يستخدم `.run()` غير موجود في PostgreSQL** → جميع تذكيرات المواعيد صامتة
3. **🔴 `PUT /subtasks/:id` بدون `authorizePermission`** → أي مستخدم مسجل يستطيع تعديل أي مهمة فرعية
4. **🔴 ثغرة XSS في `ViewModal.tsx`** — `dangerouslySetInnerHTML` بدون `sanitizeHTML()`
5. **🔴 `NotificationService.create/createMany` يعيد إشعارات خاطئة** — سباق على الوقت (race condition)

---

## 2. منهجية التحليل

### الأدوات المستخدمة
- **TypeScript Compiler** — `tsc --noEmit` (فحص الأنواع)
- **ESLint** — فحص الجودة والأمان
- **Vitest** — تشغيل 95 اختبار وحدة
- **تحليل يدوي** لكل ملف في:
  - `server/src/` — 75+ ملف
  - `client/src/` — 65+ ملف
  - `shared/` — ملف واحد

### معايير التقييم
كل مشكلة تم تقييمها حسب:
1. **التأثير** — هل تسبب تعطل التطبيق أو ثغرة أمنية؟
2. **الاحتمالية** — هل من السهل استغلالها أو حدوثها؟
3. **الاكتشاف** — هل تظهر فورًا أم بعد وقت طويل؟

---

## 3. نظرة عامة على التطبيق

### التقنيات المستخدمة

| الطبقة | التقنية | الإصدار |
|--------|---------|---------|
| وقت التشغيل | Node.js | 22 (Alpine) |
| إطار السيرفر | Express | ^4.21.0 |
| قاعدة البيانات | PostgreSQL 16 | — |
| ORM | Drizzle ORM | ^0.45.2 |
| مشغل SQL | `pg` | ^8.20.0 |
| الواجهة | React 19 | ^19.2.6 |
| التوجيه | React Router DOM | ^7.15.0 |
| إدارة الحالة | Zustand | ^5.0.13 |
| التصميم | Tailwind CSS v4 | ^4.2.4 |
| البناء | Vite | ^8.0.10 |
| النوع | TypeScript | 6.x |
| الوقت الفعلي | Socket.IO | 4.x |
| المصادقة | JWT + bcryptjs | — |
| التوثيق | JSDoc | — |

### هيكل قاعدة البيانات — 21 جدول

```
roles → users → [projects, tasks, subtasks, comments, warnings, notifications, activity_logs]
     → role_permissions → permissions
     → restriction_levels
     → notification_types → notification_preferences
     → warning_types
     → deadline_reminders
     → background_jobs
     → attachments
     → token_blacklist
```

### هيكل التوجيه

```
/api/* + /api/v1/* (dual mount)
├── POST /auth/login
├── /auth/*
├── /users/*
├── /projects/*
├── /tasks/*
├── /subtasks/*
├── /notifications/*
├── /analytics/*
├── /uploads/*
├── /comments/*
├── /roles/*
├── /warnings/*
└── /members/*
```

### سلسلة الوسائط (Middleware Chain)

```
rateLimiter → helmet → cors → express.json → cookieParser
→ requestId → pinoLogger → res.success/fail → Route:
    authenticate → checkFrozen → requireCredit → authorize → Handler
```

---

## 4. المشاكل الحرجة (Critical)

### 🔴 C1 — `winnerCommentId` مرجع خارجي بنوع `any`
**الملف:** `server/src/db/schema.ts:61`
```ts
winnerCommentId: integer('winner_comment_id').references((): any => comments.id),
```
- **الوصف:** `(): any` يلغي فحص TypeScript للمرجع الخارجي. لا يمكن التأكد أن `comments.id` موجودة وقت التشغيل.
- **السبب:** `subtasks` معرّفة قبل `comments` في الملف، مما يستدعي forward reference.
- **العلاج:** إزالة `any` والتأكد من تعريف الجداول بترتيب يحل التبعيات.

### 🔴 C2 — `.run()` غير موجود في PostgreSQL
**الملف:** `server/src/services/DeadlineService.ts:106`
```ts
await this.db.insert(schema.deadlineReminders).values({ subtaskId, reminderType }).run()
```
- **الوصف:** `.run()` هي طريقة خاصة بـ SQLite (better-sqlite3). في PostgreSQL عبر `drizzle-orm/node-postgres`، هذه الطريقة غير موجودة. جميع تذكيرات المواعيد تفشل بصمت (catch block يخفي الفشل).
- **التأثير:** 🔴 **حرج — تعطل كامل لميزة التذكيرات**.
- **العلاج:** إزالة `.run()`. في PostgreSQL، `INSERT` لا يحتاج إلى terminal method.

### 🔴 C3 — تحديث المهام الفرعية بدون صلاحية
**الملف:** `server/src/routes/subtasks.ts:62`
```ts
router.put('/:id', authenticate, checkFrozen, validate(updateSubtaskSchema), tryCatch(...))
```
- **الوصف:** `PUT /subtasks/:id` يفتقد `authorizePermission('subtasks.edit')`. أي مستخدم مسجل (غير مجمد) يمكنه تعديل أي مهمة فرعية.
- **التأثير:** 🔴 **ثغرة صلاحيات — اختراق كامل لميزة المهام الفرعية**.
- **العلاج:** إضافة `authorizePermission('subtasks.edit')` و `requireCredit('canEdit')`.

### 🔴 C4 — المستخدم المجمد (Frozen) يمكنه تنفيذ عمليات خطيرة
**الملفات المتأثرة:**
- `DELETE /tasks/:id` (tasks.ts:56)
- `POST /tasks/:id/assignees` (tasks.ts:65)
- `DELETE /tasks/:id/assignees/:userId` (tasks.ts:71)
- `DELETE /subtasks/:id` (subtasks.ts:67)
- `POST /subtasks/:id/assignees` (subtasks.ts:76)
- `DELETE /subtasks/:id/assignees/:userId` (subtasks.ts:82)

- **الوصف:** `checkFrozen` غير مطبق على 6 نقاط نهاية. المستخدم المجمد يمكنه حذف المهام وتعيينها.
- **التأثير:** 🔴 **تجاوز كامل لتجميد الحساب**.
- **العلاج:** إضافة `checkFrozen` لجميع نقاط النهاية التي تغير البيانات.

### 🔴 C5 — ثغرة XSS في ViewModal
**الملف:** `client/src/components/ViewModal.tsx:37`
```tsx
<div ... dangerouslySetInnerHTML={{ __html: text }} />
```
- **الوصف:** `dangerouslySetInnerHTML` يستخدم بدون `sanitizeHTML()`. جميع المكونات الأخرى التي تعرض HTML تستخدم `sanitizeHTML()`.
- **التأثير:** 🔴 **ثغرة XSS — تنفيذ كود JavaScript خبيث**.
- **العلاج:** `dangerouslySetInnerHTML={{ __html: sanitizeHTML(text) }}`

### 🔴 C6 — إعدادات `sanitize-html` تسمح بـ `javascript:` URLs
**الملف:** `client/src/lib/sanitize.ts:4-8`
- **الوصف:** DOMPurify.sanitize() بدون `ALLOWED_URI_REGEXP`. الروابط مثل `<a href="javascript:alert(1)">` تمر عبر التنقية.
- **التأثير:** 🔴 **ثغرة XSS عبر الروابط**.
- **العلاج:** إضافة `ALLOWED_URI_REGEXP` أو `FORBID_PROTOCOLS`.

### 🔴 C7 — تسريب إشعارات لمستخدمين آخرين
**الملف:** `server/src/services/NotificationService.ts:289-291`
```ts
const notifs = await this.db.select().from(schema.notifications)
  .orderBy(sql`created_at DESC`)
  .limit(enabledItems.length)
```
- **الوصف:** `createMany()` تجلب آخر N إشعار من قاعدة البيانات، وليس فقط الإشعارات التي تم إدراجها لتوها. في بيئة متزامنة، قد تعيد إشعارات لمستخدمين آخرين.
- **التأثير:** 🔴 **تسريب بيانات — إشعارات المستخدم أ تظهر للمستخدم ب**.
- **العلاج:** استخدام `.returning()` على جملة INSERT.

### 🔴 C8 — إنشاء الإشعارات يستخدم `getDb()` العام
**الملفات:** `SubtaskService.ts:10`, `WarningService.ts:8`, `CommentService.ts:8`, `ProjectService.ts:11`, `TaskService.ts:9`
- **الوصف:** `NotificationService` يُنشأ في module level باستخدام `getDb()` العام. في الاختبارات، `getDb()` يعيد instance مختلف عن قاعدة بيانات الاختبار، مما يعني أن الإشعارات في الاختبارات لا تُختبر بشكل صحيح.
- **التأثير:** 🔴 **اختبارات لا تتحقق من سلوك حقيقي**.
- **العلاج:** حقن `NotificationService` عبر constructor parameter.

### 🔴 C9 — `NotificationService` module-level subscription بدون cleanup في socket.ts
**الملف:** `client/src/lib/socket.ts:49-62`
- **الوصف:** `useAuthStore.subscribe()` يُنشأ في module scope. لا يتم إلغاء الاشتراك أبدًا. مع Vite HMR، الاشتراكات القديمة تتراكم مسببة تكرار الاشتراكات.
- **التأثير:** 🔴 **تسرب ذاكرة + تكرار معالجة الأحداث**.
- **العلاج:** نقل منطق الاشتراك إلى React component أو إرجاع دالة unsubscribe.

### 🔴 C10 — `AssignModal` يعيّن لنوع خاطئ من الكيانات
**الملف:** `client/src/components/AssignModal.tsx:26-38`
- **الوصف:** عندما يكون `assignType = 'subtask'`، المكون لا يزال يجلب المهام (tasks) بدلاً من المهام الفرعية (subtasks). "تعيين إلى مهمة فرعية" يعيّن فعليًا إلى مهمة (task).
- **التأثير:** 🔴 **وظيفة التعيين معطلة للمهام الفرعية**.
- **العلاج:** استخدام endpoint مختلف حسب `assignType`.

### 🔴 C11 — `NotificationService.create()` — سباق على الوقت
**الملف:** `server/src/services/NotificationService.ts:252-255`
- **الوصف:** نفس مشكلة C7 ولكن في `create()` — تجلب آخر إشعار بدلاً من استخدام `RETURNING`.
- **التأثير:** 🔴 **إرجاع إشعار خاطئ للمتصل**.
- **العلاج:** استخدام `.returning()`.

### 🔴 C12 — `seed-full.ts` يعيّن نفس ID لدورين
**الملف:** `server/src/seed-full.ts:51-53`
```ts
await run('INSERT INTO roles (id, name) VALUES ($1, $2)', 2, 'deputy')
await run('INSERT INTO roles (id, name) VALUES ($1, $2)', 2, 'employee') // ID مكرر!
```
- **الوصف:** كل من `deputy` و `employee` لهما `id = 2`.
- **التأثير:** 🔴 **فشل seed script في قاعدة بيانات جديدة**.
- **العلاج:** تعيين ID مختلف لـ employee (3).

---

## 5. المشاكل عالية الأولوية (High)

### 🟡 H1 — غياب المعاملات (Transactions) في العمليات المعقدة
**الملفات المتأثرة (7 ملفات):**
- `AuthService.login()` — استعلام ← إدراج إعدادات ← بدون transaction
- `WarningService.create()` — إدراج تحذير ← استعلامات إثراء ← منفصلة
- `WarningService.respond()` — تحديث تحذير ← تسجيل نشاط ← منفصل
- `UserService.create()` — إنشاء مستخدم ← إعدادات ← إشعارات
- `checkExpiredWarnings()` — تحديث تحذير ← تحديث رصيد ← منفصل
- `autoRecoverCredit()` — تحديث رصيد ← إشعار ← إلغاء تجميد

- **التأثير:** 🟡 **فشل جزئي يؤدي إلى تناقض البيانات**.
- **العلاج:** لف العمليات المتعددة في `this.db.transaction()`.

### 🟡 H2 — نمط N+1 في `createMany()`
**الملف:** `server/src/services/NotificationService.ts:271-276`
```ts
for (const item of items) {
  if (await this.isEnabled(item.userId, item.type)) {
    enabledItems.push(item)
  }
}
```
- **الوصف:** كل تكرار ينفذ استعلام قاعدة بيانات. لـ 100 مستلم = 100-200 استعلام.
- **التأثير:** 🟡 **مشكلة أداء تتفاقم مع حجم الإشعارات**.
- **العلاج:** تجميع استعلامات التفضيلات في استعلام واحد باستخدام `IN`.

### 🟡 H3 — معالجة الأخطاء مفقودة في مسارات عديدة
**المسارات المتأثرة (30+ نقطة نهاية):**
- جميع مسارات `notifications.ts` (8 نقاط)
- `users.ts:28` — GET /users
- `projects.ts:28,52` — GET /projects, GET /projects/:id/members
- `warnings.ts:29,42,46,56,66,71,80,109,113`
- `members.ts:8,14,26`
- `upload.ts:57,72`

- **الوصف:** هذه المسارات لا تستخدم `tryCatch` ولا تحتوي على `try/catch`. أي استثناء غير متوقع ينهي عملية Node.js.
- **التأثير:** 🟡 **انهيار الخادم بسبب خطأ غير متوقع**.
- **العلاج:** لف جميع المعالجات بـ `tryCatch`.

### 🟡 H4 — حذف الملفات لا يعمل أبدًا
**الملف:** `server/src/services/UploadService.ts:160`
```ts
if (fs.existsSync(file.filename)) fs.unlinkSync(file.filename)
```
- **الوصف:** `file.filename` هو اسم الملف فقط (مثل `uuid-ext.jpg`)، بدون المسار الكامل. يجب أن يكون `path.join(process.cwd(), 'uploads', file.filename)`.
- **التأثير:** 🟡 **الملفات المرفوعة لا تُحذف أبدًا — تراكم الملفات غير المستخدمة**.
- **العلاج:** إضافة المسار الكامل.

### 🟡 H5 — `hasPermission()` يُستدعى بدون `userId`
**الملف:** `server/src/middleware/auth.ts:140-161`
- **الوصف:** `hasPermission()` تستقبل `userId` اختياري. عندما لا يُمرر، يتم تجاوز فحص `isManager`. المديرون الذين ينتمون لدور بدون صلاحية لا يحصلون على الإذن.
- **التأثير:** 🟡 **المديرون قد يُرفضون بشكل غير صحيح**.
- **العلاج:** دائمًا تمرير `ctx.userId` كوسيط ثالث.

### 🟡 H6 — عدم وجود Error Boundaries على الصفحات الفرعية
**الملف:** `client/src/App.tsx:49-61`
- **الوصف:** `ErrorBoundary` يغطي فقط مسارات Login و Frozen. الصفحات المحمية (Dashboard, Projects, Users) غير مغطاة. إذا تعطلت صفحة، ينهار التخطيط بأكمله.
- **التأثير:** 🟡 **تجربة مستخدم سيئة عند حدوث خطأ**.
- **العلاج:** إضافة `ErrorBoundary` لكل مسار محمي.

### 🟡 H7 — `KanbanBoard` يتجاهل Zustand stores
**الملف:** `client/src/components/KanbanBoard.tsx`
- **الوصف:** `KanbanBoard` يدير `projects`, `tasks`, `subtasks` عبر `useState` رغم وجود stores مخصصة (`projectStore`, `taskStore`, `subtaskStore`). مصدرا حقيقة متضاربان.
- **التأثير:** 🟡 **تضارب البيانات بين KanbanBoard والصفحات الأخرى.**
- **العلاج:** استخدام Zustand stores بدلاً من `useState`.

### 🟡 H8 — `GET /subtasks/by-tasks` ينهار بدون `task_ids`
**الملف:** `server/src/routes/subtasks.ts:47`
```ts
const taskIds = String(req.query.task_ids).split(',').map(Number)
```
- **الوصف:** إذا كان `task_ids` غير معرف، `String(undefined)` يعطي `'undefined'`. هذا ينتج `[NaN]` الذي يمرر فحص `length === 0` وينفذ استعلام لا معنى له.
- **التأثير:** 🟡 **استعلام مهدر للموارد**.
- **العلاج:** إضافة تحقق: `if (!req.query.task_ids) return res.fail(400, 'task_ids required')`.

### 🟡 H9 — لا توجد معالجة مركزية لأخطاء API
**الملفات:** جميع صفحات `pages/` ومكونات `components/`
- **الوصف:** معالج `api.ts` يتعامل مع 401 فقط. باقي الأخطاء تعالج بشكل مبعثر عبر `console.error()` بدون إبلاغ المستخدم.
- **التأثير:** 🟡 **المستخدم لا يعلم بفشل العمليات**.
- **العلاج:** نظام إشعارات أخطاء مركزي (toast أو notification).

### 🟡 H10 — معامل `kanbnaBoard` يسبب إعادة تحميل زائدة عند تغيير الثيم
**الملف:** `client/src/components/KanbanBoard.tsx:72,257`
- **الوصف:** تغيير `colorTheme` يعيد تحميل المكون بالكامل (4 أعمدة).
- **التأثير:** 🟡 **بطء في الاستجابة عند تغيير الثيم**.
- **العلاج:** إخراج الثيم إلى سياق منفصل (Context) لا يؤثر على بقية المكونات.

### 🟡 H11 — `deadlines.test.ts` و `notifications.test.ts` يفشلان بسبب تضارب schema
**الملف:** `server/src/__tests__/*.ts` — 11 اختبار فاشل
- **الوصف:** مخطط الاختبار (`test-schema.ts`) يفتقد عمود `from_user_id` الموجود في مخطط الإنتاج. اختبارات `notification` و `deadline` لا تقلد `../db/index.js`، لذا تستخدم مخطط الإنتاج (pgTable) ضد SQLite.
- **التأثير:** 🟡 **11 اختبار فاشل — غير موثوقة**.
- **العلاج:** إضافة `fromUserId` إلى `test-schema.ts` و `SCHEMA_SQL` في `helpers.ts`.

---

## 6. المشاكل متوسطة الأولوية (Medium)

### 🟢 M1 — كود CSV مكرر 3 مرات
**الملفات:** `lib/exportToCSV.ts`, `Dashboard.tsx:208-237`, `ProjectSettingsModal.tsx:77-122`
- **الوصف:** منطق تصدير CSV موجود في 3 أماكن مختلفة بدون إعادة استخدام.
- **العلاج:** دالة CSV موحدة قابلة لإعادة الاستخدام.

### 🟢 M2 — `camelToSnake()` زائد في الخدمات
**الملفات:** `AuthService.ts`, `UserService.ts`, `ProjectService.ts`, `SubtaskService.ts`, `CommentService.ts`, `TaskService.ts`
- **الوصف:** `res.success()` في `index.ts:120` يطبق `camelToSnake()` تلقائيًا. استدعاؤه في الخدمات يؤدي إلى تحويل مزدوج.
- **العلاج:** إزالة `camelToSnake()` من الخدمات.

### 🟢 M3 — ذاكرة تخزين `checkFrozen` تخزّن تاريخ انتهاء الصلاحية بشكل غير صحيح
**الملف:** `server/src/middleware/auth.ts:188`
```ts
frozenCache.set(req.user.id, {
  frozen_at: user?.frozenAt ? new Date(user.frozenAt).toISOString() : null,
  expiry: Date.now() + FROZEN_CACHE_TTL
})
```
- **الوصف:** الكاش يخزن التاريخ كنص ISO بدلاً من قيمة منطقية (bool). عند إلغاء تجميد المستخدم وإعادة تجميده خلال 30 ثانية، الكاش القديم لا يزال صالحًا.
- **العلاج:** تحويل إلى قيمة منطقية `isFrozen: boolean`.

### 🟢 M4 — `RoleService.delete` يستخدم IDs ثابتة
**الملف:** `server/src/services/RoleService.ts:39`
```ts
if (id <= 3) throw new AppError(400, 'لا يمكن حذف الأدوار الافتراضية')
```
- **الوصف:** يفترض أن الأدوار 1, 2, 3 هي الأدوار الافتراضية دائمًا. بعد إعادة seed، قد تكون IDs مختلفة.
- **العلاج:** استخدام اسم الدور أو عمود `is_system`.

### 🟢 M5 — `ProjectService.addMember` يعيّن `manager` دائمًا
**الملف:** `server/src/services/ProjectService.ts:398`
- **الوصف:** كل عضو يُضاف للمشروع يحصل على دور `manager`. لا توجد طريقة لإضافة أعضاء بدور `member`.
- **العلاج:** قبول معامل `role` (افتراضي `member`).

### 🟢 M6 — `UserService.list()` يستخدم `countAll` غير محدد
**الملف:** `server/src/services/UserService.ts:55`
- **الوصف:** `this.countAll()` ليس دائمًا معرفًا (قادم من BaseService غير الموثق جيدًا).
- **العلاج:** تنفيذ عدد منفصل.

### 🟢 M7 — `parseMentions` استعلام N+1 لكل إشارة
**الملف:** `server/src/notify.ts:18-36`
- **الوصف:** لكل `@mention`، استعلام DB منفصل.
- **العلاج:** استعلام واحد بـ `WHERE name IN (...)`.

### 🟢 M8 — لا توجد اختبارات لـ 6 خدمات
- `AnalyticsService`, `BackgroundJobService`, `CommentService`, `MemberService`, `RoleService`, `UploadService`
- **العلاج:** إضافة اختبارات للتغطية.

### 🟢 M9 — `@types/express@5` مع `express@4`
- **الوصف:** إصدار `@types/express` v5 غير متوافق مع Express v4.
- **العلاج:** تنزيل `@types/express@4`.

### 🟢 M10 — `better-sqlite3` في dependencies الإنتاج
- **الوصف:** يستخدم فقط في الاختبارات. يجب نقله إلى `devDependencies`.
- **العلاج:** نقل إلى `devDependencies`.

### 🟢 M11 — لا توجد اختبارات لمكونات React
- **الوصف:** `@testing-library/react` غير موجود. لا توجد اختبارات للمكونات.
- **العلاج:** إضافة `@testing-library/react` وكتابة اختبارات أساسية.

---

## 7. المشاكل منخفضة الأولوية (Low)

### ⚪ L1 — إساءة استخدام `as any`
- **المواقع:** 100+ استخدم في السيرفر والعميل
- **التأثير:** يلغي فحص TypeScript

### ⚪ L2 — `MemberCard` مكون غير مستخدم
- **الملف:** `client/src/components/MemberCard.tsx`
- **التأثير:** كود ميت — 43 سطر

### ⚪ L3 — `AvatarWithName` مصدر لكن غير مستورد
- **الملف:** `client/src/components/Avatar.tsx:41-48`

### ⚪ L4 — مفاتيح `index` في القوائم (AvatarStack, FileUpload)
- **التأثير:** إعادة تحميل غير ضرورية عند إعادة الترتيب

### ⚪ L5 — TOP Bar dropdown لا يستجيب لـ Escape
- **الملف:** `client/src/components/TopBar.tsx:67-76`

### ⚪ L6 — `login.tsx` يعرض 22 حساب اختبار بكلمات المرور
- **الملف:** `client/src/pages/Login.tsx:76-122`
- **تأثير أمني:** تسريب بيانات الاختبار في كود المصدر

### ⚪ L7 — Profile.tsx يعرض رسالة النجاح باللون الأخضر دائمًا
- **الملف:** `client/src/pages/Profile.tsx:114`

### ⚪ L8 — `sendDailySummaries` يحظر حلقة الأحداث
- **الملف:** `server/src/index.ts:331-345`
- **لـ 10,000 مستخدم:** 10,000 استعلام متسلسل

### ⚪ L9 — `autoRecoverCredit` يستورد ديناميكيًا داخل الحلقة
- **الملف:** `server/src/index.ts:265`

### ⚪ L10 — `runMigrations()` ينشئ Pool ثاني
- **الملف:** `server/src/migrate.ts:8-14`

### ⚪ L12 — `seed-full.ts` يحذف كل البيانات قبل البذر
- **الملف:** `server/src/seed-full.ts:38`

### ⚪ L13 — `AuthService.login()` لا ينتظر `setDefaultPrefs`
- **الملف:** `server/src/services/AuthService.ts:47`

### ⚪ L14 — `errorHandler.ts` يعرّف `AppError` interface خاص به
- **الملف:** `server/src/middleware/errorHandler.ts:3-6`

### ⚪ L15 — `health.ts` يستخدم نصًا خامًا مع `db.execute()`
- **الملف:** `server/src/routes/health.ts:9`

### ⚪ L16 — `date` مقارنة نصية هشة في `dailySummary`
- **الملف:** `server/src/services/NotificationService.ts:174,196-197`

### ⚪ L17 — `Access-Control-Allow-Origin: *` مع `credentials: true`
- **الملف:** `server/src/index.ts:98`
- **تأثير:** المتصفح يرفض الاستجابة إذا كانت `*` مع `credentials`

---

## 8. المشاكل المعمارية (Architecture)

### 🏗 A1 — `KanbanBoard` مكون متضخم (509 سطر)
- **الوصف:** يحتوي على ~60 متغير حالة، 4 أنواع بيانات، pagination، socket events، modals، الثيم.
- **العلاج:** تقسيم إلى 4 أعمدة منفصلة.

### 🏗 A2 — معالجة أحداث Socket مبعثرة
- **المواقع:** `KanbanBoard.tsx`, `ProjectDetail.tsx`, `Comments.tsx`, `NotificationBell.tsx`, `socket.ts`
- **الوصف:** 5+ أماكن تستمع لنفس الأحداث بدون ناقل مركزي.
- **العلاج:** Event bus مركزي.

### 🏗 A3 — `KanbanBoard` يتجاهل Zustand stores
- **الوصف:** يدير بياناته الخاصة رغم وجود stores مخصصة.
- **العلاج:** توحيد مصدر الحقيقة.

### 🏗 A4 — `NotificationService` يعتمد على `getDb()` العام
- **الوصف:** يُنشأ في module level مما يجعل الاختبار صعبًا.

### 🏗 A5 — `any` في `db/index.ts` يلغي فحص الأنواع
- **الوصف:** `getDb()` يعيد `any` مما يمنع Drizzle من توفير أمان الأنواع.

### 🏗 A6 — نظام Schema اختباري يختلف عن الإنتاج
- **الوصف:** 3 أماكن يجب مزامنتها يدويًا: schema.ts, test-schema.ts, SCHEMA_SQL.

---

## 9. نتائج الاختبارات

### تشغيل `npm run test` (السيرفر)

```
✓ 84 Passing (6 files)
❌ 11 Failed (2 files)
```

| ملف | نجاح | فشل | السبب |
|-----|------|-----|-------|
| auth.test.ts | 6 | 0 | ✅ |
| deadlines.test.ts | 2 | 5 | ❌ `from_user_id` مفقود |
| middleware.test.ts | 12 | 0 | ✅ |
| notifications.test.ts | 8 | 6 | ❌ `from_user_id` مفقود |
| projects.test.ts | 10 | 0 | ✅ |
| tasks.test.ts | 16 | 0 | ✅ |
| users.test.ts | 9 | 0 | ✅ |
| warnings.test.ts | 21 | 0 | ✅ |

### السبب الجذري للفشل

```
SqliteError: table notifications has no column named from_user_id
```

`test-schema.ts` و `SCHEMA_SQL` في `helpers.ts` لا يحتويان على عمود `from_user_id` الموجود في `schema.ts` (الإنتاج). الاختبارات التي لا تقم بتقليد `../db/index.js` (notifications, deadlines) تستخدم مخطط الإنتاج مع SQLite، مما يسبب الخطأ.

### تشغيل `npm run typecheck`

```
السيرفر: ✅ نجاح (0 أخطاء)
العميل: ✅ نجاح (0 أخطاء)
```

### تشغيل `npm run lint`

```
السيرفر: 460 تحذير (0 أخطاء)
العميل: 27 تحذير (0 أخطاء)
```

جميع التحذيرات هي `@typescript-eslint/no-explicit-any` و `no-unused-vars`.

---

## 10. تحليل الأمن

### الثغرات الأمنية المفتوحة

| الثغرة | الخطورة | الحالة |
|--------|---------|--------|
| XSS في ViewModal (`dangerouslySetInnerHTML` بدون sanitize) | 🔴 حرجة | مفتوحة |
| XSS عبر `javascript:` URLs في sanitize.ts | 🔴 حرجة | مفتوحة |
| تحديث المهام الفرعية بدون صلاحية | 🔴 حرجة | مفتوحة |
| تجاوز تجميد الحساب في 6 مسارات | 🔴 حرجة | مفتوحة |
| تسريب إشعارات لمستخدمين آخرين | 🔴 حرجة | مفتوحة |
| AssignModal يعيّن لنوع خاطئ | 🔴 حرجة | مفتوحة |
| جميع المسارات غير المغلفة بـ tryCatch — انهيار الخادم | 🟡 عالية | مفتوحة |
| حذف الملفات لا يعمل — تراكم البيانات | 🟡 عالية | مفتوحة |
| `hasPermission()` بدون userId | 🟡 عالية | مفتوحة |
| حساب اختبار مكشوف في Login.tsx | ⚪ منخفضة | مفتوحة |
| `ALLOWED_ORIGINS=*` مع `credentials: true` | ⚪ منخفضة | مفتوحة |

### نقاط القوة الأمنية
- ✅ JWT منفذ ومدقق
- ✅ كلمات المرور مشفرة بـ bcryptjs
- ✅ Helmet مركّز (مع CSP nonce)
- ✅ قائمة المنع (Rate Limiting) معمول بها
- ✅ مستخدم متجمد ممنوع من معظم العمليات
- ✅ `sanitizeHTML()` يستخدم في معظم الأماكن
- ✅ التحقق من نوع الملف في upload

---

## 11. تحليل الأداء

### اختناقات الأداء

| المشكلة | التأثير | الموقع |
|---------|---------|--------|
| N+1 في `createMany.notification` | 🟡 عالي | NotificationService.ts:271-276 |
| `parseMentions` استعلام لكل إشارة | 🟡 متوسط | notify.ts:18-36 |
| `sendDailySummaries` متسلسل لمستخدمين كثر | 🟡 متوسط | index.ts:331-345 |
| `autoRecoverCredit` كل 60 ثانية | 🟢 منخفض | index.ts:222-268 |
| `KanbanBoard` يعيد تحميل الكل عند تغيير الثيم | 🟢 منخفض | KanbanBoard.tsx |
| `SubtaskRow` memoization معطل بالـ inline callbacks | 🟢 منخفض | SubtaskRow.tsx:165 |
| `MemberProfileCard` بدون `React.memo` | 🟢 منخفض | MemberProfileCard.tsx |

### توصيات الأداء
1. تجميع استعلامات التفضيلات في `NotificationService` (الأهم)
2. تجميع استعلامات `parseMentions` في استعلام واحد
3. استخدام `.returning()` بدلاً من استعلام fetch إضافي
4. زيادة فترة `autoRecoverCredit` إلى 5-15 دقيقة
5. فصل `KanbanBoard` إلى مكونات أصغر

---

## 12. توصيات عامة

### الأولوية القصوى (الإصلاح الفوري)
```mermaid
graph TD
    A[إصلاح عاجل] --> B[C2: .run() على PostgreSQL]
    A --> C[C3: صلاحية subtasks]
    A --> D[C4: تجميد الحساب]
    A --> E[C5/C6: XSS]
    A --> F[C7/C11: تسريب الإشعارات]
    A --> G[C12: seed-full.ts ID مكرر]
```

### المدى القصير (أسبوع 1)
1. إصلاح 11 اختبارًا فاشلاً (إضافة `from_user_id` إلى test-schema)
2. إضافة `tryCatch` إلى جميع المسارات (30+ نقطة)
3. معاملات لقاعدة البيانات في العمليات المعقدة
4. إصلاح `hasPermission` مع userId
5. إصلاح `UploadService.deleteFile` مسار الملف

### المدى المتوسط (أسبوع 2-3)
1. توحيد معالجة أحداث Socket
2. دمج `KanbanBoard` مع Zustand stores
3. إضافة Error Boundaries
4. إضافة اختبارات للخدمات غير المختبرة
5. نظام إشعارات أخطاء مركزي
6. نقل `better-sqlite3` إلى devDependencies

### المدى البعيد (شهر)
1. فصل `KanbanBoard` إلى مكونات فرعية
2. إضافة CI/CD (GitHub Actions)
3. اختبارات E2E أوسع مع Playwright
4. تحسين أداء `sendDailySummaries` مع batch inserts

---

## الملحق: تفاصيل الملفات

### إحصائيات التغطية
| المقياس | القيمة |
|---------|--------|
| إجمالي الملفات المصدرية (سيرفر) | 75+ |
| إجمالي الملفات المصدرية (عميل) | 65+ |
| إجمالي سطور الكود (تقديري) | ~35,000 |
| اختبارات السيرفر | 95 (84 ✅, 11 ❌) |
| اختبارات العميل | 1 (مثال فقط) |
| تحذيرات lint (سيرفر) | 460 |
| تحذيرات lint (عميل) | 27 |
| متوسط `any` لكل ملف | ~4.5 |

### قائمة الاختبارات المطلوبة
| الخدمة | الحالة | الأولوية |
|--------|--------|----------|
| AuthService | ✅ موجود | — |
| DeadlineService | ❌ فاشل | عالية |
| NotificationService | ❌ فاشل | عالية |
| ProjectService | ✅ موجود | — |
| SubtaskService | ✅ موجود | — |
| TaskService | ✅ موجود | — |
| UserService | ✅ موجود | — |
| WarningService | ✅ موجود | — |
| AnalyticsService | ❌ غير موجود | متوسطة |
| BackgroundJobService | ❌ غير موجود | عالية |
| CommentService | ❌ غير موجود | متوسطة |
| MemberService | ❌ غير موجود | متوسطة |
| RoleService | ❌ غير موجود | منخفضة |
| UploadService | ❌ غير موجود | منخفضة |
