# المرحلة 6 — اختبارات آلية والبنية التحتية للنشر (Testing & Infrastructure)

**الهدف:** بناء بنية تحتية للاختبارات الآلية وتجهيز التطبيق للإنتاج.

**المدة المقدرة:** ~18 ساعة

**الأولوية:** 🔴 عالي — لكنه يعتمد على اكتمال المراحل السابقة (لأن الـ services والـ refactoring ستغير الكود)

---

## ✅ 6.1 إعداد بنية الاختبارات (Test Infrastructure)

| الحقل | القيمة |
|-------|--------|
| **المعرف** | T1 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | **صفر اختبارات آلية.** لا test runner، لا test files، لا CI. كل تغيير في الكود خطر على استقرار التطبيق. |
| **الحل** | تم إعداد Vitest للخادم مع `vitest.config.ts` (موجود مسبقاً). إنشاء `server/src/__tests__/helpers.ts` بقاعدة بيانات SQLite `:memory:` ووظائف مساعدة (seedUser, seedProject, seedTask, seedSubtask, seedProjectMember, generateToken, createTestDb). تثبيت `supertest` للاختبارات التكاملية. |
| **الجهد** | 4 ساعات |
| **الملفات** | `server/vitest.config.ts`, `server/src/__tests__/helpers.ts` |
| **التنفيذ** | 1. Vitest موجود مسبقاً (config + example test)<br>2. تثبيت `supertest` و `@types/supertest`<br>3. إنشاء `helpers.ts` — createTestDb (SQLite `:memory:` + schema + seed roles/levels/warning_types)، seedUser/Project/Task/Subtask/Member، generateToken |

---

## ✅ 6.2 اختبارات تدفق المصادقة (Auth Flow)

| الحقل | القيمة |
|-------|--------|
| **المعرف** | T2 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | عملية المصادقة هي المدخل الوحيد للتطبيق. أي خطأ فيها يمنع كل المستخدمين. |
| **الحل** | كتابة unit tests لـ `AuthService` مباشرة (منفصل عن HTTP). 6 اختبارات: login ناجح، login بكلمة سر خاطئة، login بايميل غير موجود، me لمعرف صحيح، me لمعرف غير موجود، login لمستخدم inactive. |
| **الجهد** | 3 ساعات |
| **الملفات** | `server/src/__tests__/auth.test.ts` |
| **التنفيذ** | 6 اختبارات لـ `AuthService`<br>1. تسجيل دخول ناجح → يُرجع مستخدم + توكن<br>2. كلمة سر خاطئة → 401<br>3. إيميل غير موجود → 401<br>4. `me()` لمستخدم صحيح → يرجع بيانات<br>5. `me()` لمعرف غير موجود → 404<br>6. login لمستخدم inactive → نجاح (حالة inactive مسموح بها) |

---

## ✅ 6.3 اختبارات CRUD المهام والمهام الفرعية

| الحقل | القيمة |
|-------|--------|
| **المعرف** | T3 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | المهام والمهام الفرعية هي جوهر التطبيق. لا اختبارات تتحقق من صلاحيات الإنشاء، تحوّلات الحالة، أو قيود العضوية. |
| **الحل** | كتابة unit tests لـ `TaskService` و `SubtaskService` مباشرة. 16 اختباراً: صلاحيات (ADMIN/EMPLOYEE member/EMPLOYEE غير member)، pagination, sanitize HTML, تحوّلات حالة subtask (pending → in_progress → submitted)، قبول/رفض من ADMIN، حذف، 404. |
| **الجهد** | 4 ساعات |
| **الملفات** | `server/src/__tests__/tasks.test.ts` |
| **التنفيذ** | 16 اختباراً في ملف واحد<br>**TaskService (7):** ADMIN في أي مشروع، EMPLOYEE member → نجاح، EMPLOYEE غير member → 403، DEPUTY، list مع pagination، listByProject، sanitize HTML<br>**SubtaskService (9):** ADMIN، EMPLOYEE member، EMPLOYEE غير member → 403، تحوّلات الحالة، قبول، رفض، listByTask مع assignees، getById 404، حذف |

---

## ✅ 6.4 اختبارات التحذيرات والرصيد (Warning System)

