# خطة تنفيذ نظام الإشعارات — Notification System

> تاريخ الخطة: 2026-05-20
> حالة التنفيذ: ⏳ لم تبدأ بعد

## ملخص

نظام الإشعارات هو المكوّن الوحيد المكتمل واجهةً (Frontend) والناقص منطقًا (Backend) في تطبيق إنجاز. الـ UI جاهز 100% — جرس التنبيهات `NotificationBell.tsx` (300 سطر)، صفحة التفضيلات `NotificationPreferences.tsx`، 33 أيقونة نوع، مودال تفاصيل المهمة المسندة، ومودال ردّ الإنذار. لكن الـ Backend لا ينشئ أي إشعار فعلًا — `NotificationService` يفتقر إلى دالّة `create()`.

**الهدف**: ربط الأحداث في جميع الخدمات بإنشاء إشعارات في قاعدة البيانات + إرسالها عبر Socket.io فورًا للمستخدم المستهدف.

---

## الهيكل الحالي

### الجداول (PostgreSQL / Drizzle)

```typescript
// notifications — الإشعارات المخزنة
notifications {
  id            serial PK
  user_id       int → users(id) ON DELETE CASCADE
  title         text NOT NULL
  message       text
  type          text DEFAULT 'info'       // notification type key
  read          int DEFAULT 0              // 0 = unread, 1 = read
  related_type  text                        // 'subtask' | 'project' | 'task' | 'warning'
  related_id    int
  created_at    timestamp DEFAULT now()
}

// notification_preferences — تفضيلات كل مستخدم
notification_preferences {
  id               serial PK
  user_id          int → users(id) ON DELETE CASCADE
  notification_type text NOT NULL          // type_key من جدول الأنواع
  channels         text DEFAULT '["in_app"]'  // JSON array (in_app, email)
  enabled          int DEFAULT 1           // 0 = معطل, 1 = مفعل
  UNIQUE(user_id, notification_type)
}

// notification_types — جدول مرجعي بأنواع الإشعارات
notification_types {
  id              serial PK
  type_key        text UNIQUE NOT NULL
  type_group      text NOT NULL           // مجموعة التصنيف (مشاريع، مهام...)
  name            text NOT NULL           // الاسم العربي
  description     text                    // الشرح
  default_enabled int DEFAULT 1
}

// deadline_reminders — لتتبع إشعارات المواعيد النهائية (يمنع التكرار)
deadline_reminders {
  id             serial PK
  subtask_id     int → subtasks(id) ON DELETE CASCADE
  reminder_type  text NOT NULL            // '24h' | '6h' | 'overdue'
  sent           int DEFAULT 0            // 0 = pending, 1 = sent
  created_at     timestamp DEFAULT now()
  UNIQUE(subtask_id, reminder_type)
}
```

### أنواع الإشعارات (33 نوعًا)

| المجموعة | الأنواع |
|----------|---------|
| **مشاريع** | `project_created`, `project_updated`, `project_archived`, `project_deleted`, `project_completed` |
| **مهام** | `task_created`, `task_updated`, `task_archived` |
| **مهام فرعية** | `subtask_created`, `subtask_assigned`, `assignment_changed`, `in_progress`, `submitted`, `approved`, `rejected` |
| **تعليقات** | `comment`, `@mention` |
| **مواعيد** | `deadline_approaching_24h`, `deadline_approaching_6h`, `deadline_overdue`, `deadline_extended` |
| **ملفات** | `file_uploaded` |
| **فريق** | `user_joined`, `role_changed` |
| **إنذارات** | `warning`, `warning_ignored`, `warning_cleared`, `warning_sustained` |
| **حساب** | `account_frozen`, `account_unfrozen` |
| **دورية** | `daily_summary` |
| **أمان** | `new_login`, `password_changed` |

### الموجود حاليًا

