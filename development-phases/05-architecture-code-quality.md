# المرحلة 5 — الهندسة وجودة الكود (Architecture & Code Quality)

**الهدف:** تحسين بنية التطبيق، تقليل الديون التقنية، وزيادة قابلية الصيانة.

**المدة المقدرة:** ~16 ساعة

**الأولوية:** 🟡 متوسطة — بعد استقرار الوظائف الأساسية

---

## 5.1 تقسيم ProjectDetail.tsx إلى مكونات أصغر

| الحقل | القيمة |
|-------|--------|
| **المعرف** | TD10 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `ProjectDetail.tsx` (455 سطراً) — مسؤول عن: عرض المشروع + CRUD مهام + CRUD مهام فرعية + مرفقات + أعضاء + real-time. خرق مبدأ SRP (Single Responsibility Principle). كما أن 25+ `useState` يسبب إعادة تصيير كامل المكون لأي تغيير. |
| **الحل** | استخراج 3-4 مكونات فرعية: `TaskList`، `SubtaskForm`، `MemberList`، `FileSection`. كل مكون يدير حالته الخاصة. |
| **الجهد** | 4 ساعات |
| **الملفات** | `client/src/pages/ProjectDetail.tsx` ← `client/src/components/ProjectDetail/` |
| **خطوات التنفيذ** | 1. إنشاء مجلد `ProjectDetail/`<br>2. استخراج `TaskList.tsx` — قائمة المهام + filtration<br>3. استخراج `SubtaskForm.tsx` — إنشاء/تعديل مهام فرعية<br>4. استخراج `MemberList.tsx` — قائمة الأعضاء<br>5. استخراج `FileSection.tsx` — إدارة المرفقات<br>6. `ProjectDetail.tsx` يبقى كـ orchestrator ينسق بينهم |

---

## 5.2 إنشاء Service Layer للخادم

| الحقل | القيمة |
|-------|--------|
| **المعرف** | ARC1 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | منطق الأعمال (business logic) يعيش في route handlers. هذا يخالف فصل المسؤوليات، يكرر الكود، ويجعل الاختبار مستحيلاً. |
| **الحل** | إنشاء مجلد `server/src/services/` مع ملفات: `taskService.ts`, `subtaskService.ts`, `warningService.ts`, `projectService.ts`, `authService.ts`. الـ route handlers تصبح طبقة رقيقة (thin) تستدعي الـ services. |
| **الجهد** | 8 ساعات |
| **الملفات** | `server/src/routes/*.ts` ← `server/src/services/*.ts` |
| **خطوات التنفيذ** | 1. إنشاء `server/src/services/`<br>2. استخراج `subtaskService.ts` (الأكثر تعقيداً — تحويلات الحالة، إشعارات)<br>3. استخراج `warningService.ts` (نظام الإنذارات + credit)<br>4. استخراج `taskService.ts` و `projectService.ts` و `authService.ts`<br>5. تعديل route handlers لاستدعاء services بدلاً من db مباشرة |

---

## ✅ 5.3 تفعيل strict: true في tsconfig الخادم

| الحقل | القيمة |
|-------|--------|
| **المعرف** | TD12 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `server/tsconfig.json` — `strict: false`. هذا يعني أن TypeScript لا يفحص الـ null/undefined بشكل صارم. يقدر يكشف 50+ خطأ type محتمل. |
| **الحل** | تفعيل `strict: true` ثم تصحيح جميع الأخطاء التي تظهر (~350 خطأ). |
| **الجهد** | 4 ساعات |
| **الملفات** | `server/tsconfig.json`, `server/src/types/express.d.ts`, `server/src/middleware/auth.ts`, `server/src/notify.ts`, `server/src/db.ts`, `server/src/validation.ts`, `server/src/index.ts`, جميع ملفات `routes/*.ts`, جميع ملفات `services/*.ts` |
| **التنفيذ** | 1. تغيير `strict: false` → `strict: true`<br>2. إنشاء `src/types/express.d.ts` مع augmentation لـ `express-serve-static-core`<br>3. تثبيت `@types/express @types/jsonwebtoken @types/multer @types/bcryptjs @types/sanitize-html @types/better-sqlite3 @types/node`<br>4. إصلاح جميع الملفات: `(req: any, res: any, next: any)` في 10 routes، `String(req.query.x)` بدل `req.query.x`، `as any` على db في BaseService، types للـ socket handler |

---

## 5.4 توحيد ثابت ROLES في مكان واحد

