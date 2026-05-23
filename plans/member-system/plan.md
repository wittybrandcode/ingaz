# Member System — خطة التنفيذ التفصيلية

> هذا الملف يصف كل مرحلة بالتفصيل: ما الذي سيُبرمج، أين، وكيف يُختبر.

---

## Phase 1 — Member API

### الهدف
إنشاء نقطة نهاية API جديدة تعيد بيانات الأعضاء الغنية للـ Dashboard.

### الملفات
- `server/src/services/MemberService.ts` — جديد
- `server/src/routes/members.ts` — جديد
- `server/src/index.ts` — تعديل: إضافة المسار

### التفاصيل

**MemberService.list()**
```sql
SELECT 
  u.id, u.name, u.email, u.avatar, u.is_manager, u.status,
  u.role_id, r.name AS role_name,
  u.frozen_at,
  (SELECT COUNT(*) FROM subtask_assignees sa 
   JOIN subtasks s ON sa.subtask_id = s.id 
   WHERE sa.user_id = u.id AND s.status IN ('open','in_progress','deferred')) AS active_tasks,
  (SELECT COUNT(*) FROM warnings w WHERE w.user_id = u.id AND w.status = 'pending') AS warnings_count,
  (SELECT COUNT(*) FROM project_members pm WHERE pm.user_id = u.id) AS projects_count,
  EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = u.role_id 
    AND rp.permission_key IN ('tasks.assign','subtasks.assign','projects.assign')
  ) AS can_assign
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.status = 'active'
ORDER BY u.name
```

**Response shape:**
```json
{
  "id": 1,
  "name": "أحمد",
  "email": "a@b.com",
  "avatar": "/uploads/...",
  "role_id": 2,
  "role_name": "مساهم",
  "is_manager": 0,
  "frozen_at": null,
  "active_tasks": 5,
  "warnings_count": 1,
  "projects_count": 3,
  "can_assign": true
}
```

### التحقق
- `npm run typecheck` ✅
- `curl GET /api/v1/members` يرجع مصفوفة أعضاء

---

## Phase 2 — Member Store

### الهدف
إنشاء `memberStore.ts` ليدير حالة الأعضاء ويربطها بـ Socket.io.

### الملفات
- `client/src/store/memberStore.ts` — جديد
- `client/src/lib/socket.ts` — تعديل: إضافة أحداث `user:online`/`user:offline`

### التفاصيل

**memberStore.ts:**
```ts
interface MemberProfile {
  id: number; name: string; email: string; avatar: string | null
  role_id: number; role_name: string; is_manager: number
  frozen_at: string | null
  active_tasks: number; warnings_count: number; projects_count: number
  can_assign: boolean
  online: boolean  // ← تحددها الـ Socket events
}

interface MemberStore {
  members: MemberProfile[]
  onlineUsers: Set<number>
  selectedMemberId: number | null
  loading: boolean
  
  loadMembers: () => Promise<void>
  selectMember: (id: number | null) => void
  setOnline: (userId: number, online: boolean) => void
}
```

**ربط Socket (socket.ts):**
```ts
// إضافة داخل connect() أو في useEffect
socket.on('user:online', (userId: number) => {
  memberStore.getState().setOnline(userId, true)
})
socket.on('user:offline', (userId: number) => {
  memberStore.getState().setOnline(userId, false)
})
```

**جهة الخادم (index.ts):** إرسال `user:online` عند اتصال Socket و `user:offline` عند قطع الاتصال.

### التحقق
- `npm run typecheck` ✅ (العميل)
- صفحة Dashboard ما زالت تشتغل بدون أخطاء

---

## Phase 3 — MemberCard + MemberList

### الهدف
بناء مكون `MemberCard` يعرض:
- ProfileAvatar مع badges (المهام النشطة، الإنذارات)
- اسم العضو + دوره
- نقطة اتصال
- والنقر عليها يحددها (selected state)
- و `MemberList` الذي يعرض قائمة الأعضاء في Dashboard

### الملفات
- `client/src/components/MemberCard.tsx` — جديد
- `client/src/components/MemberList.tsx` — جديد
- `client/src/pages/Dashboard.tsx` — تعديل: إضافة MemberList

### التفاصيل

**MemberCard layout:**
```
┌──────────────────────┐
│  [ProfileAvatar]     │
│  ┌──────┐            │
│  │ صورة │ badge مهام  │
│  │      │ badge إنذار │
│  └──────┘            │
│  أحمد محمد           │
│  مساهم               │
│  🟢 متصل             │
└──────────────────────┘
```

**MemberList layout:**
```
عرض Scrolling عمودي بجانب Dashboard:

┌─────────────────┬──────────────────────────────────┐
│   الأعضاء        │  (باقي Dashboard)                │
│  ┌───────────┐   │                                  │
│  │ MemberCard│   │                                  │
│  │ MemberCard│   │                                  │
│  │ MemberCard│   │                                  │
│  │ MemberCard│   │                                  │
│  └───────────┘   │                                  │
└─────────────────┴──────────────────────────────────┘
```

**التفاعل:**
- النقر على MemberCard → `selectMember(id)` في الـ store
- الـ MemberCard المحدد يحصل على إطار مميز (border highlight)
- عند اختيار عضو، الـ Dashboard يخزّن `selectedMemberId` في `memberStore`