| المكوّن | الحالة |
|---------|--------|
| NotificationBell.tsx (جرس + قائمة منسدلة + مودال تفاصيل + مودال رد إنذار) | ✅ مكتمل |
| NotificationPreferences.tsx (صفحة إعدادات التنبيهات مع toggle لكل نوع) | ✅ مكتمل |
| notification route (`GET /`, `GET /unread`, `PUT /:id/read`, `PUT /read-all`, `PUT /preferences/:typeKey`, `GET /daily-summary`, `PUT /types/batch`) | ✅ مكتمل |
| NotificationService (list, unreadCount, markRead, markAllRead, getPreferences, updatePreference, dailySummary, updateBatchTypes) | ⚠️ **ينقصه `create()`** |
| ربط Socket.io (`socket.on('notification', handler)` في العميل) | ✅ مكتمل |
| إنشاء الإشعارات عند الأحداث (subtask assigned, comment, warning...) | ❌ **غير موجود** |
| Background job للمواعيد النهائية | ❌ **غير موجود** |
| اختبارات نظام الإشعارات | ❌ **غير موجود** |

---

## خطة التنفيذ — 6 مراحل

---

### المرحلة 1: الأساس — Foundation

**المدة التقديرية**: جلسة واحدة

#### المهام
1. **إضافة `create()` إلى NotificationService**
   - التوقيع: `create(userId, title, message, type, relatedType, relatedId)`
   - إنشاء سجل في جدول `notifications`
   - إرجاع الإشعار المنشأ
   - استخدام transaction + try/catch

2. **إضافة `createMany()` لبث الإشعارات**
   - التوقيع: `createMany(notifications: { userId, title, message, type, relatedType, relatedId }[])`
   - إنشاء سجلات متعددة في استعلام واحد (bulk insert)
   - إرجاع المصفوفة المنشأة

3. **التحقق من تفضيلات المستخدم قبل الإرسال**
   - في `create()`: استعلام `notification_preferences` للمستخدم + النوع
   - إذا `enabled = 0` → لا تنشئ الإشعار
   - هلّمّ إلى `createMany()` لكل مستخدم على حدة

4. **إرسال Socket.io event**
   - بعد إنشاء الإشعار، بثّ event `notification` إلى المستخدم المستهدف
   - استخدام `req.app.get('io').to(userRoom).emit('notification', notification)`
   - دعم الإرسال عبر دالة `emitToUser(io, userId, notification)`

5. **اختبارات**
   - `create()` يُنشئ إشعارًا في قاعدة البيانات
   - `create()` لا ينشئ إذا كان النوع معطلاً في التفضيلات
   - `createMany()` يُنشئ إشعارات متعددة
   - Socket.io event يُبث بعد الإنشاء

#### ملفات التعديل
- `server/src/services/NotificationService.ts` — إضافة `create()`, `createMany()`
- `server/src/db/index.ts` — إضافة `emitToUser()` أو دالة مساعدة
- `server/src/__tests__/notifications.test.ts` — ملف اختبار جديد

#### معايير القبول
- ✅ `npm run typecheck` سيرفر + عميل
- ✅ `npm run lint` لا أخطاء جديدة
- ✅ `npm run test` جميع الاختبارات تمر (77+)

---

### المرحلة 2: إشعارات المهام الفرعية

**المدة التقديرية**: جلسة واحدة

#### المهام
1. **`subtask_assigned`** — في `SubtaskService.create()` و `update()` (عند تغيير `assigned_to`)
   - عند إنشاء مهمة فرعية و `assigned_to` موجود → أرسل للمسؤول
   - عند تحديث `assigned_to` → أرسل للمسؤول الجديد
   - النص: "تم إسناد مهمة '{title}' لك في مشروع '{project}'"

2. **`subtask_created`** — عند إنشاء مهمة فرعية
   - أرسل لأعضاء المشروع (admins + deputies + من أنشأ المهمة الأم)

3. **`in_progress`** — عند تغيير الحالة إلى `in_progress`
   - أرسل لمنشئ المهمة (task creator) أو المشرفين

4. **`submitted`** — عند تغيير الحالة إلى `submitted`
   - أرسل للمشرفين (admin/deputy) على المشروع

5. **`approved` / `rejected`** — عند الموافقة أو الرفض
   - أرسل للمستخدم الذي سلّم المهمة

