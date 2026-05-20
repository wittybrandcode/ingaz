# إنجاز — نظام إدارة المشاريع والمهام

> **Ingaz**: Hierarchical project management with comment-based execution, automatic status propagation, and role-based permissions.

---

## 1. Core Entities & Hierarchy

```
المشروع (Project)
  └── المهام (Tasks)
        └── المهام الفرعية (Subtasks)
```

**العملية الأساسية:**
1. المدير ينشئ **مشروعاً**
2. المدير يعيّن أعضاء للمشروع (من له صلاحية إنشاء/تعديل مهمة)
3. العضو ينشئ **مهاماً** داخل المشروع و **مهام فرعية** داخل المهام
4. العضو يعيّن مكلفين للمهام الفرعية (من له صلاحية التعليق)
5. المكلفون **يعلقون** (نصوص/صور/روابط) على المهمة الفرعية
6. المدير أو من له الصلاحية **يرشّح تعليقاً فائزاً** ← تتحول الم.الفرعية إلى `منفذة`
7. المهمة تكتمل تلقائياً عندما كل مهامها الفرعية منفذة
8. المشروع يكتمل تلقائياً عندما كل مهامه مكتملة

---

## 2. Status Models

### 2.1 Subtask Status (4 states)

```
[open] ──(ترشيح تعليق فائز)──► [completed]  ✓
   │
   ├──(إلغاء)──► [cancelled]
   │
   └──(تأجيل)──► [deferred]
```

| Status | Arabic | Meaning | Affects Completion |
|--------|--------|---------|-------------------|
| `open` | مفتوحة | مفتوحة للتعليقات والمناقشة | **نعم** — تعتبر غير منفذة |
| `completed` | منفذة | تم ترشيح تعليق فائز ✓ | **نعم** — تعتبر منفذة |
| `cancelled` | ملغية | ألغيت — خارج التقييم | **لا** |
| `deferred` | مؤجلة | أرجئت — خارج التقييم حالياً | **لا** |

#### Valid Transitions

| From | To | Trigger | Who |
|------|----|---------|-----|
| `open` | `completed` | Pick a winning comment | `subtasks.complete` |
| `open` | `cancelled` | Cancel subtask | `subtasks.cancel` |
| `open` | `deferred` | Defer subtask | `subtasks.defer` |
| `deferred` | `open` | Reactivate | `subtasks.defer` |
| `completed` | — | Terminal state | No transitions out |
| `cancelled` | — | Terminal state | No transitions out |

> **`cancelled`** نهائي — لا يمكن إعادة فتحه. **`deferred`** يمكن إعادة فتحه إلى `open`.

#### Who Can Complete a Subtask (Pick Winner)?

- **ADMIN / DEPUTY**: أي مهمة فرعية في أي مشروع
- **مكلّف المهمة** (Task assignee): يملك `subtasks.complete` **لمهامه فقط** — يستطيع ترشيح فائز في المهام الفرعية التابعة لمهامه
- **مكلّفو الم.الفرعية** (Subtask assignees): لا يرشحون — **يعلقون فقط**

لهذا نحتاج صلاحية جديدة: `subtasks.complete`

---

### 2.2 Task Status (3 states)

```
[open] ──(auto)──► [in_progress] ──(auto)──► [completed]
```

| Status | Arabic | Meaning |
|--------|--------|---------|
| `open` | مفتوحة | كل المهام الفرعية `open` — لم يبدأ العمل |
| `in_progress` | قيد التنفيذ | على الأقل مهمة فرعية ليست `open` (منفذة/ملغية/مؤجلة) |
| `completed` | مكتملة | كل المهام الفرعية الفعالة `completed` |

#### Automatic Rules

```
active_subtasks = all subtasks where status IN ('open', 'completed')
active_count    = count(active_subtasks)
completed_count = count(active_subtasks WHERE status = 'completed')

if active_count > 0 AND completed_count === active_count:
    task.status = 'completed'
elif active_count > 0 AND completed_count > 0:
    task.status = 'in_progress'
elif active_count > 0:
    task.status = 'open'        // all are 'open'
else:
    // all cancelled/deferred — treat as completed or keep open?
    task.status = 'completed'   // nothing active to do
```

