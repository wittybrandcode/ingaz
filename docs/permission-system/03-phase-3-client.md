# المرحلة 3 — Client

> **الهدف**: إصلاح `ProjectSettingsModal` — قائمة التكليف تعمل بشرط واضح

---

## 3.1 إصلاح `ProjectSettingsModal.tsx`

**إزالة `loadRoles`**:

| السطر | قبل | بعد |
|-------|-----|-----|
| 35 | `const loadRoles = useAppStore(s => s.loadRoles)` | إزالته |
| 36 | `const roles = useAppStore(s => s.roles)` | إزالته |
| 46 | `loadRoles()` | إزالته |
| 47 | `}, [project.id, loadUsers, loadRoles])` | `}, [project.id, loadUsers])` |

**تحديث فلتر قائمة الأعضاء** — يظهر فقط من لديه صلاحيات كافية:

```typescript
availableUsers={users.filter(u => {
  if (u.is_manager) return false
  const p = u.permissions ?? []
  return p.includes('projects.view')
      && p.includes('tasks.create') && p.includes('tasks.edit')
      && p.includes('subtasks.create') && p.includes('subtasks.edit')
})}
```

**الـ `canAssign`** — سحب من `permissions.includes('projects.assign')`:
- Manager: عنده هذه الصلاحية (وحسب bypass)
- من له دور يحتوي `projects.assign`: نقدر يكلف
- الباقي: مخفي

```typescript
canAssign={permissions.includes('projects.assign')}
```

## 3.2 إضافة `is_manager` و `permissions` إلى واجهة `User`

`shared/types.ts`

```typescript
export interface User {
  id: number
  name: string
  email: string
  role_id: number
  role_name: string
  avatar: string | null
  status: string
  is_manager?: number       // ← إضافة
  permissions?: string[]     // ← إضافة (صلاحيات الدور)
  frozen_at?: string | null
  freeze_reason?: string | null
  credit_score?: number
  warnings?: number
}
```

## 3.3 إضافة `is_manager` إلى `AuthService` — الـ JWT يرسل `is_manager`

بالفعل تم في المرحلة 2. العميل يستقبل `is_manager` في استجابة `GET /auth/me` و `POST /auth/login`.

## 3.4 ملفات متأثرة

| الملف | التغيير |
|-------|---------|
| `client/src/components/ProjectSettingsModal.tsx` | إزالة `loadRoles` + فلتر جديد |
| `shared/types.ts` | إضافة `is_manager` + `permissions` إلى `User` |

## 3.5 التحقق

```bash
cd client && npm run typecheck
```
