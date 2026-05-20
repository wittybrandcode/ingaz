# تحليل الخدمات — Server Services Analysis

> الملفات: `server/src/services/` — 10 ملفات (BaseService + 9 services)

## 5.1 BaseService
```typescript
export abstract class BaseService {
  constructor(protected db: PostgresJsDatabase<typeof schema>) {}
}
```
- بسيط، نظيف، يوفر `db` لجميع الخدمات
- لا توجد methods مشتركة (مثل `findById` أو `validateAccess`)

## 5.2 AuthService
| الطريقة | الصحة | المشاكل |
|---------|-------|---------|
| login | ✅ | bcrypt, jwt, null checks كلها صحيحة |
| me | ✅ | جلب المستخدم مع الدور، camelToSnake (redundant) |
| updateProfile | ✅ | تحديث جزئي، يعيد بيانات المستخدم |
| updateAvatar | ⚠️ | لا يوجد validation لصيغة/حجم الصورة |
| logout | ⚠️ | يضيف للـ blacklist ولكنه لا يتحقق من entry موجود |

## 5.3 ProjectService
| الطريقة | الصحة | المشاكل |
|---------|-------|---------|
| list | ✅ | فلترة حسب role_id بشكل صحيح |
| create | ⚠️ | لا يتحقق من وجود مشروع بنفس العنوان |
| archive/permanentDelete | ✅ | مع的活动 log |
| getMembers | ✅ | انضمام مع users |
| addMember | ⚠️ | لا يتحقق من `role_id === 3` (EMPLOYEE only) |
| removeMember | ⚠️ | لا يتحقق من إزالة المدير الوحيد |

## 5.4 TaskService
- **مشكلة حرجھة:** `create()` يتحقق من `isProjectManager` فقط — لا يتحقق من `createdBy === req.userId`
- لا يوجد توليد أرقام تسلسلية للمهام
- `update()` يسمح بتغيير `projectId` (نقل المهمة) بدون صلاحية منفصلة

## 5.5 SubtaskService
- `create()` يتحقق `isProjectManager` — صحيح (للـ EMPLOYEE)
- `delete()` cascade إلى `comments` و `attachments`
- **مشكلة:** لا توجد عملية transaction — `tasks.status` التحديث يحدث خارج transaction

## 5.6 NotificationService
- استخدام `isAnyOf()` في فلترة الإشعارات — كفؤ
- `dailySummary` يستخدم نطاق زمني (`startOfDay`, `endOfDay`) — صحيح
- **مشكلة:** لا توجد deduplication — قد تنشأ إشعارات مكررة

## 5.7 CommentService
- بسيط، `create()` فقط
- **مشكلة:** لا يتحقق من وجود subtask نشط
- **مشكلة:** لا transaction مع تحديث `winnerCommentId`

## 5.8 WarningService
- أكثر خدمة تعقيداً (9 methods)
- المنطق الشرطي صحيح
- **مشكلة:** تحديث restriction_level يتم خارج transaction
- **مشكلة:** `getFreezeStatus` لا يعيد الوقت المتبقي

## 5.9 ActivityLogService
- تنفيذ مصغر — يسجل أحداثاً قليلة
- لا يوجد pagination أو query للبحث

## 5.10 patterns عامة
- ✅ All services throw `AppError` للمخالفات التجارية
- ✅ All services تمتد `BaseService`
- ❌ معظم العمليات المعقدة بدون transactions
- ❌ لا يوجد Soft delete في الخدمات (مع أن الجداول تدعمه)
- ❌ Activity logs جزئية ومتقطعة