6. **اختبارات**
   - `subtask_assigned` يُنشأ عند إنشاء مهمة مع `assigned_to`
   - `subtask_assigned` يُنشأ عند تغيير `assigned_to` في التحديث
   - `submitted` يُنشأ عند تسليم مهمة
   - `approved` يُنشأ عند الموافقة

#### ملفات التعديل
- `server/src/services/SubtaskService.ts` — إضافة استدعاءات `notificationService.create()` مع `ctx.io`
- `server/src/__tests__/notifications.test.ts` — توسيع الاختبارات

#### معايير القبول
- ✅ جميع اختبارات subtasks تمر (16) + اختبارات جديدة
- ✅ `npm run typecheck`
- ✅ `npm run lint`

---

### المرحلة 3: إشعارات التعليقات + @Mentions

**المدة التقديرية**: جلسة واحدة

#### المهام
1. **`comment`** — في `CommentService.create()`
   - عند إضافة تعليق على مهمة فرعية، أرسل إشعار لـ `assigned_to` الخاص بها (إذا لم يكن المعلق هو صاحب المهمة)
   - النص: "{user name} علّق على مهمتك"

2. **@Mention Detection**
   - إنشاء دالة مساعدة `extractMentions(text: string): string[]` تستخرج أسماء المستخدمين بعد @
   - البحث عن المستخدمين المذكورين في قاعدة البيانات (باستخدام `users.name`)
   - إرسال إشعار `@mention` لكل مستخدم مذكور (إذا لم يكن هو المعلق)
   - النص: "{user name} أشار إليك في تعليق"

3. **اختبارات**
   - `comment` يُنشأ عند إضافة تعليق لمهمة مستخدم آخر
   - `comment` لا يُنشأ إذا كان المعلق هو صاحب المهمة
   - `@mention` يُنشأ للمستخدم المذكور في النص
   - `extractMentions()` تتعامل مع @username و @name lastname

#### ملفات التعديل
- `server/src/services/CommentService.ts` — إضافة إشعارات + @mention
- `server/src/services/mentions.ts` — دالة `extractMentions` (ملف جديد)
- `server/src/__tests__/notifications.test.ts` — توسيع

#### معايير القبول
- ✅ جميع الاختبارات تمر
- ✅ @mention تتعامل مع أسماء عربية (بمسافات)
- ✅ `npm run typecheck`

---

### المرحلة 4: إشعارات المشاريع والمهام

**المدة التقديرية**: جلسة واحدة

#### المهام
1. **إشعارات المشاريع** في `ProjectService`
   - `project_created` ← أرسل لجميع الـ admins
   - `project_updated` ← أرسل لأعضاء المشروع
   - `project_archived` ← أرسل لأعضاء المشروع
   - `project_deleted` ← أرسل لأعضاء المشروع

2. **إشعارات المهام** في `TaskService`
   - `task_created` ← أرسل لأعضاء المشروع
   - `task_updated` ← أرسل لأعضاء المشروع
   - `task_archived` ← أرسل لأعضاء المشروع

3. **دالة مساعدة `getProjectMemberIds(projectId)`** لاستخراج أعضاء المشروع لإرسال الإشعارات لهم

4. **اختبارات**
   - `project_created` يُنشأ للمستخدمين المناسبين
   - `task_created` يُنشأ لأعضاء المشروع

#### ملفات التعديل
- `server/src/services/ProjectService.ts` — إضافة إشعارات
- `server/src/services/TaskService.ts` — إضافة إشعارات
- `server/src/services/index.ts` — دالة `getProjectMemberIds()`
- `server/src/__tests__/notifications.test.ts` — توسيع

#### معايير القبول
- ✅ جميع اختبارات المشاريع (10) والمهام (16) تمر
- ✅ `npm run typecheck`

---

### المرحلة 5: المواعيد النهائية + الإنذارات + الحساب

**المدة التقديرية**: جلسة واحدة