> **مهم**: `cancelled` و `deferred` لا تحتسبان في الإكمال. فقط `open` و `completed` تُحتسبان.

No manual status changes for tasks — fully automatic.

---

### 2.3 Project Status (3 states)

```
[active] ──(auto)──► [completed]
```

| Status | Arabic | Meaning |
|--------|--------|---------|
| `active` | نشط | المشروع قائم |
| `completed` | مكتمل | كل المهام `completed` |

#### Automatic Rule

```
if ALL tasks are 'completed':
    project.status = 'completed'
else:
    project.status = 'active'
```

#### Archive (optional — can be added later)

Projects could also have `archived` status if needed, but the current model doesn't require it. A completed project stays visible.

---

## 3. Auto-Propagation Chain

```
Subtask: completed (فاز تعليق)
         │
         ▼
  1. Mark subtask as completed
  2. Pick winning comment (mark it as winner)
         │
         ▼
  3. Recalculate task status
     ├─ DB: UPDATE tasks SET status = ?
     ├─ Socket: list:update { type: 'task', data: { id, status, active_count, completed_count } }
         │
         ▼
  4. Recalculate project status
     ├─ DB: UPDATE projects SET status = ?
     ├─ Socket: list:update { type: 'project', data: { id, status } }
         │
         ▼
  5. Socket: subtask:updated { id, status, winner_comment_id }
```

---

## 4. Permission Matrix

### 4.1 All Permissions

| Permission Key | Arabic | ADMIN | DEPUTY | EMPLOYEE |
|---------------|--------|-------|--------|----------|
| `projects.view` | عرض المشاريع | ✓ | ✓ | ✓ |
| `projects.create` | إنشاء المشاريع | ✓ | ✓ | ✗ |
| `projects.edit` | تعديل المشاريع | ✓ | ✓ | ✗ |
| `projects.delete` | حذف المشاريع | ✓ | ✗ | ✗ |
| `projects.archive` | أرشفة المشاريع | ✓ | ✗ | ✗ |
| `projects.assign` | تكليف أعضاء المشروع | ✓ | ✓ | ✗ |
| `tasks.view` | عرض المهام | ✓ | ✓ | ✓ |
| `tasks.create` | إنشاء المهام | ✓ | ✓ | ✗* |
| `tasks.edit` | تعديل المهام | ✓ | ✓ | ✗* |
| `tasks.delete` | حذف المهام | ✓ | ✓ | ✗ |
| `tasks.assign` | تكليف مسؤولي المهام | ✓ | ✓ | ✗ |
| `subtasks.view` | عرض المهام الفرعية | ✓ | ✓ | ✓ |
| `subtasks.create` | إنشاء المهام الفرعية | ✓ | ✓ | ✓ |
| `subtasks.edit` | تعديل المهام الفرعية | ✓ | ✓ | ✗ |
| `subtasks.delete` | حذف المهام الفرعية | ✓ | ✓ | ✗ |
| `subtasks.assign` | تعيين مكلفي الم.الفرعية | ✓ | ✓ | ✗ |
| `subtasks.complete` | ترشيح فائز في م.فرعية | ✓ | ✓ | ✗** |
| `subtasks.cancel` | إلغاء مهمة فرعية | ✓ | ✓ | ✗ |
| `subtasks.defer` | تأجيل مهمة فرعية | ✓ | ✓ | ✗ |
| `comments.create` | إضافة تعليقات | ✓ | ✓ | ✓ |
| `users.*` | إدارة المستخدمين | ✓ | ✗ | ✗ |
| `roles.*` | إدارة الأدوار | ✓ | ✗ | ✗ |
| `analytics.view` | عرض التقارير | ✓ | ✓ | ✗ |

> **\*** EMPLOYEE gets `tasks.create` and `tasks.edit` **if and only if** they are a project member. This is the key gating mechanism: project membership grants task creation permission.
>
> **\*\*** EMPLOYEE can get `subtasks.complete` **if they are a task assignee** (they can pick winners for subtasks within their assigned task). This is a per-task grant, not a global permission.

