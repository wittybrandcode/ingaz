# المرحلة 1 — الـ Schema والـ Migration والـ Seed

> **الهدف**: إضافة `is_manager` إلى users + إعادة كتابة الـ seed

---

## 1.1 إضافة `is_manager` — `server/src/db/schema.ts`

```typescript
// داخل جدول users، بعد avatar:
isManager: integer('is_manager').default(0),
```

> لا نضيف `user_permissions` — ملغي.

## 1.2 إعادة توليد الـ Migration

```bash
cd server && npm run db:generate
```

## 1.3 إعادة كتابة الـ Seed — `server/src/seed.ts`

الـ seed الجديد يخلق فقط:

1. **مدير واحد** (admin@ingaz.com / admin123, is_manager=1, role_id=NULL)
2. **32 صلاحية** (كما هي حالياً)
3. **دورين افتراضيين**:
   - "مدير مشروع" ← projects.view, tasks.*, subtasks.*, comments.create
   - "مشارك" ← subtasks.submit, comments.create
4. **مستخدم اختبار واحد** (emp@ingaz.com / emp123) بدور "مشارك"

```typescript
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { eq, inArray } from 'drizzle-orm'
import { getDb, closePool, schema } from './db/index.js'

async function main() {
  const db = getDb()

  // 1. المستخدم المدير (is_manager=true, بدون دور)
  const exists = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, 'admin@ingaz.com')).limit(1)
  if (exists.length === 0) {
    await db.insert(schema.users).values({
      name: 'المدير العام',
      email: 'admin@ingaz.com',
      password: await bcrypt.hash('admin123', 10),
      isManager: 1,
    })
    console.log('Manager created: admin@ingaz.com / admin123')
  }

  // 2. الـ 32 صلاحية
  const permissions = [
    ['projects.view', 'عرض المشاريع', 'المشاريع', 1],
    ['projects.create', 'إنشاء المشاريع', 'المشاريع', 2],
    ['projects.edit', 'تعديل المشاريع', 'المشاريع', 3],
    ['projects.delete', 'حذف المشاريع', 'المشاريع', 4],
    ['projects.archive', 'أرشفة المشاريع', 'المشاريع', 5],
    ['projects.assign', 'تكليف أعضاء المشروع', 'التكليف', 1],
    ['tasks.view', 'عرض المهام', 'المهام', 1],
    ['tasks.create', 'إنشاء المهام', 'المهام', 2],
    ['tasks.edit', 'تعديل المهام', 'المهام', 3],
    ['tasks.delete', 'حذف المهام', 'المهام', 4],
    ['tasks.assign', 'تكليف المسؤولين عن المهام', 'التكليف', 2],
    ['subtasks.view', 'عرض المهام الفرعية', 'المهام الفرعية', 1],
    ['subtasks.create', 'إنشاء المهام الفرعية', 'المهام الفرعية', 2],
    ['subtasks.edit', 'تعديل المهام الفرعية', 'المهام الفرعية', 3],
    ['subtasks.delete', 'حذف المهام الفرعية', 'المهام الفرعية', 4],
    ['subtasks.assign', 'تعيين المهام الفرعية', 'التكليف', 3],
    ['subtasks.submit', 'تسليم مهمة فرعية', 'المهام الفرعية', 6],
    ['subtasks.complete', 'ترشيح فائز في مهمة فرعية', 'المهام الفرعية', 5],
    ['subtasks.cancel', 'إلغاء مهمة فرعية', 'المهام الفرعية', 8],
    ['subtasks.defer', 'تأجيل مهمة فرعية', 'المهام الفرعية', 9],
    ['users.view', 'عرض المستخدمين', 'المستخدمين', 1],
    ['users.create', 'إنشاء المستخدمين', 'المستخدمين', 2],
    ['users.edit', 'تعديل المستخدمين', 'المستخدمين', 3],
    ['users.delete', 'حذف المستخدمين', 'المستخدمين', 4],
    ['roles.view', 'عرض الأدوار', 'الأدوار والصلاحيات', 1],
    ['roles.create', 'إنشاء الأدوار', 'الأدوار والصلاحيات', 2],
    ['roles.edit', 'تعديل الأدوار', 'الأدوار والصلاحيات', 3],
    ['roles.delete', 'حذف الأدوار', 'الأدوار والصلاحيات', 4],
    ['analytics.view', 'عرض التقارير', 'التقارير', 1],
    ['comments.create', 'إضافة تعليقات', 'التعليقات', 1],
  ]

  for (const [key, name, group, sort] of permissions) {
    await db.insert(schema.permissions).values({ key, name, groupName: group, sortOrder: sort }).onConflictDoNothing()
  }

  const allPerms = await db.select({ id: schema.permissions.id, key: schema.permissions.key }).from(schema.permissions)

  // 3. دور "مدير مشروع" ← الصلاحيات التي تخول التكليف + الإدارة
  const [projMgrRole] = await db.insert(schema.roles).values({ name: 'مدير مشروع' }).onConflictDoNothing().returning()
  const projMgrId = projMgrRole?.id ?? (await db.select({ id: schema.roles.id }).from(schema.roles).where(eq(schema.roles.name, 'مدير مشروع')).limit(1))[0]?.id
  if (projMgrId && !projMgrRole?.id) {
    // if already exists, fetch ids
  }

  // 4. دور "مشارك" ← تقديم وتسليم وتعليق
  const [partRole] = await db.insert(schema.roles).values({ name: 'مشارك' }).onConflictDoNothing().returning()
  // ...

  console.log('Seed complete.')
  await closePool()
}

main().catch(e => { console.error('Seed failed:', e); process.exit(1) })
```

> **ملاحظة**: الـ seed أعلاه مبسّط للتوضيح. الـ seed الفعلي سيكون أنظف.

## 1.4 ملفات متأثرة

| الملف | التغيير |
|-------|---------|
| `server/src/db/schema.ts` | إضافة `isManager` |
| `server/drizzle/*.sql` | إعادة توليد |
| `server/src/seed.ts` | إعادة كتابة كاملة |

## 1.5 التحقق

```bash
cd server && npm run typecheck
```