| الحقل | القيمة |
|-------|--------|
| **المعرف** | AR1, DX3 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `ROLES` معرّف في 3 أماكن مختلفة: `shared/types.ts`, `server/constants.ts`, `client/constants.ts`. إضافة دور جديد يتطلب تحديث 3 ملفات. كما أن `role_id === 1` (hardcoded numbers) موجود في 4 ملفات. |
| **الحل** | توحيد ROLES في `shared/types.ts` فقط. إعادة تصديره من الخادم والعميل. استبدال كل الأرقام المشفرة بـ `ROLES.ADMIN` وغيرها. |
| **الجهد** | 30 دقيقة |
| **الملفات** | `shared/types.ts`, `server/constants.ts`, `client/constants.ts`, `TopBar.tsx`, `App.tsx`, `Roles.tsx` |
| **خطوات التنفيذ** | 1. نقل ROLES إلى `shared/types.ts` فقط<br>2. إعادة تصدير من الخادم (`export { ROLES } from '@shared/types'`)<br>3. إعادة تصدير من العميل (نفس الشيء)<br>4. استبدال `role_id === 1` بـ `role_id === ROLES.ADMIN` |

---

## 5.5 إنشاء نظام Migrations

| الحقل | القيمة |
|-------|--------|
| **المعرف** | DB |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `db.ts` — `CREATE TABLE IF NOT EXISTS` بدون versioning. لا يوجد تتبع للتغييرات على schema. العمل الجماعي محفوف بالمخاطر (من يعدّل الـ schema يفقد تغييرات الآخرين). |
| **الحل** | إضافة مجلد `server/migrations/` مع ملفات SQL مرقمة (`001_initial.sql`, `002_add_notification_preferences.sql`, إلخ). إنشاء `migrate.ts` يشغلها بالترتيب ويسجل التغييرات في جدول `_migrations`. |
| **الجهد** | 4 ساعات |
| **الملفات** | `server/src/db.ts` ← `server/migrations/*.sql`, `server/src/migrate.ts` |
| **خطوات التنفيذ** | 1. إنشاء مجلد `server/migrations/`<br>2. إنشاء جدول `_migrations` لتتبع التنفيذ<br>3. إنشاء `migrate.ts` يقرأ الملفات وينفذها بالترتيب<br>4. نقل تعريفات الجداول الحالية إلى `001_initial.sql`<br>5. تشغيل `migrate.ts` عند بدء التشغيل |

---

## 5.6 إضافة Centralized Error Handler

| الحقل | القيمة |
|-------|--------|
| **المعرف** | TD15 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | لا يوجد middleware معالجة أخطاء مركزي. كل route يعالج الأخطاء بشكل فردي. تكرار كود، وعدم اتساق في تنسيق الـ error response. |
| **الحل** | إنشاء `server/src/middleware/errorHandler.ts` — دالة `(err, req, res, next)` ترسل `{ success: false, error: err.message }` مع الـ HTTP status المناسب. |
| **الجهد** | 2 ساعات |
| **الملفات** | `server/src/middleware/errorHandler.ts`, `server/src/index.ts` |
| **خطوات التنفيذ** | 1. إنشاء error handler middleware<br>2. إضافته بعد جميع الـ routes في index.ts<br>3. إزالة try/catch من route handlers (استخدام `next(err)` بدلاً من `res.fail`) |

---

## 5.7 إعادة هيكلة KanbanBoard.tsx

| الحقل | القيمة |
|-------|--------|
| **المعرف** | R2 |
| **الحرجية** | 🟢 LOW |
| **المشكلة** | `KanbanBoard.tsx` (414 سطراً) — مسؤول عن: Board Layout + data fetching + modals + theme picker + notification bar. |
| **الحل** | فصل `ThemePicker` و `KanbanColumn` كمكونات مستقلة. |
| **الجهد** | 2 ساعات |
| **الملفات** | `client/src/components/KanbanBoard.tsx` |
| **خطوات التنفيذ** | 1. استخراج `KanbanColumn.tsx` — عمود واحد مع SubtaskCards<br>2. استخراج `ThemePicker.tsx` — منتقي الألوان |

---

## خلاصة المرحلة

| البند | الجهد | الأولوية | الحالة |
|-------|-------|----------|--------|
| 5.1 تقسيم ProjectDetail | 4 س | 🟡 Medium | ✅ (TaskList، باقي SubtaskPanel) |
| 5.2 Service Layer | 8 س | 🟡 Medium | ✅ |
| 5.3 strict true للخادم | 4 س | 🟡 Medium | ✅ |
| 5.4 توحيد ROLES | 30 د | 🟡 Medium | ✅ |
| 5.5 نظام Migrations | 4 س | 🟡 Medium | ❌ لم ينفذ — يتطلب إعادة هيكلة كبيرة لـ db.ts |
| 5.6 Error handler مركزي | 2 س | 🟡 Medium | ✅ |
| 5.7 إعادة هيكلة KanbanBoard | 2 س | 🟢 Low | ✅ |
| **المجموع** | **~24.5 ساعة** | | **6/7 ✅** |