| الحقل | القيمة |
|-------|--------|
| **المعرف** | T4 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | نظام الإنذارات والرصيد هو أكثر جزء تعقيداً في التطبيق (323 سطراً في WarningService.ts). بدون اختبارات، أي تغيير قد يكسر التصعيد التلقائي أو استرداد الرصيد. |
| **الحل** | كتابة unit tests لـ `WarningService` مع mock لـ `getCreditLevel` و `clearFrozenCache` و `notifyUser`. 21 اختباراً: CRUD أنواع الإنذارات، restriction levels، credit scores، إنشاء إنذار، رد، مسح، إبقاء (sustain)، تجميد، فك تجميد، pagination. |
| **الجهد** | 4 ساعات |
| **الملفات** | `server/src/__tests__/warnings.test.ts` |
| **التنفيذ** | 21 اختباراً في 5 مجموعات:<br>1. **Warning Types CRUD (4):** list, create, update, delete<br>2. **Restriction Levels (2):** list 4 levels, update level<br>3. **Credit Scores (2):** getMyLevel, listCreditScores مع enrichment<br>4. **Warning Lifecycle (7):** create, respond, respond مكرر → 400, non-existent → 404, clear + استعادة نقاط, sustain + خصم نقاط + freeze check, sustain غير موجود → 404<br>5. **Freeze/Unfreeze (4):** getFreezeStatus نشط, مجمد, unfreeze + إعادة رصيد 5, unfreeze غير موجود → 404<br>6. **Pagination (2):** list, listMy |

---

## ✅ 6.5 اختبارات E2E أساسية (Playwright)

| الحقل | القيمة |
|-------|--------|
| **المعرف** | T5 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | اختبارات الواجهة backend فقط. لا ضمان أن الواجهة تعمل بشكل صحيح مع المستخدم الحقيقي. |
| **الحل** | إعداد Playwright في `client/e2e/` مع `playwright.config.ts`. 3 اختبارات دخول + 2 اختبار مشروع. |
| **الجهد** | 6 ساعات |
| **الملفات** | `client/playwright.config.ts`, `client/e2e/login.spec.ts`, `client/e2e/project.spec.ts` |
| **التنفيذ** | 1. تثبيت `@playwright/test` + تحميل Chromium<br>2. إنشاء `playwright.config.ts` مع webServer للسيرفر (3001) والعميل (5173)<br>3. **login.spec.ts (3):** دخول ناجح، خطأ في كلمة السر، إعادة توجيه بدون توكن<br>4. **project.spec.ts (2):** إنشاء مشروع جديد، عرض قائمة المشاريع<br>5. إضافة `test:e2e` و `test:e2e:ui` scripts |

---

## ✅ 6.6 تحسينات الإنتاج (Production Readiness)

| الحقل | القيمة |
|-------|--------|
| **المعرف** | PR1-PR7 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | التطبيق يفتقر لمقومات الإنتاج: health check، logging منظم، request tracing، process manager، backup. |
| **الحل** | تم تنفيذ 6 بنود: health check، pino logging، request ID middleware، backup script، Sentry، CORS validation. |
| **الجهد** | 6 ساعات |
| **الملفات** | متعدد |
| **التنفيذ** | |
| ✅ 6.6.1 | **Health check**: `server/src/routes/health.ts` — `GET /api/health` يرجع `{ status, uptime, db, timestamp, memory }` |
| ✅ 6.6.2 | **Pino logging**: `server/src/index.ts` — pino logger مع levels (info/warn/error حسب status code)، auto-log لكل request، `pino-pretty` للتطوير |
| ✅ 6.6.3 | **Request ID**: `server/src/middleware/requestId.ts` — `crypto.randomUUID()` لكل request، يُضاف إلى error logs |
| ✅ 6.6.4 | **DB backup**: `server/scripts/backup.ts` — نسخ `ingaz.db` إلى `data/backups/` مع timestamp، يحتفظ بـ 14 نسخة احتياطية (`npm run backup`) |
| ✅ 6.6.5 | **Sentry**: `server/src/sentry.ts` + `client/src/main.tsx` — `@sentry/node` + `@sentry/react`، يُفعّل عند وجود `SENTRY_DSN`/`VITE_SENTRY_DSN` |
| ✅ 6.6.6 | **CORS validation**: `server/src/index.ts` — يتحقق من صحة `ALLOWED_ORIGINS` عند بدء التشغيل، يخرج مع error إذا كان غير صالح |

---

## خلاصة المرحلة

| البند | الجهد | الأولوية | الحالة |
|-------|-------|----------|--------|
| 6.1 إعداد بنية الاختبارات | 4 س | 🔴 High | ✅ Vitest + helpers + supertest |
| 6.2 اختبارات Auth | 3 س | 🔴 High | ✅ 6 اختبارات لـ AuthService |
| 6.3 اختبارات CRUD مهام | 4 س | 🔴 High | ✅ 16 اختباراً لـ TaskService + SubtaskService |
| 6.4 اختبارات التحذيرات | 4 س | 🟡 Medium | ✅ 21 اختباراً لـ WarningService |
| 6.5 اختبارات E2E | 6 س | 🟡 Medium | ✅ Playwright config + 5 اختبارات |
| 6.6 إنتاج (6 بنود) | 6 س | 🟡 Medium | ✅ 6/6 — Health, Pino, RequestId, Backup, Sentry, CORS |
| **المجموع** | **~27 ساعة** | | **6/6 ✅ (43 اختبارا+5 E2E+6 إنتاج)** |
