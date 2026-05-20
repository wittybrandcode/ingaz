# تحليل المسارات — Server Routes Analysis

> الملفات: `server/src/routes/` — 10 ملفات

## 4.1 تحليل عام
```
routes/
├── analytics.ts    # لوحة القيادة - GET /dashboard
├── auth.ts         # تسجيل الدخول، الملف الشخصي، الخروج (9 endpoints)
├── comments.ts     # التعليقات على subtasks (2 endpoints)
├── notifications.ts # الإشعارات (8 endpoints)
├── projects.ts     # المشاريع + الأعضاء (11 endpoints)
├── roles.ts        # الأدوار والصلاحيات (8 endpoints)
├── subtasks.ts     # المهام الفرعية + المكلّفون (12 endpoints)
├── tasks.ts        # المهام + المكلّفون (12 endpoints)
├── types.d.ts      # توسيع Request بـ `user` + `db`
├── upload.ts       # رفع الملفات (4 endpoints)
├── users.ts        # إدارة المستخدمين (6 endpoints)
└── warnings.ts     # التحذيرات والرصيد (15 endpoints)
```

## 4.2 users.ts
- **مشكلة أمنية (Critical)** — `POST /` (إنشاء مستخدم): يتطلب ADMIN فقط ولكن:
  1. لا يوجد validation للـ `roleId` المُرسل من العميل
  2. يمكن إنشاء ADMIN بدون موافقة إضافية
  3. لا يتحقق من فريدية البريد الإلكتروني قبل الإدراج (constraint-level فقط، response خطأ غير جميل)

## 4.3 roles.ts
- **مشكلة** في `PUT /:id/permissions` — الاستعلام: `DELETE FROM role_permissions WHERE role_id = ...` ثم `INSERT ...` بدون transaction
- لا يوجد سجل تدقيق (audit log) عند تغيير الصلاحيات

## 4.4 subtasks.ts
- **مشكلة بنيوية**: `POST /` (إنشاء) لا يتحقق من صحة `assignedTo` كونه عضواً صالحاً في المشروع
- **مشكلة**: التحقق `isProjectManager` يستخدم `assignedTo` كاملاً بينما لا يتم إنشاء التعيين إلا لاحقاً في `POST /:id/assignees`

## 4.5 notifications.ts
- `PUT /preferences/:typeId`: يحدّث نوع إشعار واحد فقط — لا يوجد endpoint دفعة
- لا يوجد `DELETE /:id` — لا يمكن حذف إشعار واحد

## 4.6 patterns عامة
- ✅ ALL routes تستخدم `tryCatch(handler)` للقبض على `AppError`
- ✅ ALL routes تطبق middleware `authenticate` → `authorize` بشكل صحيح
- ✅ ALL responses تستخدم `res.success()` أو `res.fail()`
- ❌ لا يوجد rate limiting خاص بالـ endpoints الحساسة (باستثناء auth)
- ❌ لا يوجد validation صريح على request body — البيانات تأتي كما هي
- ❌ لا يوجد CSRF protection
