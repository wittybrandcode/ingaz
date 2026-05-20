# خطة التنفيذ — نظام المهام بالتعليقات

> مرجع: `docs/SYSTEM-DESIGN.md` للتفاصيل الكاملة

---

## المرحلة 1: قاعدة البيانات + التهيئة

### 1.1 `shared/types.ts`

**Subtask**: تغيير الحالات
```typescript
export interface Subtask {
  // ...
  status: 'open' | 'completed' | 'cancelled' | 'deferred'
  // إزالة: assigned_to, assigned_to_name, assigned_to_avatar,
  //        submission_text, submission_link, manager_notes
  // إضافة:
  winner_comment_id?: number | null
  assignees?: Assignee[]
}
```

**Task**: إضافة حالات
```typescript
export interface Task {
  // ...
  status: 'active' | 'open' | 'in_progress' | 'completed'
  assignees?: Assignee[]
}
```

**Project**: إضافة `completed`
```typescript
export interface Project {
  // ...
  status: 'active' | 'completed'
}
```

**Comment**: إضافة حقول الفائز
```typescript
export interface Comment {
  // ...
  is_winner?: number
  winner_selected_at?: string
  winner_selected_by?: number
}
```

### 1.2 `server/src/db/schema.ts`

**subtasks**: تحديث CHECK constraint
```typescript
check('subtasks_status_check',
  sql`${table.status} IN ('open', 'completed', 'cancelled', 'deferred')`)
```

إزالة الأعمدة القديمة: `submissionText`, `submissionLink`, `managerNotes`
إضافة: `winnerCommentId: integer('winner_comment_id')`

**tasks**: تحديث CHECK
```typescript
check('tasks_status_check',
  sql`${table.status} IN ('active', 'open', 'in_progress', 'completed')`)
```

**projects**: تحديث CHECK
```typescript
check('projects_status_check',
  sql`${table.status} IN ('active', 'completed')`)
```

**comments**: إضافة أعمدة
```typescript
isWinner: integer('is_winner').default(0),
winnerSelectedAt: timestamp('winner_selected_at'),
winnerSelectedBy: integer('winner_selected_by').references(() => users.id),
```

### 1.3 `server/src/seed.ts`

إضافة صلاحيات جديدة:
```typescript
['subtasks.complete', 'ترشيح فائز في مهمة فرعية', 'المهام الفرعية', 5],
['subtasks.cancel', 'إلغاء مهمة فرعية', 'المهام الفرعية', 8],
['subtasks.defer', 'تأجيل مهمة فرعية', 'المهام الفرعية', 9],
```

تحديث `employeeOnly`:
```typescript
const employeeOnly = [
  'projects.view', 'tasks.view', 'subtasks.view',
  'tasks.create', 'tasks.edit',
  'subtasks.create',
  'comments.create',
]
```

إزالة صلاحيات قديمة من seed: `subtasks.start`, `subtasks.submit`, `subtasks.reset`, `subtasks.approve`

**تحقق**: `cd server && npm run typecheck`

---

## المرحلة 2: Service Layer — المنطق الجديد

### 2.1 `server/src/services/SubtaskService.ts`

#### إزالة كل الكود القديم:
- `submission_text`, `submission_link`, `manager_notes` handling
- Old status transitions (`pending→in_progress→submitted→approved/rejected`)
- `assignedTo` auto-set/remove logic

#### إضافة دوال مساعدة:
```typescript
private async getTaskCounts(taskId: number) {
  const [row] = await this.db
    .select({
      activeCount: sql`COUNT(CASE WHEN status IN ('open', 'completed') THEN 1 END)`,
      completedCount: sql`COUNT(CASE WHEN status = 'completed' THEN 1 END)`,
    })
    .from(schema.subtasks)
    .where(eq(schema.subtasks.taskId, taskId))
  return {
    active_count: Number(row?.activeCount || 0),
    completed_count: Number(row?.completedCount || 0),
  }
}

private async calculateTaskStatus(taskId: number): Promise<string> {
  const counts = await this.getTaskCounts(taskId)
  if (counts.active_count === 0) return 'completed'  // all cancelled/deferred
  if (counts.active_count === counts.completed_count) return 'completed'
  if (counts.completed_count > 0) return 'in_progress'
  return 'open'
}

private async calculateProjectStatus(projectId: number): Promise<string> {
  const tasks = await this.db
    .select({ status: schema.tasks.status })
    .from(schema.tasks)
    .where(eq(schema.tasks.projectId, projectId))
  if (tasks.every(t => t.status === 'completed')) return 'completed'
  return 'active'
}
```

