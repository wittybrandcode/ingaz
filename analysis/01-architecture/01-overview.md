# تحليل المعمارية — Architecture Overview

## نظام ثنائي (Monorepo Lite)

```
Bigg/
├── client/              # React + Vite (SPA)
│   └── src/
│       ├── components/  # ~25 مكون
│       ├── pages/       # ~8 صفحة
│       ├── store/       # Zustand (2 stores)
│       └── lib/         # api, socket, utils
├── server/              # Express + PostgreSQL
│   └── src/
│       ├── db/          # Drizzle ORM schema + seeds
│       ├── middleware/   # auth, error handler
│       ├── routes/      # 10 route files (thin wrappers)
│       ├── services/    # 9 service classes (business logic)
│       └── __tests__/   # 43 اختبار
├── shared/              # types.ts (واجهات مشتركة)
├── uploads/             # ملفات مرفوعة (served statically)
└── start.bat            # إقلاع متزامن للخادم والعميل
```

## تدفق الطلب

```
Client (React) → Vite Proxy (5173) → Express (3001)
                                        │
                              authenticate → authorize
                                        │
                              checkFrozen → requireCredit
                                        │
                              Route Handler → tryCatch → Service
                                        │
                              res.success() → camelToSnake(تلقائي)
```

## طبقات المعمارية

### طبقة العرض (Client)
- React 19 + TypeScript
- React Router v7 (layout routes)
- Zustand v5 لإدارة الحالة
- Socket.io-client للتحديثات المباشرة
- Axios للطلبات HTTP

### طبقة السيرفر (Server)
- Express.js + TypeScript (تشغيل عبر tsx)
- PostgreSQL عبر Drizzle ORM (node-postgres)
- Socket.io للتحديثات المباشرة
- JWT للمصادقة (7 أيام)
- bcryptjs لتشفير كلمات المرور

### طبقة البيانات
- PostgreSQL قاعدة بيانات علائقية
- 21 جدول (users, projects, tasks, subtasks, comments, notifications...)
- Migration عبر drizzle-kit (SQL-generated)
- Seeds لبيانات التطوير

## نمط التصميم الأساسي

```
Controller (Route) → Service (Business Logic) → Database (Drizzle ORM)
```

الـ Routes رقيقة (thin)، والخدمات تحتوي منطق الأعمال. الخدمات ترمي `AppError` للقبض عليه بواسطة `tryCatch` في الـ routes.

## نقاط الضعف المعمارية

1. **لا توجد طبقة Repository** — الخدمات تتصل مباشرة بـ Drizzle ORM
2. **لا توجد Transactions** في العمليات المعقدة — خطر عدم التناسق
3. **لا توجد Caching** — كل طلب يذهب إلى قاعدة البيانات
4. **لا توجد Queue/Background jobs** — العمليات الثقيلة (CSV export, notifications) تعمل في نفس thread الطلب
5. **VerbatimModuleSyntax** — يتطلب `.js` في imports رغم أن الملفات `.ts`
6. **erasableSyntaxOnly** — يمنع استخدام `public`/`private` في constructor parameters
