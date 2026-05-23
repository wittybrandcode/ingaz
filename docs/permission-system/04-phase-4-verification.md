# المرحلة 4 — التنظيف والتحقق

> **الهدف**: التأكد من صحة كل التغييرات

---

## 4.1 TypeScript Typecheck

```bash
cd server && npm run typecheck
cd client && npm run typecheck
```

## 4.2 Lint

```bash
cd server && npm run lint
cd client && npm run lint
```

## 4.3 Tests

```bash
cd server && npm run test
```

## 4.4 إعادة Seeding

```bash
cd server && npx tsx src/seed.ts
```

## 4.5 التحقق اليدوي

| # | السيناريو | النتيجة |
|---|-----------|---------|
| 1 | تسجيل admin@ingaz.com → إنشاء مشروع → إعدادات | ✅ يرى كل المستخدمين عدا نفسه |
| 2 | اختيار عضو → إضافة للمشروع | ✅ يظهر في القائمة |
| 3 | تسجيل emp@ingaz.com (دور: مشارك) → فتح مشروع | ✅ لا يرى زر الإعدادات |
| 4 | إنشاء دور "مدير مشروع" بالصلاحيات → تعيينه لـ emp | ✅ emp يقدر يكلف |

## 4.6 ملفات متأثرة — الإجمالي

### Server (8 ملفات)

| الملف | التغيير |
|-------|---------|
| `server/src/db/schema.ts` | إضافة `isManager` |
| `server/src/middleware/auth.ts` | تعديل `authorize`, `authorizePermission`, `hasPermission`, `authenticate` + `requireManager` |
| `server/src/services/AuthService.ts` | إضافة `isManager` إلى login/me |
| `server/src/services/UserService.ts` | إضافة `permissions` إلى `list()` |
| `server/src/routes/users.ts` | استبدال `authorize(ROLES.ADMIN)` ← `requireManager` |
| `server/src/routes/roles.ts` | استبدال `authorize(ROLES.ADMIN)` ← `requireManager` |
| `server/src/routes/projects.ts` | استبدال `authorize(ROLES.ADMIN, ROLES.DEPUTY)` ← `authorizePermission(...)` |
| `server/src/constants.ts` | حذف `ROLES.DEPUTY`, `ROLES.EMPLOYEE` |
| `server/src/seed.ts` | إعادة كتابة كاملة |

### Client (1 ملف)

| الملف | التغيير |
|-------|---------|
| `client/src/components/ProjectSettingsModal.tsx` | إزالة `loadRoles` + فلتر جديد |

### Shared (1 ملف)

| الملف | التغيير |
|-------|---------|
| `shared/types.ts` | إضافة `is_manager` + `permissions` إلى `User` |

## 4.7 ملخص التنفيذ

| المرحلة | الوقت التقديري |
|---------|----------------|
| 1 — الـ Schema والـ Seed | 10 دقائق |
| 2 — Backend Authorization | 25 دقيقة |
| 3 — Client | 10 دقائق |
| 4 — التنظيف والتحقق | 10 دقائق |
| **المجموع** | **~55 دقيقة** |
