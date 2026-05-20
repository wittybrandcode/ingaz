# ✅ المرحلة 2 — الأداء (Performance) — منجزة بالكامل

**الهدف:** تحسين أداء قاعدة البيانات وتقليل زمن تحميل الصفحات.

**المدة الفعلية:** ~6 ساعات

**الحالة:** ✅ جميع البنود منفذة (7/7) والـ typecheck يمر بلا أخطاء

---

## ✅ 2.1 إصلاح N+1 query في subtask assignees

| الحقل | القيمة |
|-------|--------|
| **المعرف** | P1 |
| **الحرجية** | 🔴 CRITICAL |
| **المشكلة** | `subtasks.ts:40-43` — `getSubtaskAssignees()` تُستدعى لكل subtask داخل `.map()`. مع 50 subtask → 51 query (1 + 50). |
| **الحل** | استبدال N+1 بجلب جميع assignees دفعة واحدة (batch fetch) باستخدام `IN` clause. |
| **الجهد** | 1 ساعة |
| **الملفات** | `server/src/routes/subtasks.ts`, `server/src/db.ts` |
| **خطوات التنفيذ** | 1. إنشاء دالة `getBulkSubtaskAssignees(subtaskIds: number[])` في `db.ts`<br>2. استدعاؤها مرة واحدة في route handler<br>3. ربط النتائج بالـ subtasks في map |

---

## ✅ 2.2 إضافة Pagination إلى 3 endpoints

| الحقل | القيمة |
|-------|--------|
| **المعرف** | P2, P3, P4 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | `GET /projects/:id` (P2)، `GET /tasks/project/:projectId` (P3)، `GET /subtasks/task/:taskId` (P4) — كلها تُرجع كل البيانات دفعة واحدة بدون `LIMIT`/`OFFSET`. |
| **الحل** | إضافة query params `page`/`limit` مع قيم افتراضية (مثلاً limit=20). إرجاع `total` و `page` و `pages` في الـ response. |
| **الجهد** | 3 ساعات |
| **الملفات** | `server/src/routes/projects.ts`, `server/src/routes/tasks.ts`, `server/src/routes/subtasks.ts`, `server/src/db.ts` |
| **خطوات التنفيذ** | 1. إضافة `page` و `limit` params validation<br>2. تعديل queries لاستخدام `LIMIT ? OFFSET ?`<br>3. إضافة `COUNT(*)` query لحساب `total`<br>4. تحديث types في `shared/types.ts` |

---

## ✅ 2.3 إزالة dead dependency `recharts`

| الحقل | القيمة |
|-------|--------|
| **المعرف** | P6 |
| **الحرجية** | 🟢 LOW |
| **المشكلة** | `client/package.json` — `recharts` مثبت لكنه غير مستخدم (أبداً لم يُستورد). يضيف ~200KB غير ضروري للحزمة. |
| **الحل** | إزالة `recharts` من `package.json` وتشغيل `npm uninstall`. |
| **الجهد** | 5 دقائق |
| **الملفات** | `client/package.json` |
| **خطوات التنفيذ** | 1. `npm uninstall recharts`<br>2. التحقق من عدم وجود imports متبقية |

---

## ✅ 2.4 إضافة Code Splitting (React.lazy) — كان منفذاً مسبقاً

| الحقل | القيمة |
|-------|--------|
| **المعرف** | P7 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `App.tsx` — كل الصفحات تُستورد بشكل ثابت (static import). الحزمة الواحدة تشمل كل الكود حتى لو المستخدم لم يسجل دخوله بعد. |
| **الحل** | استخدام `React.lazy()` + `Suspense` لكل صفحة. إضافة `React.lazy` للمسارات: Login, Dashboard, ProjectDetail, Users, Roles, Warnings, إلخ. |
| **الجهد** | 2 ساعات |
| **الملفات** | `client/src/App.tsx` |
| **خطوات التنفيذ** | 1. تحويل `import X from './pages/X'` → `const X = React.lazy(() => import('./pages/X'))`<br>2. إضافة `<Suspense fallback={<Loading />}>` حول Routes<br>3. إنشاء `Loading.tsx` مكون بسيط |

---

## ✅ 2.5 إضافة React.memo إلى مكونات القوائم

| الحقل | القيمة |
|-------|--------|
| **المعرف** | P8 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `TaskCard`, `SubtaskCard`, `ProjectCard`, `MemberCard`, `SubtaskRow` — كلها بدون `React.memo`. كل render للأب يعيد تصيير كل العناصر حتى لو لم تتغير. |
| **الحل** | لف كل مكون بـ `React.memo` مع مقارنة الـ props. |
| **الجهد** | 1 ساعة |
| **الملفات** | `client/src/components/TaskCard.tsx`, `SubtaskCard.tsx`, `ProjectCard.tsx`, `MemberCard.tsx`, `SubtaskRow.tsx` |
| **خطوات التنفيذ** | 1. إضافة `export default React.memo(Component)` لكل مكون<br>2. التأكد من أن الـ props بدائية أو `useMemo`/`useCallback` في الأب |

---

## ✅ 2.6 إضافة AbortController إلى loadSubtasks

| الحقل | القيمة |
|-------|--------|
| **المعرف** | P10 (جزئي) + TD7 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `ProjectDetail.tsx` — `load()` يجلب البيانات بدون AbortController. التبديل السريع بين المشاريع يسبب سباق طلبات (race condition). |
| **الحل** | إضافة AbortController لكل `load*()` دالة داخل `useEffect` مع cleanup لإلغاء الطلب السابق. |
| **الجهد** | 30 دقيقة |
| **الملفات** | `client/src/pages/ProjectDetail.tsx` |
| **خطوات التنفيذ** | 1. إنشاء `AbortController` داخل useEffect<br>2. تمرير `signal` إلى fetch calls<br>3. استدعاء `controller.abort()` في cleanup |

---

## ✅ 2.7 إضافة 5 indexes مفقودة

| الحقل | القيمة |
|-------|--------|
| **المعرف** | PF |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | 5 indexes مقترحة غير موجودة: `notifications(user_id, created_at)`، `attachments(uploaded_by)`، `activity_logs(user_id, created_at)`، `project_members(user_id)`، `warnings(user_id, created_at)`. |
| **الحل** | إضافة CREATE INDEX statements في `db.ts`. |
| **الجهد** | 30 دقيقة |
| **الملفات** | `server/src/db.ts` |
| **خطوات التنفيذ** | 1. إضافة 5 CREATE INDEX IF NOT EXISTS بعد تعريف الجداول |

---

## خلاصة المرحلة

| البند | الجهد | الأولوية | الحالة |
|-------|-------|----------|--------|
| 2.1 N+1 query | 1 س | 🔴 Critical | ✅ |
| 2.2 Pagination (3 endpoints) | 3 س | 🔴 High | ✅ |
| 2.3 إزالة recharts | 5 د | 🟢 Low | ✅ |
| 2.4 Code splitting | 2 س | 🟡 Medium | ✅ (كان منفذاً) |
| 2.5 React.memo | 1 س | 🟡 Medium | ✅ |
| 2.6 AbortController | 30 د | 🟡 Medium | ✅ |
| 2.7 Missing indexes | 30 د | 🟡 Medium | ✅ |
| **المجموع** | **~8.5 ساعات** | | **7/7 ✅** |