#### تحديث `update()`:
- التحقق من صحة الـ transitions
- السماح للـ task assignee بتغيير الحالة
- عند `completed`: التحقق من وجود `winner_comment_id`
- استدعاء auto-propagation

```typescript
async update(id: number, data, ctx: ServiceContext) {
  // 1. Get old subtask
  // 2. Validate transitions
  const VALID_TRANSITIONS = {
    open:      ['completed', 'cancelled', 'deferred'],
    completed: [],  // terminal
    cancelled: ['open'],
    deferred:  ['open'],
  }
  // 3. Validate permissions for status change
  if (data.status) {
    if (data.status === 'completed' && !ctx.roleId === ROLES.ADMIN) {
      // check if user is task assignee (has subtasks.complete via task membership)
    }
    // ...
  }
  // 4. Apply update
  // 5. Auto-propagate to task and project
  // 6. Emit enriched socket events
}
```

### 2.2 `server/src/services/CommentService.ts`

إضافة `selectWinner()`:
```typescript
async selectWinner(commentId: number, ctx: ServiceContext) {
  // 1. Get comment, verify it exists
  // 2. Get subtask, verify it's 'open'
  // 3. Verify caller has subtasks.complete for this subtask
  //    (ADMIN/DEPUTY always, or task assignee)
  // 4. Mark comment as winner: is_winner = 1, winner_selected_at, winner_selected_by
  // 5. Update subtask: status = 'completed', winner_comment_id = commentId
  // 6. Auto-propagate: subtask → task → project
  // 7. Socket events
  // 8. Notifications
}
```

### 2.3 `server/src/services/TaskService.ts`

تحديث دوال حساب الإحصائيات:
- استخدام `active_count` و `completed_count` بدلاً من `subtasks_count` و `approved_count`

---

## المرحلة 3: Routes

### 3.1 `server/src/routes/subtasks.ts`

`PUT /:id` — فتح للـ task assignees:
```typescript
router.put('/:id', authenticate, checkFrozen, tryCatch(async (req, res) => {
  // Authorization handled in service layer
  const result = await subtaskService.update(Number(req.params.id), req.body, ctx(req))
  res.success(result)
}))
```

إزالة `authorize(ROLES.ADMIN, ROLES.DEPUTY)` — التحقق ينتقل للـ service.

### 3.2 `server/src/routes/comments.ts`

إضافة:
```typescript
router.post('/:id/select-winner', authenticate, tryCatch(async (req, res) => {
  const result = await commentService.selectWinner(Number(req.params.id), ctx(req))
  res.success(result)
}))
```

---

## المرحلة 4: واجهة المستخدم

### 4.1 Subtask — إزالة الأزرار القديمة

إزالة من `SubtaskRow.tsx` و `SubtaskPage.tsx`:
- زر "بدء" (Play)
- زر "تسليم" (Send)
- زر "قبول/رفض" (CheckCircle/XCircle)
- زر "إعادة للحالة الأولى" (Rotate)

### 4.2 Subtask — إضافة واجهة التعليقات

- إظهار التعليقات تحت المهمة الفرعية
- زر "ترشيح كفائز" بجانب كل تعليق (لمن لديه `subtasks.complete`)
- أيقونة نجمة/كأس على التعليق الفائز

### 4.3 Subtask — إضافة أزرار الحالة الجديدة

- زر "إلغاء" (للمدير/مسؤول المهمة)
- زر "تأجيل" (للمدير/مسؤول المهمة)
- إظهار badge الحالة: مفتوحة/منفذة/ملغية/مؤجلة