### 4.2 Permission Categories

```
التكليف (Assignment):
    projects.assign       →  Add/remove project members
    tasks.assign          →  Add/remove task assignees
    subtasks.assign       →  Add/remove subtask commenters

الإنشاء (Creation):
    tasks.create          →  Create tasks (requires project membership for EMPLOYEE)
    subtasks.create       →  Create subtasks

التنفيذ (Execution by Comment):
    comments.create        →  Comment on subtasks (text/images/links)

الترشيح (Winner Selection):
    subtasks.complete      →  Pick a winning comment → mark subtask completed

الإدارة (Admin):
    subtasks.cancel        →  Cancel a subtask
    subtasks.defer         →  Defer a subtask
```

---

## 5. Assignee Filter Rules

### 5.1 Project Member Picker

من يظهر في قائمة إضافة أعضاء المشروع؟

```
IF user.role_id !== EMPLOYEE  →  HIDE
IF user already a member       →  HIDE
IF !user.has('tasks.create')  →  HIDE
OTHERWISE  →  SHOW
```

**التبرير**: عضو المشروع يحتاج صلاحية إنشاء المهام ليكون فعالاً في المشروع. كل EMPLOYEE يملك `tasks.create` عبر كونه عضو مشروع (الصلاحية تُمنح عند التكليف). لكننا نفحصها هنا للتأكد.

### 5.2 Task Assignee Picker

من يظهر في قائمة تكليف مسؤولي المهمة؟

```
IF user.role_id !== EMPLOYEE  →  HIDE
IF user already assigned      →  HIDE
IF !user.has('subtasks.create')  →  HIDE
OTHERWISE  →  SHOW
```

**التبرير**: مسؤول المهمة يحتاج صلاحية إنشاء مهام فرعية داخل المهمة.

### 5.3 Subtask Commenter Picker

من يظهر في قائمة تكليف الم.الفرعية (للمشاركة بالتعليقات)؟

```
IF user.role_id !== EMPLOYEE  →  HIDE
IF user already assigned      →  HIDE
IF !user.has('comments.create')  →  HIDE
OTHERWISE  →  SHOW
```

**التبرير**: المكلف بالمهمة الفرعية يشارك عبر التعليقات فقط (نصوص/صور/روابط).

---

## 6. The Comment-as-Execution Model

### 6.1 How Subtask Completion Works

1. **Open**: Subtask is created, assignees receive notification
2. **Commenting**: Assignees post comments with text, images, links
3. **Selection**: Someone with `subtasks.complete` permission marks a specific comment as **الفائز (Winner)**
4. **Notification**: All subtask participants are notified of the winner
5. **Auto-propagation**: Subtask → Task → Project statuses recalculated

### 6.2 DB Schema for Comments (updated)

```typescript
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  subtaskId: integer('subtask_id').references(() => subtasks.id),
  userId: integer('user_id').references(() => users.id),
  content: text('content').notNull(),          // text content
  isWinner: integer('is_winner').default(0),   // 1 = winning comment
  winnerSelectedAt: timestamp('winner_selected_at'),
  winnerSelectedBy: integer('winner_selected_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
})
```

### 6.3 The Winner Selection UI

- A "Select as Winner" button/star icon next to each comment
- Visible only to users with `subtasks.complete` **for this subtask**
- Once selected:
  - `comments.is_winner = 1` for the selected comment
  - `subtasks.status = 'completed'`
  - Auto-propagate up

---

## 7. Real-Time Event System

### 7.1 Events

| Event | Payload | Trigger |
|-------|---------|---------|
| `list:update` | `{ type, action, data }` | Any CRUD |
| `subtask:updated` | `{ id, status, winner_comment_id }` | Subtask completed |
| `notification` | `{ id, type, title, message, related }` | New notification |

### 7.2 Enriched Payloads

