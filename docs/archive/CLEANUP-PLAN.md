# خطة التنظيف والإصلاح — إنجاز (Ingaz)

> **بناءً على:** `docs/ANALYSIS-REPORT.md`
> **تاريخ:** 2026-05-26
> **الهدف:** خطة تدريجية لإصلاح 93 مشكلة مكتشفة

---

## نظرة عامة على المراحل

| المرحلة | التركيز | المشاكل | الجهد التقديري | الحالة |
|---------|---------|---------|----------------|--------|
| 1 | إصلاحات أمنية حرجة + أعطال | C2–C6, C10, C12 | 4-6 ساعات | ✅ مكتمل |
| 2 | إصلاح قاعدة بيانات واختبارات | C1, C7, C8, C11, H11 | 4-6 ساعات | ✅ مكتمل |
| 3 | معاملات + معالجة أخطاء | H1, H3, H8, H9 | 4-6 ساعات | ✅ جزئي (H3, H8 مكتمل) |
| 4 | إصلاحات صلاحيات + ملفات | C3, C4, H4, H5, H7 | 3-5 ساعات | ✅ مكتمل |
| 5 | عملاء — إصلاحات + تحسينات | C5, C6, C9, C10, H6, H7 | 4-6 ساعات | ✅ جزئي (C9, ErrorBoundary, memo) |
| 6 | تنظيف الكود + إزالة التكرار | M1–M10, L1–L17 | 4-6 ساعات | ✅ مكتمل |
| 7 | بنية تحتية + CI/CD | L8, L9, A1–A6 | 4-6 ساعات | ✅ مكتمل |

**إجمالي الجهد التقديري:** 27-41 ساعة

---

## المرحلة 1: إصلاحات أمنية حرجة + أعطال

### الأهداف
إصلاح الثغرات الأمنية التي تسمح بتنفيذ كود أو تجاوز صلاحيات أو تعطل الخدمات.

### المهام

#### 1.1 🔴 إصلاح `PUT /subtasks/:id` — إضافة صلاحية (C3)
**الملف:** `server/src/routes/subtasks.ts:62`
```diff
- router.put('/:id', authenticate, checkFrozen, validate(updateSubtaskSchema), tryCatch(...))
+ router.put('/:id', authenticate, checkFrozen, authorizePermission('subtasks.edit'), requireCredit('canEdit'), validate(updateSubtaskSchema), tryCatch(...))
```

#### 1.2 🔴 إصلاح XSS في ViewModal (C5)
**الملف:** `client/src/components/ViewModal.tsx:37`
```diff
- dangerouslySetInnerHTML={{ __html: text }}
+ dangerouslySetInnerHTML={{ __html: sanitizeHTML(text) }}
```
يتطلب إضافة `import { sanitizeHTML } from '../lib/sanitize'`

#### 1.3 🔴 إصلاح sanitize.ts للسماح بـ `javascript:` URLs (C6)
**الملف:** `client/src/lib/sanitize.ts`
```diff
- DOMPurify.sanitize(dirty, {})
+ DOMPurify.sanitize(dirty, {
+   ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|ftp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
+ })
```

#### 1.4 🔴 إصلاح `.run()` على PostgreSQL (C2)
**الملف:** `server/src/services/DeadlineService.ts:106`
```diff
- await this.db.insert(schema.deadlineReminders).values({ subtaskId, reminderType }).run()
+ await this.db.insert(schema.deadlineReminders).values({ subtaskId, reminderType })
```
أيضًا تحسين `tryInsert` لرمي الخطأ بدلاً من إخفائه:
```diff
- try { ... } catch { return false }
+ try { ... } catch (e) { console.error('[DeadlineService] insert failed:', e); return false }
```

#### 1.5 🔴 إصلاح `checkFrozen` للتغطية (C4)
**الملفات:** `server/src/routes/tasks.ts:56,65,71`, `subtasks.ts:67,76,82`
إضافة `checkFrozen` إلى 6 مسارات.

#### 1.6 🔴 إصلاح `seed-full.ts` ID مكرر (C12)
**الملف:** `server/src/seed-full.ts:51-53`
```diff
- await run('INSERT INTO roles (id, name) VALUES ($1, $2)', 2, 'employee')
+ await run('INSERT INTO roles (id, name) VALUES ($1, $2)', 3, 'employee')
```

#### 1.7 🔴 إصلاح `AssignModal` (C10)
**الملف:** `client/src/components/AssignModal.tsx`
تعديل endpoint التحميل حسب `assignType`:
```ts
const endpoint = assignType === 'task'
  ? `/tasks/project/${selectedProject}`
  : `/subtasks/by-project/${selectedProject}`
```