### 4.4 TaskCard + ProjectCard

- إضافة badge حالة: `open` (رمادي)، `in_progress` (عنبر)، `completed` (أخضر)
- تحديث ProgressBar: `active_count` + `completed_count` بدلاً من `subtasks_count` + `approved_count`

### 4.5 KanbanBoard

- تحديث socket handler لاستقبال `active_count` و `completed_count`
- تصفية subtasks: إخفاء `cancelled` و `deferred` اختيارياً

### 4.6 AssigneePicker فلاتر (تحديث)

تطابق SYSTEM-DESIGN.md القسم 5:
- **أعضاء المشروع**: `role_id === EMPLOYEE` + `tasks.create`
- **مكلفي المهمة**: `role_id === EMPLOYEE` + `subtasks.create`
- **مكلفي الم.الفرعية**: `role_id === EMPLOYEE` + `comments.create`

---

## المرحلة 5: التنظيف والاختبارات

### 5.1 `server/src/__tests__/helpers.ts`

تحديث:
- إزالة صلاحيات `subtasks.start`/`submit`/`reset`/`approve` من test seed
- إضافة `subtasks.complete`/`cancel`/`defer` للـ ADMIN/DEPUTY
- إزالة `tasks.create` من EMPLOYEE في test seed (أو إبقائها حسب الحاجة)

### 5.2 التحقق

```bash
cd server && npm run typecheck
cd client && npm run typecheck
cd server && npm run test
```

---

## ملخص التغييرات

| # | الملف | التغيير |
|---|-------|---------|
| 1 | `shared/types.ts` | Subtask حالات جديدة، Comment حقول فائز |
| 2 | `server/src/db/schema.ts` | CHECK constraints + أعمدة comments |
| 3 | `server/src/seed.ts` | صلاحيات جديدة + employeeOnly |
| 4 | `server/src/services/SubtaskService.ts` | إعادة كتابة — remove old workflow + winner logic |
| 5 | `server/src/services/CommentService.ts` | إضافة `selectWinner()` |
| 6 | `server/src/services/TaskService.ts` | تحديث الإحصائيات |
| 7 | `server/src/routes/subtasks.ts` | فتح PUT للـ task assignees |
| 8 | `server/src/routes/comments.ts` | إضافة POST /:id/select-winner |
| 9 | `client/src/components/SubtaskRow.tsx` | إزالة أزرار قديمة + إضافة واجهة فائز |
| 10 | `client/src/components/SubtaskCard.tsx` | Badges جديدة |
| 11 | `client/src/components/TaskCard.tsx` | Badge الحالة |
| 12 | `client/src/components/ProjectCard.tsx` | Badge الحالة |
| 13 | `client/src/components/KanbanBoard.tsx` | Socket handler + فلترة |
| 14 | `client/src/pages/SubtaskPage.tsx` | Winner selection UI |
| 15 | `client/src/pages/ProjectDetail.tsx` | تحديث socket handler |
| 16 | `client/src/components/ProjectDetail/SubtaskPanel.tsx` | فلاتر assignee |
| 17 | `client/src/components/TaskSettingsModal.tsx` | فلاتر assignee |
| 18 | `client/src/components/ProjectSettingsModal.tsx` | فلاتر assignee |
| 19 | `server/src/__tests__/helpers.ts` | تحديث test seed |

---

## أسئلة قبل التنفيذ

## ✅ القرارات النهائية

| السؤال | القرار |
|--------|--------|
| من يملك `subtasks.complete`؟ | ADMIN + DEPUTY + **مكلّف المهمة** (لمهامه فقط) |
| `assigned_to` في subtasks؟ | يُبقی — المسؤول الرئيسي. `assignees` مكلفون إضافيون للتعليق |
| `tasks.create/edit` للـ EMPLOYEE؟ | تُضاف للـ seed + gated بـ `isProjectManager()` في السيرفر |
| `cancelled` ← `open`؟ | **لا** — cancelled نهائي. فقط `deferred` ← `open` |
| `archived` للمشاريع؟ | نعم — `completed` تلقائي + `archived` يدوي (للمدير فقط) |

