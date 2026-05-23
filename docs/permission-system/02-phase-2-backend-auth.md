# المرحلة 2 — Backend Authorization

> **الهدف**: إصلاح `authorize`, `authorizePermission`, `hasPermission`, `authenticate`

---

## 2.1 تعديل `authenticate` — إضافة `is_manager`

`server/src/middleware/auth.ts`

```typescript
// في دالة generateToken (الموجودة في auth.ts):
export function generateToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

// عند فك JWT في authenticate:
const decoded = jwt.verify(token, JWT_SECRET) as any
req.user = {
  id: decoded.id,
  email: decoded.email,
  name: decoded.name,
  avatar: decoded.avatar,
  role_id: decoded.role_id,
  is_manager: decoded.is_manager,  // ← إضافة
}
```

## 2.2 تعديل `authorize` — إضافة bypass للمدير

```typescript
export function authorize(...roleIds: number[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // المدير يمر دائماً
    if (req.user.is_manager) { next(); return }

    // فحص role_id للباقي
    if (roleIds.includes(req.user.role_id)) { next(); return }
    res.fail(403, 'غير مصرح')
  }
}
```

## 2.3 إعادة كتابة `authorizePermission` — بدون bypass لغير المدير

```typescript
export function authorizePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // المدير يمر بدون فحص
    if (req.user.is_manager) { next(); return }

    // فحص role_permissions
    const rows = await getDb()
      .select()
      .from(schema.rolePermissions)
      .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
      .where(
        and(
          eq(schema.rolePermissions.roleId, req.user.role_id),
          eq(schema.permissions.key, permissionKey),
        )
      )
      .limit(1)

    if (rows.length > 0) { next(); return }
    res.fail(403, 'صلاحيات غير كافية')
  }
}
```

## 2.4 إعادة كتابة `hasPermission` — بدون bypass لغير المدير

```typescript
export async function hasPermission(roleId: number, permissionKey: string, userId?: number): Promise<boolean> {
  // المدير لديه كل الصلاحيات
  if (userId) {
    const [user] = await getDb()
      .select({ isManager: schema.users.isManager })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    if (user?.isManager) return true
  }

  // فحص role_permissions
  const rows = await getDb()
    .select()
    .from(schema.rolePermissions)
    .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
    .where(
      and(
        eq(schema.rolePermissions.roleId, roleId),
        eq(schema.permissions.key, permissionKey),
      )
    )
    .limit(1)
  return rows.length > 0
}
```

## 2.5 إضافة `requireManager` — جديد

```typescript
export function requireManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.is_manager) {
    return res.fail(403, 'غير مصرح')
  }
  next()
}
```

المسارات التي تستخدمه:

| المسار | الاستخدام |
|--------|-----------|
| `POST /roles` | إنشاء دور |
| `PUT /roles/:id` | تعديل دور |
| `DELETE /roles/:id` | حذف دور |
| `PUT /roles/:id/permissions` | تعديل صلاحيات دور |

## 2.6 تحديث `AuthService` — إضافة `isManager` إلى الاستعلامات

`server/src/services/AuthService.ts`

```typescript
// في login() — أضف إلى الـ select:
isManager: schema.users.isManager,

// في me() — أضف إلى الـ select:
isManager: schema.users.isManager,
```

## 2.7 تحديث `UserService.list()` — إضافة الصلاحيات لكل مستخدم

`server/src/services/UserService.ts`

```typescript
import { getUserPermissions } from '../db/index.js'

async list(page: number, pageSize: number, includeArchived = false) {
  // ... الكود الحالي لاستعلام المستخدمين ...

  // إضافة صلاحيات لكل مستخدم
  const usersWithPerms = await Promise.all(users.map(async (u: any) => ({
    ...u,
    permissions: await getUserPermissions(u.id)
  })))

  return { data: camelToSnake(usersWithPerms), total, pages, pageSize }
}
```

## 2.8 تحديث `getUserPermissions` — بدون `user_permissions`

`server/src/db/index.ts:66-74` — لا تغيير. تبقى تفحص `role_permissions` فقط كما كانت.

## 2.9 تحديث المسارات — استبدال `authorize(ROLES.ADMIN)` بـ `authorizePermission`

| المسار | قبل | بعد |
|--------|-----|-----|
| `POST /users` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `PUT /users/:id` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `DELETE /users/:id` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `PUT /users/:id/restore` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `POST /roles` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `PUT /roles/:id` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `DELETE /roles/:id` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `PUT /roles/:id/permissions` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `GET /roles` | `authorize(ROLES.ADMIN, ROLES.DEPUTY)` | `authorizePermission('roles.view')` |
| `POST /projects` | `authorize(ROLES.ADMIN, ROLES.DEPUTY)` | `authorizePermission('projects.create')` |
| `PUT /projects/:id` | `authorize(ROLES.ADMIN, ROLES.DEPUTY)` | `authorizePermission('projects.edit')` |
| `POST /projects/:id/archive` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `DELETE /projects/:id/permanent` | `authorize(ROLES.ADMIN)` | `requireManager` |
| `POST /projects/:id/members` | `authorizePermission('projects.assign')` | لا تغيير ✅ |
| `DELETE /projects/:id/members/:userId` | `authorizePermission('projects.assign')` | لا تغيير ✅ |
| إدارة المهام والمهام الفرعية | `authorizePermission` موجود | لا تغيير ✅ |

## 2.10 حذف الـ `ROLES` constants غير الضرورية

نحذف `ROLES.DEPUTY` و `ROLES.EMPLOYEE` من الـ constants إذا لم يعد لها استخدام.

## 2.11 ملفات متأثرة

| الملف | التغيير |
|-------|---------|
| `server/src/middleware/auth.ts` | تعديل `authorize`, `authorizePermission`, `hasPermission`, `authenticate` + إضافة `requireManager` |
| `server/src/db/index.ts` | لا تغيير (`getUserPermissions` تبقى كما هي) |
| `server/src/services/AuthService.ts` | إضافة `isManager` إلى login/me |
| `server/src/services/UserService.ts` | إضافة `permissions` إلى `list()` |
| `server/src/routes/users.ts` | استبدال `authorize(ROLES.ADMIN)` ← `requireManager` |
| `server/src/routes/roles.ts` | استبدال `authorize(ROLES.ADMIN)` ← `requireManager` |
| `server/src/routes/projects.ts` | استبدال `authorize(ROLES.ADMIN, ROLES.DEPUTY)` ← `authorizePermission(...)` |
| `server/src/constants.ts` | حذف `ROLES.DEPUTY`, `ROLES.EMPLOYEE` إذا لم تعد مستخدمة |

## 2.12 التحقق

```bash
cd server && npm run typecheck
```
