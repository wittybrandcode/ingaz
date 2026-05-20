# ✅ المرحلة 1 — الأمان (Security) — منجزة بالكامل

**الهدف:** سد الثغرات الأمنية الحرجة والعالية التي تهدد التطبيق.

**المدة الفعلية:** ~4 ساعات

**الحالة:** ✅ جميع البنود الثمانية منفذة والـ typecheck يمر بلا أخطاء

---

## ✅ 1.1 إزالة JWT secret fallback المشفر

| الحقل | القيمة |
|-------|--------|
| **المعرف** | S1 |
| **الحرجية** | 🔴 CRITICAL |
| **المشكلة** | `middleware/auth.ts:6` و `index.ts:100` — يوجد fallback hardcoded `'ingaz-dev-secret-key-2026'`. أي شخص لديه حق الوصول للمستودع يمكنه تزوير JWT tokens والدخول كأي مستخدم. |
| **المطلوب** | إزالة fallback الافتراضي، جعل `JWT_SECRET` مطلوباً إجبارياً. التحقق من وجوده عند بدء التشغيل (`process.env.JWT_SECRET`) وإلا إيقاف السيرفر مع رسالة خطأ واضحة. |
| **الجهد** | 30 دقيقة |
| **الملفات** | `server/src/middleware/auth.ts`, `server/src/index.ts` |
| **خطوات التنفيذ** | 1. إزالة `|| 'ingaz-dev-secret-key-2026'`<br>2. إضافة validation عند startup: `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required')`<br>3. التحقق من وجود `JWT_SECRET` في `.env` |

---

## ✅ 1.2 تعقيم وصف المهام الفرعية (Server-side XSS)

| الحقل | القيمة |
|-------|--------|
| **المعرف** | S2 |
| **الحرجية** | 🔴 HIGH |
| **المشكلة** | `subtasks.ts:78-81` — وصف subtask لا يُنقّى (sanitize) عند الإنشاء. يمكن إدخال `<script>` tags تخزّن وتنفذ عند عرض الصفحة (Stored XSS). |
| **المطلوب** | إضافة `sanitize-html` على الوصف عند create و update. تنقية HTML في الخادم (server-side). |
| **الجهد** | 30 دقيقة |
| **الملفات** | `server/src/routes/subtasks.ts` |
| **خطوات التنفيذ** | 1. تثبيت `sanitize-html`<br>2. إضافة middleware أو helper لتنقية `description`<br>3. التنقية في create و update |

---

## ✅ 1.3 تصحيح Rate Limiting على `/api/auth/login`

| الحقل | القيمة |
|-------|--------|
| **المعرف** | S3 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `index.ts:75` — rate limiter مطبق فقط على `/api/auth/login` وليس `/api/v1/auth/login`. المهاجم يستخدم الـ v1 prefix لتجاوز الحماية. |
| **المطلوب** | تطبيق auth rate limiter على كلا المسارين `/api` و `/api/v1`. |
| **الجهد** | 15 دقيقة |
| **الملفات** | `server/src/index.ts` |
| **خطوات التنفيذ** | 1. تطبيق limiter على `/api/auth/login` و `/api/v1/auth/login` |

---

## ✅ 1.4 فلترة MIME لرفع الصورة الشخصية

| الحقل | القيمة |
|-------|--------|
| **المعرف** | S4 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `auth.ts:18` — Avatar upload بدون `fileFilter`. يمكن رفع ملف `.exe` باسم `.png`. |
| **المطلوب** | إضافة fileFilter في Multer config يسمح فقط بـ image MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`). |
| **الجهد** | 30 دقيقة |
| **الملفات** | `server/src/routes/auth.ts` |
| **خطوات التنفيذ** | 1. إضافة `fileFilter` إلى Multer config للـ avatar |

---

## ✅ 1.5 استبدال sanitizer في الـ Client بـ DOMPurify

| الحقل | القيمة |
|-------|--------|
| **المعرف** | S5 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `client/src/lib/sanitize.ts:1-15` — sanitizer مخصص يعتمد على regex. يمكن تجاوزه بـ HTML entities encode tricks. |
| **المطلوب** | استبدال الـ regex sanitizer بـ `DOMPurify` (مكتبة متخصصة). |
| **الجهد** | 1 ساعة |
| **الملفات** | `client/src/lib/sanitize.ts` |
| **خطوات التنفيذ** | 1. تثبيت `DOMPurify`<br>2. إعادة كتابة دالة sanitize باستخدام DOMPurify |

---

## ✅ 1.6 تفعيل Helmet CSP مع nonce

| الحقل | القيمة |
|-------|--------|
| **المعرف** | S6 |
| **الحرجية** | 🟡 MEDIUM |
| **المشكلة** | `index.ts:44` — Helmet يفعل default CSP بـ script-src 'self' فقط. لا nonce-based policy للحماية من XSS رغم وجود `dangerouslySetInnerHTML`. |
| **المطلوب** | تكوين Helmet CSP مع nonce-based script policy. |
| **الجهد** | 1 ساعة |
| **الملفات** | `server/src/index.ts`, `client/src/html` |
| **خطوات التنفيذ** | 1. توليد nonce لكل request<br>2. تمرير nonce إلى الـ view<br>3. تكوين Helmet CSP |

---

## ✅ 1.7 فحص blacklist التوكن في Socket.io

| الحقل | القيمة |
|-------|--------|
| **المعرف** | S8 |
| **الحرجية** | 🟢 LOW |
| **المشكلة** | `index.ts:96-103` — Socket.io لا يتحقق من blacklist عند الاتصال. التوكنات الملغاة ما زالت تعمل للاتصالات النشطة. |
| **المطلوب** | إضافة فحص blacklist التوكن في `connection` event لـ Socket.io. |
| **الجهد** | 30 دقيقة |
| **الملفات** | `server/src/index.ts` |
| **خطوات التنفيذ** | 1. فك JWT على اتصال Socket.io<br>2. فحص blacklist قبل قبول الاتصال |

---

## ✅ 1.8 إضافة check عضوية المشروع في التعليقات

| الحقل | القيمة |
|-------|--------|
| **المعرف** | S9 |
| **الحرجية** | 🟢 LOW |
| **المشكلة** | `comments.ts:20-91` — أي مستخدم مصادق يمكنه التعليق على أي subtask بدون التحقق من كونه member في المشروع. |
| **المطلوب** | إضافة `isProjectMember` check قبل السماح بالتعليق. |
| **الجهد** | 1 ساعة |
| **الملفات** | `server/src/routes/comments.ts` |
| **خطوات التنفيذ** | 1. جلب `project_id` من subtask<br>2. التحقق من عضوية المستخدم في المشروع |

---

## خلاصة المرحلة

| البند | الجهد | الأولوية | الحالة |
|-------|-------|----------|--------|
| 1.1 JWT secret | 30 د | 🔴 Critical | ✅ |
| 1.2 Sanitize description | 30 د | 🔴 High | ✅ |
| 1.3 Rate limiting | 15 د | 🟡 Medium | ✅ |
| 1.4 MIME filter avatar | 30 د | 🟡 Medium | ✅ |
| 1.5 DOMPurify | 1 س | 🟡 Medium | ✅ |
| 1.6 Helmet CSP | 1 س | 🟡 Medium | ✅ |
| 1.7 Socket blacklist | 30 د | 🟢 Low | ✅ |
| 1.8 Comment membership check | 1 س | 🟢 Low | ✅ |
| **المجموع** | **~5 ساعات** | | **8/8 ✅** |
