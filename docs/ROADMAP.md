# خارطة طريق إنجاز — Ingaz Roadmap

> الملف الوحيد للإصلاحات والتطوير القادمة. كل الخطط السابقة تم أرشفتها.

---

## ✅ ما تم إنجازه (Phase 1–7 + C8 + H22 + H20)

تم إصلاح **12 حرجة + 25 عالية + 65 متوسطة/منخفضة** — 102 قضية:
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

## 📋 المهام المتبقية (3 قضايا)

### 🔴 عاجلة — 1

| المعرف | المشكلة | الموقع | الجهد |
|--------|---------|--------|-------|
| C1 | `winnerCommentId` FK يستخدم `(): any =>` forward reference — قيد Drizzle | `server/src/db/schema.ts:61` | ⏱ 30 د (شغال حالياً — يؤجل) |

### 🟡 طويلة (اختبارات) — 2

| المعرف | المشكلة | الموقع | الجهد |
|--------|---------|--------|-------|
| H18 | 6 خدمات بدون اختبارات: AnalyticsService, BackgroundJobService, CommentService, MemberService, RoleService, UploadService | `server/src/services/` | ⏱ 4–6 س |
| H17 | لا يوجد component tests للعميل — `@testing-library/react` مفقود | Client | ⏱ 3–5 س |

---

## 🧭 ترتيب الأولوية المقترح

```
الآن:      H18 (test coverage 4-6h) + H17 (component tests 3-5h)
أخيراً:   C1 (FK ref — شغال حالياً، Gino يريد دقائق)
```

---

## ⚠️ ملاحظات

- **Redis**: أزيل من الخطط — `Set<number>` في `lib/onlineUsers.ts` يكفي لسيرفر واحد
- **C1** (`winnerCommentId` FK): شغال حالياً لكنه قيد Drizzle. يؤجل لنهاية القائمة
- **member-system** (plans/): مكتمل بالكامل — محذوف من الخطط النشطة
