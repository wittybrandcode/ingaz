import sanitizeHtml from 'sanitize-html'
import path from 'path'
import fs from 'fs'
import { eq, and, count, sql, inArray } from 'drizzle-orm'
import { ROLES, PAGINATION } from '../constants.js'
import { BaseService, AppError } from './BaseService.js'
import type { ServiceContext } from './BaseService.js'
import { schema, addActivityLog, isProjectManager, getSubtaskAssignees, getBulkSubtaskAssignees, isSubtaskAssignee } from '../db/index.js'
import { notifyAll, notifyUser } from '../notify.js'
import { hasPermission } from '../middleware/auth.js'
import { camelToSnake } from '../lib/case-transform.js'

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['completed', 'cancelled', 'deferred'],
  completed: [],
  cancelled: [],
  deferred: ['open'],
}

export class SubtaskService extends BaseService {
  private async getTaskCounts(taskId: number, tx: any = this.db) {
    const [row] = await tx
      .select({
        activeCount: sql`COUNT(CASE WHEN ${schema.subtasks.status} IN ('open', 'completed') THEN 1 END)`,
        completedCount: sql`COUNT(CASE WHEN ${schema.subtasks.status} = 'completed' THEN 1 END)`,
      })
      .from(schema.subtasks)
      .where(eq(schema.subtasks.taskId, taskId))
    return {
      active_count: Number(row?.activeCount || 0),
      completed_count: Number(row?.completedCount || 0),
    }
  }

  private async calculateTaskStatus(taskId: number, tx: any = this.db): Promise<string> {
    const counts = await this.getTaskCounts(taskId, tx)
    if (counts.active_count === 0) return 'completed'
    if (counts.active_count === counts.completed_count) return 'completed'
    if (counts.completed_count > 0) return 'in_progress'
    return 'open'
  }