Task update (from subtask completion):
```json
{
  "type": "task",
  "action": "updated",
  "data": {
    "id": 42,
    "status": "in_progress",
    "active_count": 5,
    "completed_count": 2
  }
}
```

---

## 8. Notification Triggers

| Event | Type | Target | Message |
|-------|------|--------|---------|
| New comment | `comment` | Task/subtask assignees | "... علّق على ..." |
| Winner selected | `subtask_completed` | All participants | "... رشّح تعليقاً فائزاً في ..." |
| Task completed | `task_completed` | Project members | اكتملت مهمة "..." |
| Project completed | `project_completed` | All users | اكتمل مشروع "..." 🎉 |

---

## 9. DB Schema Changes

### 9.1 subtasks table

```sql
CHECK (status IN ('open', 'completed', 'cancelled', 'deferred'))
```

Remove old columns: `submission_text`, `submission_link`, `manager_notes`
Keep: `assigned_to` (المسؤول الرئيسي), `assigned_to_name`, `assigned_to_avatar`
Add: `winner_comment_id` (nullable, references comments.id)

### 9.2 tasks table

```sql
CHECK (status IN ('active', 'open', 'in_progress', 'completed'))
```

### 9.3 projects table

```sql
CHECK (status IN ('active', 'completed'))
```

### 9.4 comments table

Add columns:
- `is_winner: integer default 0`
- `winner_selected_at: timestamp`
- `winner_selected_by: integer (FK -> users.id)`

### 9.5 Seed data

Add permissions:
```typescript
['subtasks.complete', 'ترشيح فائز في مهمة فرعية', 'المهام الفرعية', 5],
['subtasks.cancel', 'إلغاء مهمة فرعية', 'المهام الفرعية', 8],
['subtasks.defer', 'تأجيل مهمة فرعية', 'المهام الفرعية', 9],
```

EMPLOYEE permissions (seed):
```typescript
const employeeOnly = [
  'projects.view', 'tasks.view', 'subtasks.view',
  'tasks.create', 'tasks.edit',          // gated by isProjectManager()
  'subtasks.create',
  'comments.create',
]
```

---

## 10. Route Changes

### 10.1 `PUT /subtasks/:id` — Open to Task Assignees

**Current**: `authorize(ROLES.ADMIN, ROLES.DEPUTY)`

**Updated**:
- ADMIN/DEPUTY: full access
- Task assignee (`tasks.assignees` contains user): can complete (pick winner), cancel, defer
- Anyone else: blocked

### 10.2 `POST /comments` — Allow EMPLOYEEs

- Already open to EMPLOYEEs via `authorizePermission('comments.create')`

### 10.3 New: `POST /comments/:id/select-winner`

New endpoint:
```
POST /comments/:id/select-winner
```
- Validates `subtasks.complete` permission
- Validates caller is task assignee or ADMIN/DEPUTY
- Sets `is_winner = 1` on comment
- Sets `subtask.status = 'completed'`
- Triggers auto-propagation

---

## 11. Summary of Files to Change

| File | Change |
|------|--------|
| `shared/types.ts` | New status types, comment winner fields |
| `server/src/db/schema.ts` | Subtask CHECK, tasks CHECK, comments columns |
| `server/src/seed.ts` | Permissions + employeeOnly list |
| `server/src/services/SubtaskService.ts` | Remove old workflow, add winner selection logic |
| `server/src/services/CommentService.ts` | Add `selectWinner()` method |
| `server/src/routes/subtasks.ts` | Open PUT for task assignees |
| `server/src/routes/comments.ts` | Add `POST /comments/:id/select-winner` |
| `client/src/components/SubtaskRow.tsx` | Remove old buttons, add winner selection UI |
| `client/src/components/SubtaskCard.tsx` | New status badges |
| `client/src/components/TaskCard.tsx` | Status badge, counts |
| `client/src/components/ProjectCard.tsx` | Status badge |
| `client/src/components/KanbanBoard.tsx` | Filter/display logic |
| `client/src/pages/SubtaskPage.tsx` | Winner selection UI |
| `server/src/__tests__/helpers.ts` | Update test seed |