#### المهام
1. **Background job للمواعيد النهائية** — في `server/src/index.ts`
   - تشغيل job كل دقيقة (كما هو موجود مع `safeInterval`)
   - استعلام المهام الفرعية ذات `deadline` وشيك:
     - `deadline` خلال 24 ساعة ولم يُرسل `24h` بعد → أنشئ `deadline_reminder` + إشعار
     - `deadline` خلال 6 ساعات ولم يُرسل `6h` بعد → أنشئ `deadline_reminder` + إشعار
     - `deadline` مضى (overdue) ولم يُرسل `overdue` بعد → أنشئ `deadline_reminder` + إشعار
   - استخدام جدول `deadline_reminders` لمنع التكرار

2. **إشعارات الإنذارات** في `WarningService`
   - `warning` ← عند إنشاء إنذار لموظف، أرسل له
   - `warning_cleared` ← عند مسح الإنذار
   - `warning_sustained` ← عند تثبيت الإنذار
   - النص: "تم إصدار إنذار بحقك: {reason}"

3. **إشعارات الحساب** في `AuthService` / `UserService`
   - `account_frozen` ← عند تجميد الحساب (للمستخدم نفسه)
   - `account_unfrozen` ← عند فك التجميد

4. **`deadline_extended`** في `SubtaskService`
   - عند تحديث `deadline` إلى تاريخ أبعد

5. **اختبارات**
   - Background job يُنشئ إشعارات للمواعيد القريبة
   - `warning` يُنشأ للمستخدم المستهدف
   - `deadline_extended` يُنشأ عند تمديد الموعد

#### ملفات التعديل
- `server/src/index.ts` — إضافة job المواعيد النهائية
- `server/src/services/DeadlineService.ts` — ملف جديد لفحص المواعيد
- `server/src/services/WarningService.ts` — إضافة إشعارات
- `server/src/services/UserService.ts` — إضافة إشعارات (frozen)
- `server/src/services/AuthService.ts` — إضافة إشعارات
- `server/src/services/SubtaskService.ts` — إضافة `deadline_extended`

#### معايير القبول
- ✅ Background job لا يُرسل إشعارات مكررة
- ✅ جميع اختبارات warnings (21) تمر
- ✅ `npm run typecheck`

---

### المرحلة 6: الباقي + اختبارات متكاملة

**المدة التقديرية**: جلسة واحدة

#### المهام
1. **`file_uploaded`** — في `UploadService`
   - عند رفع ملف مرتبط بمهمة فرعية، أرسل لصاحب المهمة

2. **`user_joined`** — في `UserService.create()`
   - أرسل للـ admins عند إنشاء مستخدم جديد

3. **`role_changed`** — في `RoleService`
   - أرسل للمستخدم عندما يتغير دوره

4. **`new_login` / `password_changed`** — في `AuthService`
   - `new_login` ← عند تسجيل دخول من IP جديد
   - `password_changed` ← عند تغيير كلمة المرور

5. **`daily_summary`** — تحسين الموجود
   - حاليًا `dailySummary()` في NotificationService يُرجع بيانات لكن لا ينشئ إشعارًا
   - إضافة background job يرسل ملخصًا يوميًا (مرة كل 24 ساعة)

6. **اختبارات متكاملة**
   - سيناريو كامل: إنشاء مشروع ← مهمة ← مهمة فرعية ← إسناد ← تسليم ← موافقة ← إشعارات في كل خطوة
   - اختبار تفضيلات المستخدم تعطل الإشعارات
   - اختبار `createMany()` مع قائمة مستخدمين

#### ملفات التعديل
- `server/src/services/UploadService.ts` — إضافة إشعار
- `server/src/services/AuthService.ts` — new_login, password_changed
- `server/src/services/RoleService.ts` — role_changed
- `server/src/services/UserService.ts` — user_joined
- `server/src/index.ts` — daily summary job
- `server/src/__tests__/notifications.test.ts` — اختبارات متكاملة

#### معايير القبول
- ✅ جميع الاختبارات تمر (80+)
- ✅ `npm run lint` 0 errors
- ✅ `npm run typecheck`
- ✅ سيناريو متكامل يعمل يدويًا

---

## مصفوفة التبعيات

