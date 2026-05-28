# خارطة طريق إنجاز — Ingaz Roadmap

> الملف الوحيد للإصلاحات والتطوير القادمة. كل الخطط السابقة تم أرشفتها.

---

## ✅ ما تم إنجازه (Phase 1–7 + C8 + H22 + H20 + C1 + H18 + H17 + staging)

تم إصلاح **108 قضية + H17 + بيئة staging**:
- Phase 1–7: 93 قضية (أمان, قاعدة بيانات, معاملات, أخطاء, أداء, معماریة, CI/CD)
- C8: `NotificationService` DI — 5 خدمات
- H22: CORS `origin: true` عند `ALLOWED_ORIGINS=*` (credentials: true)
- H20: `health.ts` يستخدم `sql` tagged template بدل raw string
- H14: `autoRecoverCredit` من 1 دقيقة → 10 دقائق
- H5: `RoleService.delete` — hardcoded IDs → التحقق من المستخدمين المرتبطين
- H21: `dailySummary` — مقارنة تاريخ باستخدام `Date` objects بدل string
- C16: `seed-full.ts` — حماية إنتاج (NODE_ENV=production يتطلب --force)
- H12: `parseMentions` — batch query بدل N+1 لكل mention
- H19: `runMigrations()` — يعيد استخدام pool الموجود بدل إنشاء Pool جديد
- C1: `winnerCommentId` FK — تأكيد أن `(): any =>` هو النمط الصحيح لـ Drizzle (circular reference)
- H18: اختبارات لـ 5 خدمات (MemberService, RoleService, AnalyticsService, CommentService, UploadService) — 9 اختبارات إضافية
- **H17**: 67 اختباراً للـ Client (11 ملفات) — Avatar, Skeleton, ProgressBar, StatsPill, Toast, ErrorBoundary, TaskCard, ProjectCard, sanitize, appStore
- **BackgroundJobService**: 9 اختبارات (register, start/stop, catchUp, retry, concurrent prevention)
- **بيئة staging**: Docker Compose (PostgreSQL + server + nginx/client) + `staging.bat` + `.env.example` + تنظيف `console.log`

---

## 💻 الحالة الحالية

| الفحص | النتيجة |
|-------|---------|
| `npm run typecheck` (server) | 0 أخطاء ✅ |
| `npm run typecheck` (client) | 0 أخطاء ✅ |
| `npm run lint` (server) | 0 أخطاء ✅ |
| `npm run lint` (client) | 0 أخطاء ✅ |
| `npm run test` (server) | **152/152 ✅** (14 test files) |
| `npm run test` (client) | **67/67 ✅** (11 test files) |
| `npm run build` (client) | ✅ |

---

## 📋 المهام المستقبلية (اختيارية)

### 🟢 منخفضة — غير مطلوبة للإطلاق

| المعرف | المشكلة | الموقع | الجهد |
|--------|---------|--------|-------|
| — | **GitHub Actions CI/CD** — typecheck + lint + test تلقائي مع كل push | `.github/workflows/ci.yml` | ⏱ 1 س |
| — | **GitHub Actions CD** — نشر تلقائي على staging عند push لـ main | `.github/workflows/deploy.yml` | ⏱ 1 س |
| — | **Sentry تفعيل** — وضع DSN حقيقي لمراقبة الأخطاء في staging/production | `server/.env` | ⏱ 10 د |
| — | **Playwright E2E** — اختبارات شاملة للمتصفح (موجودة في package.json لكن بدون اختبارات بعد) | `client/e2e/` | ⏱ 2–3 س |

---

## 🧭 ترتيب الأولوية المقترح

```
تطوير عادي → start.bat
اختبار إنتاجي → staging.bat
نشر حقيقي → docker compose up (مع SSL و Domain)
```

---

## ⚠️ ملاحظات

- **Redis**: أزيل من الخطط — `Set<number>` في `lib/onlineUsers.ts` يكفي لسيرفر واحد
- **H17 ✅**: 67 اختباراً عبر 11 ملف — تم إعداد `@testing-library/react`, `jsdom`, `vitest.config.ts`
- **BackgroundJobService ✅**: 9 اختبارات عبر DI للـ db + جدول `background_jobs` في `test-schema.ts`
- **بيئة staging**: `staging.bat` يشغل Docker Compose مع nginx (http://localhost) يعكس API + Socket.IO + uploads
- **CI/CD**: غير مفعل حالياً — يحتاج رفع الكود على GitHub أولاً