### التحقق
```bash
cd server && npm run typecheck && npm run lint
cd client && npm run typecheck && npm run lint
```

---

## المرحلة 2: إصلاح قاعدة البيانات والاختبارات

### الأهداف
إصلاح الاختبارات الفاشلة، توحيد الـ schemas، إصلاح تسريب الإشعارات.

### المهام

#### 2.1 إضافة `fromUserId` إلى test-schema.ts
**الملف:** `server/src/__tests__/test-schema.ts`
```diff
+ fromUserId: integer('from_user_id'),
```

#### 2.2 إضافة `from_user_id` إلى `SCHEMA_SQL` في `helpers.ts`
**الملف:** `server/src/__tests__/helpers.ts`

#### 2.3 إصلاح `NotificationService.create()` — استخدام `RETURNING` (C11)
**الملف:** `server/src/services/NotificationService.ts:252-255`
```diff
- const [notif] = await this.db.select()...
+ const [notif] = await this.db.insert(schema.notifications).values(data).returning()
```

#### 2.4 إصلاح `NotificationService.createMany()` — استخدام `RETURNING` (C7)
**الملف:** `server/src/services/NotificationService.ts:289-291`
```diff
- const notifs = await this.db.select()...
+ const notifs = await this.db.insert(schema.notifications).values(items).returning()
```

#### 2.5 حقن `NotificationService` عبر constructor (C8, C9)
**الملف:** `server/src/services/*.ts`
تغيير من module-level `new NotificationService(getDb())` إلى:
```ts
constructor(db: any, notifService?: NotificationService) {
  super(db)
  this.notifService = notifService || new NotificationService(db)
}
```

#### 2.6 إضافة `schema` إلى mock في `notifications.test.ts` و `deadlines.test.ts`
تقليد `../db/index.js` مثل باقي الاختبارات.

### التحقق
```bash
cd server && npm run test  # توقع: 95/95 ✅
```

---

## المرحلة 3: معاملات ومعالجة أخطاء

### الأهداف
إضافة transactions للعمليات المعقدة، تغليف جميع المسارات بـ tryCatch.

### المهام

#### 3.1 إضافة transactions للعمليات الحرجة (H1)

**WarningService.create():**
```ts
return await this.db.transaction(async (tx) => {
  const [warning] = await tx.insert(schema.warnings).values({...}).returning()
  // ... معالجة إضافية ضمن نفس المعاملة
})
```

**الملفات المتأثرة:**
- `WarningService.ts` — create, respond
- `AuthService.ts` — login, updateProfile
- `UserService.ts` — create
- `backend jobs` — checkExpiredWarnings, autoRecoverCredit

#### 3.2 إضافة `tryCatch` إلى جميع المسارات (H3)

**الملفات المتأثرة (30+ نقطة):**
- `src/routes/notifications.ts` — جميع المسارات (8)
- `src/routes/users.ts:28`
- `src/routes/projects.ts:28,52`
- `src/routes/warnings.ts:29,42,46,56,66,71,80,109,113`
- `src/routes/members.ts:8,14,26`
- `src/routes/upload.ts:57,72`

إنشاء دالة مساعدة إذا لم تكن موجودة:
```ts
const wrap = (fn: Function) => async (req: Request, res: Response, next: NextFunction) => {
  try { await fn(req, res, next) } catch (e) { next(e) }
}
```

#### 3.3 إصلاح `GET /subtasks/by-tasks` (H8)
```diff
+ if (!req.query.task_ids) return res.fail(400, 'task_ids required')
```

#### 3.4 إصلاح تجميع N+1 في `createMany` (H2)
تعديل `isEnabled` لقبول مصفوفة `{userId, type}[]` واستعلام واحد:
```sql
SELECT user_id, notification_type, enabled
FROM notification_preferences
WHERE (user_id, notification_type) IN (${...})
```

### التحقق
```bash
cd server && npm run test
cd server && npm run lint  # تقليل تحذيرات tryCatch
```

---

## المرحلة 4: إصلاحات صلاحيات وملفات

### الأهداف
إصلاح تحميل الملفات، تحسين التحقق من الصلاحيات، إصلاح `hasPermission`.

### المهام

#### 4.1 إصلاح `UploadService.deleteFile` مسار الملف (H4)
**الملف:** `server/src/services/UploadService.ts:160`
```diff
- if (fs.existsSync(file.filename)) fs.unlinkSync(file.filename)
+ const filePath = path.join(process.cwd(), 'uploads', file.filename)
+ if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
```