### التحقق
- `npm run typecheck` ✅ (العميل)
- `npm run lint` ✅
- Dashboard يعرض القائمة مع الصور والباجات

---

## Phase 4 — Online Status via Socket

### الهدف
تفعيل حالة الاتصال المباشر (real-time online/offline) وربطها بـ MemberCard.

### الملفات
- `server/src/index.ts` — تعديل: أحداث `user:online`/`user:offline`
- `client/src/lib/socket.ts` — تعديل (تم في Phase 2)
- `client/src/components/MemberCard.tsx` — تعديل: عرض النقطة الخضراء

### التفاصيل

**جهة الخادم (index.ts):**
```ts
// في io.on('connection')
socket.on('join:user', (userId) => {
  socket.join(`user:${userId}`)
  socket.broadcast.emit('user:online', userId)
})

socket.on('disconnect', () => {
  // إرسال أن المستخدم غير متصل
  socket.broadcast.emit('user:offline', socket.data.user?.id)
})
```

**جهة العميل (socket.ts):**
```ts
socket.on('user:online', (userId) => {
  useMemberStore.getState().setOnline(userId, true)
})
socket.on('user:offline', (userId) => {
  useMemberStore.getState().setOnline(userId, false)
})
```

### التحقق
- فتح صفحة المتصفح في نافذتين → ظهور/اختفاء النقطة الخضراء

---

## Phase 5 — Action Icons + Assign/Warn

### الهدف
عند النقر على MemberCard، تظهر أيقونات إجرائية:
1. عدد المهام النشطة (عرض فقط)
2. أيقونة تكليف ← تفتح `AssignModal`
3. أيقونة إنذار ← تفتح `WarnModal`
4. أيقونة تفاصيل ← تفتح `MemberDetailModal`

وكذلك إنشاء `AssignModal` الذي يسمح بالتكليف بمشروع/مهمة/مهمة فرعية.

### الملفات
- `client/src/components/MemberCard.tsx` — تعديل: إضافة ActionIcons
- `client/src/components/AssignModal.tsx` — جديد
- `client/src/components/WarnModal.tsx` — جديد

### التفاصيل

**ActionIcons (تظهر عند selectedMemberId === member.id):**
```
[📋 5 مهام] [➕ تكليف] [⚠️ إنذار] [👤 تفاصيل]
```

**AssignModal:**
```
┌─────────────────────────────┐
│  تكليف: أحمد محمد            │
│                             │
│  نوع التكليف:               │
│  ○ مشروع                    │
│  ○ مهمة                     │
│  ○ مهمة فرعية               │
│                             │
│  اختر المشروع: [dropdown]   │
│  اختر المهمة: [dropdown]    │  ← يظهر حسب النوع
│                             │
│  [إلغاء]  [تكليف]          │
└─────────────────────────────┘
```

**WarnModal:**
```
┌─────────────────────────────┐
│  إنذار: أحمد محمد           │
│                             │
│  السبب: [textarea]          │
│  المهلة: [date picker]      │
│                             │
│  [إلغاء]  [إرسال إنذار]    │
└─────────────────────────────┘
```

**التحكم بالظهور حسب الصلاحية:**
- زر التكليف: `member.can_assign && user.is_manager`
- زر الإنذار: `permissions.includes('warnings.create')`
- زر التفاصيل: للجميع

### التحقق
- `npm run typecheck` ✅
- `npm run lint` ✅
- النقر على عضو → ظهور الإيقونات
- تجربة التكليف والإنذار

---

## Phase 6 — MemberDetailModal

### الهدف
مودال يعرض معلومات مفصلة عن العضو:
- إحصائيات (المهام النشطة، المنجزة، المشاريع، الإنذارات)
- قائمة المهام الحالية المكلف بها
- آخر النشاطات

### الملفات
- `client/src/components/MemberDetailModal.tsx` — جديد
- `client/src/components/MemberCard.tsx` — تعديل: ربط أيقونة التفاصيل

### التفاصيل

**MemberDetailModal layout:**
```
┌────────────────────────────────────┐
│  [ProfileAvatar كبير]               │
│  أحمد محمد — مساهم                  │
│  ─────────────────────────────────  │
│  📊 الإحصائيات                       │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │مهام│ │مشا-│ │إنذا│ │مشا│      │
│  │فاع-│ │ريع │ │رات │ │ركا│      │
│  │لة  │ │    │ │    │ │ت   │      │
│  └────┘ └────┘ └────┘ └────┘      │
│  ─────────────────────────────────  │
│  📋 المهام الحالية                   │
│  • مهمة 1 (مشروع ألف)               │
│  • مهمة 2 (مشروع باء)               │
│  ─────────────────────────────────  │
│  📝 آخر النشاطات                     │
│  • منذ 5 د — أضاف تعليق...          │
│  • منذ 2 س — أكمل مهمة...           │
└────────────────────────────────────┘
```

**المصادر:**
- الإحصائيات: من `MemberProfile` في الـ Store
- المهام الحالية: API جديدة `GET /api/members/:id/tasks`
- النشاطات: API جديدة `GET /api/members/:id/activity`

(API endpoints تُضاف في `MemberService`)

### التحقق
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run test` ✅
- المودال يفتح ويظهر البيانات كاملة
