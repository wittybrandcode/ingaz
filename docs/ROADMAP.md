# خارطة طريق إنجاز — Ingaz Roadmap

> الملف الوحيد للإصلاحات والتطوير القادمة. كل الخطط السابقة تم أرشفتها.

---

## ✅ ما تم إنجازه (Phase 1–7 + C8 + H22 + H20)

تم إصلاح **11 حرجة + 23 عالية + 65 متوسطة/منخفضة** — 99 قضية:
- Phase 1–7: 93 قضية (أمان, قاعدة بيانات, معاملات, أخطاء, أداء, معماریة, CI/CD)
- C8: `NotificationService` DI — 5 خدمات
- H22: CORS `origin: true` عند `ALLOWED_ORIGINS=*` (credentials: true)
- H20: `health.ts` يستخدم `sql` tagged template بدل raw string
- H14: `autoRecoverCredit` من 1 دقيقة → 10 دقائق
- H5: `RoleService.delete` — hardcoded IDs → التحقق من المستخدمين المرتبطين
- H21: `dailySummary` — مقارنة تاريخ باستخدام `Date` objects بدل string

---

## 💻 الحالة الحالية

| الفحص | النتيجة |
|-------|---------|
| `npm run typecheck` (server) | 0 أخطاء ✅ |
| `npm run typecheck` (client) | 0 أخطاء ✅ |
| `npm run lint` (server) | 0 أخطاء ✅ |
| `npm run lint` (client) | 0 أخطاء ✅ |
| `npm run test` (server) | 95/95 ✅ |

---

## 📋 المهام المتبقية (6 قضايا)

### 🔴 عاجلة — 2

| المعرف | المشكلة | الموقع | الجهد |
|--------|---------|--------|-------|
| C16 | `seed-full.ts` يحذف كل البيانات بدون حماية — `DELETE FROM ...` ثم `INSERT` | `server/src/seed-full.ts:38` | ⏱ 15 د |
| C1 | `winnerCommentId` FK يستخدم `(): any =>` forward reference — قيد Drizzle | `server/src/db/schema.ts:61` | ⏱ 30 د (تأجيل: الشغال شغال) |

### 🟡 متوسطة (30 د – 1 س) — 2

| المعرف | المشكلة | الموقع | الإصلاح |
|--------|---------|--------|---------|
| H12 | `parseMentions` استعلام DB لكل mention (N+1) | `server/src/notify.ts:18-36` | Batch query لجميع mentions |
| H19 | `runMigrations()` ينشئ Pool جديد في كل تشغيل | `server/src/migrate.ts:8-14` | إعادة استخدام pool الموجود |

### 🟡 طويلة (اختبارات) — 2

| المعرف | المشكلة | الموقع | الجهد |
|--------|---------|--------|-------|
| H18 | 6 خدمات بدون اختبارات: AnalyticsService, BackgroundJobService, CommentService, MemberService, RoleService, UploadService | `server/src/services/` | ⏱ 4–6 س |
| H17 | لا يوجد component tests للعميل — `@testing-library/react` مفقود | Client | ⏱ 3–5 س |

---

## 🧭 ترتيب الأولوية المقترح

```
الآن:      C16 (seed-full guard) + H12 (parseMentions batch) + H19 (migrate Pool)
بعدها:    H18 (test coverage) + H17 (component tests)
أخيراً:   C1 (FK ref — شغال حالياً)
```

---

## ⚠️ ملاحظات

- **Redis**: أزيل من الخطط — `Set<number>` في `lib/onlineUsers.ts` يكفي لسيرفر واحد
- **C1** (`winnerCommentId` FK): شغال حالياً لكنه قيد Drizzle. يؤجل لنهاية القائمة
- **member-system** (plans/): مكتمل بالكامل — محذوف من الخطط النشطة