#### 4.2 إصلاح `hasPermission()` مع userId (H5)
تعديل `SubtaskService.ts:270,351` لتمرير `ctx.userId`.

#### 4.3 إصلاح `ProjectService.addMember` — معامل role (M5)
```diff
- async addMember(ctx, projectId, userId: number) {
+ async addMember(ctx, projectId, userId: number, role: string = 'member') {
```

#### 4.4 إزالة `camelToSnake()` الزائد من الخدمات (M2)

#### 4.5 إصلاح كاش `checkFrozen` (M3)
```diff
- frozen_at: user?.frozenAt ? new Date(user.frozenAt).toISOString() : null,
+ isFrozen: !!user?.frozenAt,
```

### التحقق
```bash
cd server && npm run typecheck
```

---

## المرحلة 5: عميل — إصلاحات وتحسينات

### الأهداف
إصلاح أخطاء العميل، تحسين إدارة الحالة، إضافة Error Boundaries.

### المهام

#### 5.1 إصلاح `socket.ts` تسريب الاشتراك (C9)
إنشاء خطاف `useSocketAuth`:
```ts
// hooks/useSocketAuth.ts
export function useSocketAuth() {
  useEffect(() => {
    const unsub = useAuthStore.subscribe((state) => {...})
    return () => unsub()
  }, [])
}
```

#### 5.2 إضافة Error Boundaries للصفحات المحمية (H6)
في `App.tsx`:
```tsx
<Route element={<ProtectedRoute><ErrorBoundary><Layout /></ErrorBoundary></ProtectedRoute>}>
```

#### 5.3 دمج `KanbanBoard` مع Zustand stores (H7)
استخدام `useProjectStore`, `useTaskStore`, `useSubtaskStore` بدلاً من `useState`.

#### 5.4 إضافة `React.memo` لـ `MemberProfileCard`

#### 5.5 إنشاء نظام إشعارات أخطاء مركزي (H9)
```tsx
// components/Toast.tsx
export function Toast({ message, type }) { ... }
// lib/toast.ts
export function showToast(message: string, type: 'success' | 'error' = 'error') { ... }
```

### التحقق
```bash
cd client && npm run typecheck && npm run lint
```

---

## المرحلة 6: تنظيف الكود

### الأهداف
إزالة الكود المكرر والميت، توحيد الأنماط، نقل التبعيات.

### المهام

#### 6.1 توحيد تصدير CSV (M1)
إنشاء دالة مركزية في `lib/exportToCSV.ts`.

#### 6.2 إزالة `MemberCard` غير المستخدم (L2)
حذف `client/src/components/MemberCard.tsx`.

#### 6.3 نقل `better-sqlite3` إلى devDependencies (M10)
```bash
npm uninstall better-sqlite3 @types/better-sqlite3
npm install --save-dev better-sqlite3 @types/better-sqlite3
```

#### 6.4 إزالة `cookie-parser` إذا لم يُستخدم (L3)

#### 6.5 إزالة `setup.ts` القديم

#### 6.6 إزالة الاستيرادات غير المستخدمة من جميع الملفات (lint warnings)
تغطية تحذيرات `no-unused-vars`.

#### 6.7 إصلاح `@types/express@5` → `@types/express@4` (M9)
```bash
npm install --save-dev @types/express@4
```

### التحقق
```bash
cd server && npm run lint  # توقع: 0 تحذيرات
cd client && npm run lint  # توقع: 0 تحذيرات
cd server && npm run test
cd client && npm run typecheck
```

---

## المرحلة 7: بنية تحتية و CI/CD

### الأهداف
تحسين قابلية التوسع، إضافة CI/CD، توثيق معايير الجودة.

### المهام

#### 7.1 تقسيم `KanbanBoard` إلى مكونات فرعية (A1)
إنشاء `ProjectsColumn`, `TasksColumn`, `SubtasksColumn`, `MembersColumn`.

#### 7.2 ناقل أحداث Socket مركزي (A2)
```ts
// lib/eventBus.ts
type Listener = (event: string, data: any) => void
class EventBus { ... }
export const eventBus = new EventBus()
```

#### 7.3 إضافة GitHub Actions (CI/CD)
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
    steps:
      - uses: actions/checkout@v4
      - run: cd server && npm ci && npm run typecheck && npm run lint && npm run test
      - run: cd client && npm ci && npm run typecheck && npm run lint