  private async updateTaskStatus(taskId: number, ctx: ServiceContext, tx: any = this.db) {
    const newStatus = await this.calculateTaskStatus(taskId, tx)
    const [task] = await tx
      .select({ status: schema.tasks.status })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId))
      .limit(1)
    if (task && task.status !== newStatus) {
      await tx.update(schema.tasks).set({ status: newStatus }).where(eq(schema.tasks.id, taskId))
      const counts = await this.getTaskCounts(taskId, tx)
      if (ctx.io) {
        ctx.io.emit('list:update', {
          type: 'task',
          action: 'updated',
          data: { id: taskId, status: newStatus, active_count: counts.active_count, completed_count: counts.completed_count },
        })
      }
    }
    return newStatus
  }

  private async calculateProjectStatus(projectId: number, tx: any = this.db): Promise<string> {
    const tasks = await tx
      .select({ status: schema.tasks.status })
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, projectId))
    if (tasks.length > 0 && tasks.every((t: { status: string }) => t.status === 'completed')) return 'completed'
    return 'active'
  }

  private async updateProjectStatus(projectId: number, ctx: ServiceContext, tx: any = this.db) {
    const newStatus = await this.calculateProjectStatus(projectId, tx)
    const [project] = await tx
      .select({ status: schema.projects.status })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)
    if (project && project.status !== newStatus) {
      await tx.update(schema.projects).set({ status: newStatus }).where(eq(schema.projects.id, projectId))
      if (ctx.io) {
        ctx.io.emit('list:update', {
          type: 'project',
          action: 'updated',
          data: { id: projectId, status: newStatus },
        })
      }
    }
  }

  private async canChangeStatus(subtask: any, userId: number, roleId: number): Promise<boolean> {
    if (roleId === ROLES.ADMIN || roleId === ROLES.DEPUTY) return true
    const isAssignee = await isSubtaskAssignee(subtask.id, userId)
    if (isAssignee) return true
    const [taskAssign] = await this.db
      .select()
      .from(schema.taskAssignees)
      .where(and(eq(schema.taskAssignees.taskId, subtask.taskId), eq(schema.taskAssignees.userId, userId)))
      .limit(1)
    if (taskAssign) return true
    return false
  }

  async list(page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db.select({ count: count() }).from(schema.subtasks)
    const total = totalRow?.count ?? 0

    const subtasks = await this.db
      .select({
        id: schema.subtasks.id,
        taskId: schema.subtasks.taskId,
        title: schema.subtasks.title,
        description: schema.subtasks.description,
        assignedTo: schema.subtasks.assignedTo,
        status: schema.subtasks.status,
        deadline: schema.subtasks.deadline,
        winnerCommentId: schema.subtasks.winnerCommentId,
        createdAt: schema.subtasks.createdAt,
        assignedToName: schema.users.name,
        assignedToAvatar: schema.users.avatar,
      })
      .from(schema.subtasks)
      .leftJoin(schema.users, eq(schema.subtasks.assignedTo, schema.users.id))
      .orderBy(sql`${schema.subtasks.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    const ids = subtasks.map((s: any) => s.id)
    const bulk = await getBulkSubtaskAssignees(ids)
    const withAssignees = subtasks.map((s: any) => ({ ...s, assignees: bulk[s.id] || [] }))
    return { data: withAssignees, total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async listByTask(taskId: number, page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(schema.subtasks)
      .where(eq(schema.subtasks.taskId, taskId))
    const total = totalRow?.count ?? 0

    const subtasks = await this.db
      .select({
        id: schema.subtasks.id,
        taskId: schema.subtasks.taskId,
        title: schema.subtasks.title,
        description: schema.subtasks.description,
        assignedTo: schema.subtasks.assignedTo,
        status: schema.subtasks.status,
        deadline: schema.subtasks.deadline,
        winnerCommentId: schema.subtasks.winnerCommentId,
        createdAt: schema.subtasks.createdAt,
        assignedToName: schema.users.name,
        assignedToAvatar: schema.users.avatar,
      })
      .from(schema.subtasks)
      .leftJoin(schema.users, eq(schema.subtasks.assignedTo, schema.users.id))
      .where(eq(schema.subtasks.taskId, taskId))
      .orderBy(sql`${schema.subtasks.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    const ids = subtasks.map((s: any) => s.id)
    const bulk = await getBulkSubtaskAssignees(ids)
    const withAssignees = subtasks.map((s: any) => ({ ...s, assignees: bulk[s.id] || [] }))
    return { data: withAssignees, total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async getById(id: number) {
    const [subtask] = await this.db
      .select({
        id: schema.subtasks.id,
        taskId: schema.subtasks.taskId,
        title: schema.subtasks.title,
        description: schema.subtasks.description,
        assignedTo: schema.subtasks.assignedTo,
        status: schema.subtasks.status,
        deadline: schema.subtasks.deadline,
        winnerCommentId: schema.subtasks.winnerCommentId,
        createdAt: schema.subtasks.createdAt,
        assignedToName: schema.users.name,
        assignedToAvatar: schema.users.avatar,
      })
      .from(schema.subtasks)
      .leftJoin(schema.users, eq(schema.subtasks.assignedTo, schema.users.id))
      .where(eq(schema.subtasks.id, id))
      .limit(1)
    if (!subtask) throw new AppError(404, 'المهمة الفرعية غير موجودة')

    const [task] = await this.db
      .select({
        id: schema.tasks.id,
        projectId: schema.tasks.projectId,
        title: schema.tasks.title,
        description: schema.tasks.description,
        createdBy: schema.tasks.createdBy,
        status: schema.tasks.status,
        createdAt: schema.tasks.createdAt,
        projectTitle: schema.projects.title,
        project_id: schema.projects.id,
      })
      .from(schema.tasks)
      .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
      .where(eq(schema.tasks.id, subtask.taskId))
      .limit(1)

    const assignees = await getSubtaskAssignees(subtask.id)
    return { ...subtask, task, assignees }
  }

  async create(data: { task_id: number; title: string; description?: string | null; assigned_to?: number | null; deadline?: string | null }, ctx: ServiceContext) {
    if (ctx.roleId === ROLES.EMPLOYEE) {
      const [task] = await this.db
        .select({ projectId: schema.tasks.projectId })
        .from(schema.tasks)
        .where(eq(schema.tasks.id, data.task_id))
        .limit(1)
      if (!task) throw new AppError(404, 'المهمة غير موجودة')
      if (!(await isProjectManager(ctx.userId, task.projectId))) {
        throw new AppError(403, 'لا تملك صلاحية إنشاء مهام فرعية في هذا المشروع')
      }
    }

    if (data.assigned_to && ctx.roleId !== ROLES.ADMIN) {
      if (!(await hasPermission(ctx.roleId, 'subtasks.assign'))) {
        throw new AppError(403, 'لا تملك صلاحية تعيين المهام الفرعية')
      }
    }

    const cleanTitle = sanitizeHtml(data.title, { allowedTags: [], allowedAttributes: {} })
    const cleanDescription = data.description
      ? sanitizeHtml(data.description, {
          allowedTags: ['b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br', 'p'],
          allowedAttributes: { a: ['href', 'target'] },
          allowedSchemes: ['http', 'https', 'mailto'],
        })
      : null

    const [subtask] = await this.db.insert(schema.subtasks).values({
      taskId: data.task_id,
      title: cleanTitle,
      description: cleanDescription,
      assignedTo: data.assigned_to || null,
      deadline: data.deadline || null,
    }).returning()

    await addActivityLog(ctx.userId, 'create_subtask', `أضاف مهمة فرعية "${cleanTitle}"`)

    const [task] = await this.db
      .select({
        title: schema.tasks.title,
        projectTitle: schema.projects.title,
      })
      .from(schema.tasks)
      .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
      .where(eq(schema.tasks.id, data.task_id))
      .limit(1)

    if (ctx.io) {
      if (data.assigned_to) {
        notifyUser({
          userId: data.assigned_to,
          type: 'subtask_assigned',
          title: 'مهمة جديدة مسندة إليك',
          message: `تم إسناد "${data.title}" إليك في مهمة "${task?.title}" بمشروع "${task?.projectTitle}"`,
          relatedType: 'subtask',
          relatedId: subtask.id,
          io: ctx.io,
        })
      } else {
        notifyAll({
          type: 'subtask_created',
          title: 'مهمة فرعية جديدة',
          message: `${ctx.userName} أضاف مهمة فرعية "${data.title}" في مهمة "${task?.title}"`,
          relatedType: 'task',
          relatedId: data.task_id,
          io: ctx.io,
        })
      }
      ctx.io.emit('list:update', { type: 'subtask', action: 'created', data: camelToSnake(subtask) })
    }

    return subtask
  }

  async update(id: number, data: {
    title?: string; description?: string | null; assigned_to?: number | null; deadline?: string | null;
    status?: string
  }, ctx: ServiceContext) {
    const [oldSubtask] = await this.db.select().from(schema.subtasks).where(eq(schema.subtasks.id, id)).limit(1)
    if (!oldSubtask) throw new AppError(404, 'المهمة الفرعية غير موجودة')

    if (data.assigned_to !== undefined && ctx.roleId !== ROLES.ADMIN) {
      if (!(await hasPermission(ctx.roleId, 'subtasks.assign'))) {
        throw new AppError(403, 'لا تملك صلاحية تعيين المهام الفرعية')
      }
    }

    if (data.status) {
      const allowed = VALID_TRANSITIONS[oldSubtask.status]
      if (!allowed || !allowed.includes(data.status)) {
        throw new AppError(400, `لا يمكن تغيير الحالة من "${oldSubtask.status}" إلى "${data.status}"`)
      }
      if (!(await this.canChangeStatus(oldSubtask, ctx.userId, ctx.roleId))) {
        throw new AppError(403, 'لا تملك صلاحية تغيير حالة هذه المهمة الفرعية')
      }
      if (data.status === 'completed' && !oldSubtask.winnerCommentId) {
        throw new AppError(400, 'يجب ترشيح تعليق فائز أولاً')
      }
      if (data.status === 'cancelled' && oldSubtask.status !== 'open') {
        throw new AppError(400, 'يمكن إلغاء المهام المفتوحة فقط')
      }
    }

    const updates: Record<string, any> = {}
    if (data.title) {
      updates.title = sanitizeHtml(data.title, { allowedTags: [], allowedAttributes: {} })
    }
    if (data.description !== undefined) {
      updates.description = data.description
        ? sanitizeHtml(data.description, { allowedTags: ['b', 'i', 'u', 'a', 'ul', 'ol', 'li', 'br', 'p'], allowedAttributes: { a: ['href', 'target'] }, allowedSchemes: ['http', 'https', 'mailto'] })
        : data.description
    }
    if (data.assigned_to !== undefined) updates.assignedTo = data.assigned_to
    if (data.deadline !== undefined) updates.deadline = data.deadline
    if (data.status) updates.status = data.status

    if (Object.keys(updates).length === 0) throw new AppError(400, 'لا توجد حقول للتحديث')

    let subtask: any
    let task: any
    await this.db.transaction(async (tx: any) => {
      await tx.update(schema.subtasks).set(updates).where(eq(schema.subtasks.id, id))

      const [s] = await tx.select().from(schema.subtasks).where(eq(schema.subtasks.id, id)).limit(1)
      subtask = s

      const [t] = await tx
        .select({
          id: schema.tasks.id,
          projectId: schema.tasks.projectId,
          title: schema.tasks.title,
          projectTitle: schema.projects.title,
        })
        .from(schema.tasks)
        .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
        .where(eq(schema.tasks.id, subtask.taskId))
        .limit(1)
      task = t

      if (data.status && data.status !== oldSubtask.status) {
        const logActions: Record<string, string> = {
          completed: 'complete_subtask',
          cancelled: 'cancel_subtask',
          deferred: 'defer_subtask',
        }
        if (logActions[data.status]) {
          const actionName = logActions[data.status] === 'complete_subtask' ? 'أكمل' : logActions[data.status] === 'cancel_subtask' ? 'ألغى' : 'أجل'
          await tx.insert(schema.activityLogs).values({
            userId: ctx.userId,
            action: logActions[data.status],
            details: actionName + ' "' + subtask.title + '"',
          })
        }

        await this.updateTaskStatus(task.id, ctx, tx)
        await this.updateProjectStatus(task.projectId, ctx, tx)
      }

      await tx.insert(schema.activityLogs).values({
        userId: ctx.userId,
        action: 'update_subtask',
        details: `حدّث مهمة فرعية "${subtask.title}"`,
      })
    })

    if (data.status && data.status !== oldSubtask.status) {
      if (data.status === 'cancelled' || data.status === 'deferred' || data.status === 'completed') {
        if (ctx.io) {
          const actionLabel: Record<string, string> = {
            completed: 'أكمل',
            cancelled: 'ألغى',
            deferred: 'أجل',
          }
          const action = actionLabel[data.status] || 'حدّث'
          notifyAll({
            type: 'subtask_updated',
            title: 'تحديث مهمة فرعية',
            message: ctx.userName + ' ' + action + ' "' + subtask.title + '" في مهمة "' + (task?.title || '') + '"',
            relatedType: 'task',
            relatedId: task?.id,
            io: ctx.io,
          })
        }
      }

      if (data.status === 'deferred' && ctx.io) {
        const subtaskAssignees = await getSubtaskAssignees(id)
        for (const a of subtaskAssignees) {
          notifyUser({
            userId: a.userId,
            type: 'subtask_deferred',
            title: 'تم تأجيل المهمة',
            message: `تم تأجيل "${subtask.title}"`,
            relatedType: 'subtask',
            relatedId: subtask.id,
            io: ctx.io,
          })
        }
      }

      if (data.status === 'open' && oldSubtask.status === 'deferred' && ctx.io) {
        const subtaskAssignees = await getSubtaskAssignees(id)
        for (const a of subtaskAssignees) {
          notifyUser({
            userId: a.userId,
            type: 'subtask_reactivated',
            title: 'تم إعادة فتح المهمة',
            message: `تم إعادة فتح "${subtask.title}"`,
            relatedType: 'subtask',
            relatedId: subtask.id,
            io: ctx.io,
          })
        }
      }

      if (ctx.io) {
        ctx.io.emit('subtask:updated', { id: Number(id), status: subtask.status, winner_comment_id: subtask.winnerCommentId })
      }
    }

    if (data.assigned_to !== undefined && data.assigned_to !== oldSubtask?.assignedTo) {
      if (ctx.io) {
        if (data.assigned_to) {
          notifyUser({
            userId: data.assigned_to, type: 'subtask_assigned', title: 'تم إسناد مهمة إليك',
            message: `تم إسناد "${subtask.title}" إليك`,
            relatedType: 'subtask', relatedId: subtask.id, io: ctx.io,
          })
        }
        if (oldSubtask?.assignedTo) {
          notifyUser({
            userId: oldSubtask.assignedTo, type: 'assignment_changed', title: 'تم تغيير المسؤول عن المهمة',
            message: `تم نقل "${subtask.title}" من "${ctx.userName}" إلى مستخدم آخر`,
            relatedType: 'subtask', relatedId: subtask.id, io: ctx.io,
          })
        }
      }
    }

    return subtask
  }

  async delete(id: number, ctx: ServiceContext) {
    const [old] = await this.db
      .select({ title: schema.subtasks.title, taskId: schema.subtasks.taskId })
      .from(schema.subtasks)
      .where(eq(schema.subtasks.id, id))
      .limit(1)

    const orphaned = await this.db
      .select()
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.entityType, 'subtask'),
          eq(schema.attachments.entityId, id),
        )
      )
    for (const a of orphaned) {
      const fp = path.join(process.cwd(), 'uploads', a.filename)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    }
    await this.db.transaction(async (tx: any) => {
      await tx
        .delete(schema.attachments)
        .where(
          and(
            eq(schema.attachments.entityType, 'subtask'),
            eq(schema.attachments.entityId, id),
          )
        )

      await tx.insert(schema.activityLogs).values({
        userId: ctx.userId,
        action: 'delete_subtask',
        details: `حذف مهمة فرعية "${old?.title}"`,
      })

      await tx.delete(schema.subtasks).where(eq(schema.subtasks.id, id))

      if (old) {
        await this.updateTaskStatus(old.taskId, ctx, tx)
        const [task] = await tx
          .select({ projectId: schema.tasks.projectId })
          .from(schema.tasks)
          .where(eq(schema.tasks.id, old.taskId))
          .limit(1)
        if (task) await this.updateProjectStatus(task.projectId, ctx, tx)
      }
    })

    if (ctx.io) ctx.io.emit('list:update', { type: 'subtask', action: 'deleted', data: { id: Number(id) } })

    return { message: 'تم حذف المهمة الفرعية' }
  }

  getAssignees(subtaskId: number) {
    return getSubtaskAssignees(subtaskId)
  }

  async addAssignee(subtaskId: number, userId: number, ctx: ServiceContext) {
    try {
      const [userRow] = await this.db
        .select({ roleId: schema.users.roleId })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1)
      if (!userRow) throw new AppError(404, 'المستخدم غير موجود')
      if (userRow.roleId !== ROLES.EMPLOYEE) throw new AppError(400, 'يمكن تكليف المستخدمين بصلاحية موظف فقط')

      let assignee: any
      let subtask: any
      await this.db.transaction(async (tx: any) => {
        const [a] = await tx.insert(schema.subtaskAssignees).values({
          subtaskId,
          userId,
          assignedBy: ctx.userId,
        }).returning()
        assignee = a

        const [s] = await tx
          .select({ assignedTo: schema.subtasks.assignedTo, title: schema.subtasks.title })
          .from(schema.subtasks)
          .where(eq(schema.subtasks.id, subtaskId))
          .limit(1)
        subtask = s

        if (subtask && !subtask.assignedTo) {
          await tx.update(schema.subtasks).set({ assignedTo: userId }).where(eq(schema.subtasks.id, subtaskId))
        }
      })

      const [enriched] = await this.db
        .select({
          id: schema.subtaskAssignees.id,
          subtaskId: schema.subtaskAssignees.subtaskId,
          userId: schema.subtaskAssignees.userId,
          assignedBy: schema.subtaskAssignees.assignedBy,
          createdAt: schema.subtaskAssignees.createdAt,
          name: schema.users.name,
          email: schema.users.email,
          avatar: schema.users.avatar,
          roleId: schema.users.roleId,
          roleName: schema.roles.name,
        })
        .from(schema.subtaskAssignees)
        .innerJoin(schema.users, eq(schema.subtaskAssignees.userId, schema.users.id))
        .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
        .where(eq(schema.subtaskAssignees.id, assignee.id))
        .limit(1)

      const [task] = await this.db
        .select({
          taskTitle: schema.tasks.title,
          projectTitle: schema.projects.title,
        })
        .from(schema.tasks)
        .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
        .where(eq(schema.tasks.id, sql`(SELECT task_id FROM subtasks WHERE id = ${subtaskId})`))
        .limit(1)

      if (ctx.io) {
        notifyUser({
          userId, type: 'subtask_assigned', title: 'تم تكليفك في مهمة فرعية',
          message: `تم تكليفك في "${subtask?.title}" ضمن مهمة "${task?.taskTitle}" في "${task?.projectTitle}"`,
          relatedType: 'subtask', relatedId: subtaskId, io: ctx.io,
        })
        ctx.io.emit('list:update', { type: 'subtask', action: 'updated', data: { id: subtaskId } })
      }

      return enriched
    } catch (e: any) {
      if (e.code === '23505') throw new AppError(409, 'المستخدم مضاف مسبقاً')
      throw e
    }
  }

  async removeAssignee(subtaskId: number, userId: number, ctx: ServiceContext) {
    const [subtask] = await this.db
      .select({ assignedTo: schema.subtasks.assignedTo, title: schema.subtasks.title })
      .from(schema.subtasks)
      .where(eq(schema.subtasks.id, subtaskId))
      .limit(1)

    await this.db.transaction(async (tx: any) => {
      const result = await tx
        .delete(schema.subtaskAssignees)
        .where(
          and(
            eq(schema.subtaskAssignees.subtaskId, subtaskId),
            eq(schema.subtaskAssignees.userId, userId),
          )
        )
      if (result.length === 0) throw new AppError(404, 'المكلف غير موجود')

      if (subtask && subtask.assignedTo === userId) {
        const [remaining] = await tx
          .select({ userId: schema.subtaskAssignees.userId })
          .from(schema.subtaskAssignees)
          .where(eq(schema.subtaskAssignees.subtaskId, subtaskId))
          .orderBy(schema.subtaskAssignees.createdAt)
          .limit(1)
        await tx.update(schema.subtasks).set({ assignedTo: remaining?.userId || null }).where(eq(schema.subtasks.id, subtaskId))
      }
    })

    if (ctx.io) {
      notifyUser({
        userId, type: 'assignment_changed', title: 'تم إلغاء تكليفك',
        message: `تم إلغاء تكليفك من "${subtask?.title}"`,
        relatedType: 'subtask', relatedId: subtaskId, io: ctx.io,
      })
      ctx.io.emit('list:update', { type: 'subtask', action: 'updated', data: { id: subtaskId } })
    }
    return { message: 'تم إزالة المكلف' }
  }
}