```
Phase 1 ─── Foundation (create, createMany, emit)
  │
  ├──► Phase 2 ─── Subtask notifications
  │     │
  │     ├──► Phase 3 ─── Comment + @Mentions
  │     │
  │     ├──► Phase 4 ─── Project + Task notifications
  │     │
  │     ├──► Phase 5 ─── Deadlines + Warnings + Account
  │     │
  │     └──► Phase 6 ─── Remaining + Integration tests
  │
  └── كل المراحل تعتمد على Phase 1
```

- **Phase 1** شرط أساسي لكل المراحل الأخرى
- **Phases 2-5** يمكن تنفيذها بالترتيب أو بالتوازي (بعد Phase 1)
- **Phase 6** تعتمد على اكتمال Phase 5 (لأن daily_summary يحتاج deadline job)

---

## الإرسال عبر Socket.io

كل إشعار عند إنشائه يُبث فورًا عبر Socket.io:

```typescript
// server/src/services/NotificationService.ts
async create(userId: number, data: CreateNotifInput, io?: any) {
  // 1. تحقق من التفضيلات
  if (!await this.isEnabled(userId, data.type)) return null

  // 2. أنشئ الإشعار
  const [notif] = await this.db.insert(schema.notifications).values({...}).returning()

  // 3. ابث عبر Socket.io
  if (io) {
    const rooms = [`user:${userId}`]
    io.to(rooms).emit('notification', notif)
  }

  return notif
}
```

لكل خدمة تُنشئ إشعارًا، نمرّر `io` من `ctx(req)`:

```typescript
const ctx = { userId: req.user.id, roleId: req.user.role_id, io: req.app.get('io') }
```

العميل يستقبلها في `NotificationBell.tsx` (موجود بالفعل):

```typescript
socket.on('notification', (n: Notification) => {
  setNotifications(prev => [n, ...prev])
  if (!n.read) setUnread(c => c + 1)
})
```

---

## الملفات المتأثرة (شامل كل المراحل)

| الملف | المرحلة | نوع التغيير |
|-------|---------|-------------|
| `server/src/services/NotificationService.ts` | 1 | إنشاء `create()`, `createMany()` |
| `server/src/db/index.ts` | 1 | إضافة دالة مساعدة `emitToUser()` |
| `server/src/services/SubtaskService.ts` | 2, 5 | إضافة 7 أنواع إشعارات |
| `server/src/services/CommentService.ts` | 3 | إضافة `comment`, `@mention` |
| `server/src/services/mentions.ts` | 3 | ملف جديد لاستخراج @mentions |
| `server/src/services/ProjectService.ts` | 4 | إضافة 5 أنواع إشعارات |
| `server/src/services/TaskService.ts` | 4 | إضافة 3 أنواع إشعارات |
| `server/src/services/DeadlineService.ts` | 5 | ملف جديد لفحص المواعيد |
| `server/src/index.ts` | 5, 6 | إضافة background jobs |
| `server/src/services/WarningService.ts` | 5 | إضافة 3 أنواع إشعارات |
| `server/src/services/UserService.ts` | 5, 6 | إضافة `user_joined`, `account_frozen` |
| `server/src/services/AuthService.ts` | 5, 6 | إضافة `new_login`, `password_changed` |
| `server/src/services/UploadService.ts` | 6 | إضافة `file_uploaded` |
| `server/src/services/RoleService.ts` | 6 | إضافة `role_changed` |
| `server/src/__tests__/notifications.test.ts` | 1-6 | ملف اختبار جديد (ينمو مع كل مرحلة) |

---

## معايير النجاح النهائية

- ✅ جميع أنواع الإشعارات الـ 33 تنشأ عند حدوث الأحداث المناسبة
- ✅ تفضيلات المستخدم تُحترم (تعطيل نوع يمنع إنشائه)
- ✅ Socket.io يبث الإشعار فورًا للمستخدم المستهدف
- ✅ Background job يُرسل إشعارات المواعيد النهائية دون تكرار
- ✅ @Mentions تكتشف الأسماء العربية
- ✅ 80+ اختبار يمر بنجاح
- ✅ `npm run typecheck` سيرفر + عميل
- ✅ `npm run lint` 0 errors