```

#### 7.4 تحسين `sendDailySummaries` مع batch inserts (L8)

### التحقق
```bash
# محاكاة CI محليًا
cd server && npm run typecheck && npm run lint && npm run test
cd client && npm run typecheck && npm run lint
```

---

## ملخص الملفات المتأثرة

### السيرفر (20+ ملف)

| الملف | التغيير | المرحلة |
|-------|---------|---------|
| `src/routes/subtasks.ts` | إضافة صلاحية + tryCatch | 1, 3 |
| `src/routes/tasks.ts` | إضافة checkFrozen | 1 |
| `src/routes/notifications.ts` | إضافة tryCatch | 3 |
| `src/routes/users.ts` | إضافة tryCatch | 3 |
| `src/routes/projects.ts` | إضافة tryCatch | 3 |
| `src/routes/warnings.ts` | إضافة tryCatch | 3 |
| `src/routes/members.ts` | إضافة tryCatch | 3 |
| `src/routes/upload.ts` | إضافة tryCatch | 3 |
| `src/services/DeadlineService.ts` | إزالة `.run()` | 1 |
| `src/services/NotificationService.ts` | RETURNING, N+1, transaction | 2, 3 |
| `src/services/WarningService.ts` | Transaction + hasPermission | 3, 4 |
| `src/services/AuthService.ts` | Transaction + await | 3 |
| `src/services/UserService.ts` | Transaction | 3 |
| `src/services/SubtaskService.ts` | hasPermission مع userId | 4 |
| `src/services/ProjectService.ts` | addMember role | 4 |
| `src/services/UploadService.ts` | مسار الملف | 4 |
| `src/middleware/auth.ts` | كاش checkFrozen | 4 |
| `src/seed-full.ts` | إصلاح ID مكرر | 1 |
| `src/__tests__/test-schema.ts` | إضافة fromUserId | 2 |
| `src/__tests__/helpers.ts` | إضافة from_user_id | 2 |

### العميل (15+ ملف)

| الملف | التغيير | المرحلة |
|-------|---------|---------|
| `src/components/ViewModal.tsx` | sanitizeHTML | 1 |
| `src/lib/sanitize.ts` | ALLOWED_URI_REGEXP | 1 |
| `src/lib/socket.ts` | إصلاح تسريب الاشتراك | 5 |
| `src/components/AssignModal.tsx` | endpoint حسب الكيان | 1 |
| `src/components/KanbanBoard.tsx` | استخدام Zustand stores | 5 |
| `src/components/MemberProfileCard.tsx` | React.memo | 5 |
| `src/components/MemberCard.tsx` | حذف ✅ | 6 |
| `src/App.tsx` | Error Boundaries ✅ | 5 |
| `src/lib/exportToCSV.ts` | توحيد ✅ | 6 |
| `src/pages/Dashboard.tsx` | CSV موحد ✅ | 6 |
| `src/components/ProjectSettingsModal.tsx` | CSV موحد ✅ | 6 |
| `src/hooks/useSocketAuth.ts` | خطاف socket جديد ✅ | 5 |
| `.github/workflows/ci.yml` | CI/CD workflow ✅ | 7 |

---

## الـ Quick Wins (أقل من 30 دقيقة)

هذه المشاكل يمكن إصلاحها بسرعة كبيرة ولها تأثير فوري:

1. ✅ `seed-full.ts` — تغيير ID من 2 إلى 3 لـ employee
2. ✅ إزالة `cookie-parser` (إذا لم يُستخدم)
3. ✅ إزالة `MemberCard.tsx` غير المستخدم
4. ✅ إضافة `sanitizeHTML()` إلى `ViewModal.tsx`
5. ✅ إضافة `ALLOWED_URI_REGEXP` إلى `sanitize.ts`
6. ✅ إضافة `checkFrozen` إلى 6 مسارات
7. ✅ إضافة `fromUserId` إلى `test-schema.ts`

---

## قائمة التحقق النهائية

قبل اعتبار المشروع "نظيفًا"، تأكد من:

- [x] `npm run test` في السيرفر → 95/95 ✅
- [x] `npm run typecheck` في السيرفر → 0 أخطاء
- [x] `npm run lint` في السيرفر → 0 أخطاء
- [x] `npm run typecheck` في العميل → 0 أخطاء
- [x] `npm run lint` في العميل → 0 أخطاء
- [x] جميع المسارات مغلفة بـ tryCatch أو try/catch
- [ ] جميع العمليات متعددة الخطوات داخل transactions ⏳
- [x] `better-sqlite3` في devDependencies
- [x] `@types/express@4` بدلاً من 5
- [x] لا يوجد `console.log` تجريبي
- [x] لا يوجد كود ميت أو غير مستخدم
