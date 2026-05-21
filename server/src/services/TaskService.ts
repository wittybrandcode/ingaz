import sanitizeHtml from 'sanitize-html'
import { eq, and, count, sql, inArray } from 'drizzle-orm'
import { ROLES, PAGINATION } from '../constants.js'
import { BaseService, AppError } from './BaseService.js'
import type { ServiceContext } from './BaseService.js'
import { schema, addActivityLog, getDb, isProjectManager, getTaskAssignees } from '../db/index.js'
import { notifyUser } from '../notify.js'
import { NotificationService } from './NotificationService.js'
const notifService = new NotificationService(getDb())
import { camelToSnake } from '../lib/case-transform.js'

export class TaskService extends BaseService {
  async list(page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(schema.tasks)
      .where(sql`${schema.tasks.status} != 'archived'`)
    const total = totalRow?.count ?? 0

    const tasks = await this.db
      .select({
        id: schema.tasks.id,
        projectId: schema.tasks.projectId,
        title: schema.tasks.title,
        description: schema.tasks.description,
        createdBy: schema.tasks.createdBy,
        status: schema.tasks.status,
        createdAt: schema.tasks.createdAt,
        createdByName: schema.users.name,
        createdByAvatar: schema.users.avatar,
        subtasksCount: sql`(SELECT COUNT(*) FROM subtasks WHERE task_id = ${schema.tasks.id})`,
        completedCount: sql`(SELECT COUNT(*) FROM subtasks WHERE task_id = ${schema.tasks.id} AND status = 'completed')`,
      })
      .from(schema.tasks)
      .innerJoin(schema.users, eq(schema.tasks.createdBy, schema.users.id))
      .where(sql`${schema.tasks.status} != 'archived'`)
      .orderBy(sql`${schema.tasks.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    const taskIds = tasks.map((t: any) => t.id)
    const assigneeRows = taskIds.length > 0 ? await this.db
      .select({
        taskId: schema.taskAssignees.taskId,
        name: schema.users.name,
        avatar: schema.users.avatar,
      })
      .from(schema.taskAssignees)
      .innerJoin(schema.users, eq(schema.taskAssignees.userId, schema.users.id))
      .where(inArray(schema.taskAssignees.taskId, taskIds)) : []

    const assigneesByTask: Record<number, { name: string; avatar: string | null }[]> = {}
    for (const a of assigneeRows) {
      if (!assigneesByTask[a.taskId]) assigneesByTask[a.taskId] = []
      assigneesByTask[a.taskId].push({ name: a.name, avatar: a.avatar })
    }

    const enriched = tasks.map((t: any) => ({ ...t, assignees: assigneesByTask[t.id] || [] }))

    return { data: enriched, total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async listByProject(projectId: number, page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.projectId, projectId),
          sql`${schema.tasks.status} != 'archived'`,
        )
      )
    const total = totalRow?.count ?? 0

    const tasks = await this.db
      .select({
        id: schema.tasks.id,
        projectId: schema.tasks.projectId,
        title: schema.tasks.title,
        description: schema.tasks.description,
        createdBy: schema.tasks.createdBy,
        status: schema.tasks.status,
        createdAt: schema.tasks.createdAt,
        createdByName: schema.users.name,
        createdByAvatar: schema.users.avatar,
        subtasksCount: sql`(SELECT COUNT(*) FROM subtasks WHERE task_id = ${schema.tasks.id})`,
        completedCount: sql`(SELECT COUNT(*) FROM subtasks WHERE task_id = ${schema.tasks.id} AND status = 'completed')`,
      })
      .from(schema.tasks)
      .innerJoin(schema.users, eq(schema.tasks.createdBy, schema.users.id))
      .where(
        and(
          eq(schema.tasks.projectId, projectId),
          sql`${schema.tasks.status} != 'archived'`,
        )
      )
      .orderBy(sql`${schema.tasks.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    const taskIds = tasks.map((t: any) => t.id)
    const assigneeRows = taskIds.length > 0 ? await this.db
      .select({
        taskId: schema.taskAssignees.taskId,
        name: schema.users.name,
        avatar: schema.users.avatar,
      })
      .from(schema.taskAssignees)
      .innerJoin(schema.users, eq(schema.taskAssignees.userId, schema.users.id))
      .where(inArray(schema.taskAssignees.taskId, taskIds)) : []

    const assigneesByTask: Record<number, { name: string; avatar: string | null }[]> = {}
    for (const a of assigneeRows) {
      if (!assigneesByTask[a.taskId]) assigneesByTask[a.taskId] = []
      assigneesByTask[a.taskId].push({ name: a.name, avatar: a.avatar })
    }

    const enriched = tasks.map((t: any) => ({ ...t, assignees: assigneesByTask[t.id] || [] }))

    return { data: enriched, total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async create(data: { project_id: number; title: string; description?: string | null }, ctx: ServiceContext) {
    if (ctx.roleId === ROLES.EMPLOYEE && !(await isProjectManager(ctx.userId, data.project_id))) {
      throw new AppError(403, 'لا تملك صلاحية إنشاء مهام في هذا المشروع')
    }

    const cleanTitle = sanitizeHtml(data.title, { allowedTags: [], allowedAttributes: {} })
    const cleanDesc = data.description
      ? sanitizeHtml(data.description, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h2', 'h3']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt'] } })
      : null

    const [task] = await this.db.insert(schema.tasks).values({
      projectId: data.project_id,
      title: cleanTitle,
      description: cleanDesc,
      createdBy: ctx.userId,
    }).returning()

    if (ctx.io) {
      ctx.io.emit('list:update', { type: 'task', action: 'created', data: { ...camelToSnake(task), subtasks_count: 0, completed_count: 0, created_by_name: ctx.userName, created_by_avatar: ctx.userAvatar } })
    }

    await addActivityLog(ctx.userId, 'create_task', `أضاف مهمة "${cleanTitle}" في المشروع`)

    const [project] = await this.db
      .select({ projectTitle: schema.projects.title })
      .from(schema.projects)
      .where(eq(schema.projects.id, data.project_id))
      .limit(1)

    if (ctx.io) {
      const members = await this.db
        .select({ userId: schema.projectMembers.userId })
        .from(schema.projectMembers)
        .where(eq(schema.projectMembers.projectId, data.project_id))
      notifService.createMany(
        members.map((m: any) => ({
          userId: m.userId,
          type: 'task_created',
          title: `مهمة جديدة: ${cleanTitle}`,
          message: `${ctx.userName} أضاف مهمة "${data.title}" في مشروع "${project?.projectTitle}"`,
          relatedType: 'task',
          relatedId: task.id,
        })),
        ctx.io,
      )
    }

    return task
  }

  async update(id: number, data: { title?: string; description?: string | null; status?: string }, ctx: ServiceContext) {
    const [old] = await this.db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1)
    const updates: Record<string, any> = {}

    if (data.title) {
      updates.title = sanitizeHtml(data.title, { allowedTags: [], allowedAttributes: {} })
    }
    if (data.description !== undefined) {
      updates.description = data.description
        ? sanitizeHtml(data.description, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h2', 'h3']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt'] } })
        : null
    }
    if (data.status) {
      updates.status = data.status
    }

    if (Object.keys(updates).length === 0) throw new AppError(400, 'لا توجد حقول للتحديث')

    await this.db.update(schema.tasks).set(updates).where(eq(schema.tasks.id, id))

    const [task] = await this.db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1)
    const [project] = await this.db
      .select({ title: schema.projects.title })
      .from(schema.projects)
      .where(eq(schema.projects.id, task.projectId))
      .limit(1)

    const changes: string[] = []
    if (data.title && data.title !== old?.title) changes.push(`تغيير الاسم إلى "${data.title}"`)
    if (data.description !== undefined && data.description !== old?.description) changes.push('تحديث الوصف')

    if (ctx.io) {
      ctx.io.emit('list:update', { type: 'task', action: 'updated', data: { id: Number(id), title: data.title, description: data.description !== undefined ? data.description : old?.description } })
    }

    if (changes.length > 0) {
      await addActivityLog(ctx.userId, 'update_task', `حدّث مهمة "${old?.title}": ${changes.join('، ')}`)
      if (ctx.io) {
        const members = await this.db
          .select({ userId: schema.projectMembers.userId })
          .from(schema.projectMembers)
          .where(eq(schema.projectMembers.projectId, task.projectId))
        notifService.createMany(
          members.map((m: any) => ({
            userId: m.userId,
            type: 'task_updated',
            title: `تحديث مهمة: ${old?.title}`,
            message: `${ctx.userName} حدّث مهمة "${old?.title}" في مشروع "${project?.title}": ${changes.join('، ')}`,
            relatedType: 'task',
            relatedId: task.id,
          })),
          ctx.io,
        )
      }
    }

    return task
  }

  async archive(id: number, ctx: ServiceContext) {
    const [task] = await this.db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1)
    const [project] = await this.db
      .select({ title: schema.projects.title })
      .from(schema.projects)
      .where(eq(schema.projects.id, task?.projectId))
      .limit(1)

    await this.db.update(schema.tasks).set({ status: 'archived' }).where(eq(schema.tasks.id, id))

    if (ctx.io) {
      ctx.io.emit('list:update', { type: 'task', action: 'deleted', data: { id: Number(id) } })
    }

    await addActivityLog(ctx.userId, 'archive_task', `أرشف مهمة "${task?.title}" في مشروع "${project?.title}"`)

    if (ctx.io) {
      const members = await this.db
        .select({ userId: schema.projectMembers.userId })
        .from(schema.projectMembers)
        .where(eq(schema.projectMembers.projectId, task.projectId))
      notifService.createMany(
        members.map((m: any) => ({
          userId: m.userId,
          type: 'task_archived',
          title: `تم أرشفة مهمة: ${task?.title}`,
          message: `${ctx.userName} أرشف مهمة "${task?.title}" في مشروع "${project?.title}"`,
          relatedType: 'task',
          relatedId: task.id,
        })),
        ctx.io,
      )
    }

    return { message: 'تم أرشفة المهمة' }
  }

  getAssignees(taskId: number) {
    return getTaskAssignees(taskId)
  }

  async addAssignee(taskId: number, userId: number, ctx: ServiceContext) {
    try {
      const [userRow] = await this.db
        .select({ roleId: schema.users.roleId })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1)
      if (!userRow) throw new AppError(404, 'المستخدم غير موجود')
      if (userRow.roleId !== ROLES.EMPLOYEE) throw new AppError(400, 'يمكن تكليف المستخدمين بصلاحية موظف فقط')

      const [assignee] = await this.db.insert(schema.taskAssignees).values({
        taskId,
        userId,
        assignedBy: ctx.userId,
      }).returning()

      const [enriched] = await this.db
        .select({
          id: schema.taskAssignees.id,
          taskId: schema.taskAssignees.taskId,
          userId: schema.taskAssignees.userId,
          assignedBy: schema.taskAssignees.assignedBy,
          createdAt: schema.taskAssignees.createdAt,
          name: schema.users.name,
          email: schema.users.email,
          avatar: schema.users.avatar,
          roleId: schema.users.roleId,
          roleName: schema.roles.name,
        })
        .from(schema.taskAssignees)
        .innerJoin(schema.users, eq(schema.taskAssignees.userId, schema.users.id))
        .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
        .where(eq(schema.taskAssignees.id, assignee.id))
        .limit(1)

      const taskRows = await this.db
        .select({ title: schema.tasks.title, projectId: schema.tasks.projectId })
        .from(schema.tasks)
        .where(eq(schema.tasks.id, taskId))
        .limit(1)
      const task = taskRows[0]

      const projectRows = await this.db
        .select({ projectTitle: schema.projects.title })
        .from(schema.projects)
        .where(eq(schema.projects.id, task?.projectId))
        .limit(1)
      const project = projectRows[0]

      if (ctx.io) {
        notifyUser({
          userId,
          type: 'task_assigned',
          title: 'تم تكليفك في مهمة',
          message: `تم تكليفك في مهمة "${task?.title}" في مشروع "${project?.projectTitle}"`,
          relatedType: 'task',
          relatedId: taskId,
          io: ctx.io
        })
        ctx.io.emit('list:update', { type: 'task', action: 'updated', data: { id: taskId } })
      }

      return enriched
    } catch (e: any) {
      if (e.code === '23505') throw new AppError(409, 'المستخدم مضاف مسبقاً')
      throw e
    }
  }

  async removeAssignee(taskId: number, userId: number, ctx: ServiceContext) {
    const result = await this.db
      .delete(schema.taskAssignees)
      .where(
        and(
          eq(schema.taskAssignees.taskId, taskId),
          eq(schema.taskAssignees.userId, userId),
        )
      )
    if (result.length === 0) throw new AppError(404, 'المكلف غير موجود')

    const [task] = await this.db
      .select({ title: schema.tasks.title })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId))
      .limit(1)

    if (ctx.io) {
      notifyUser({
        userId,
        type: 'task_unassigned',
        title: 'تم إلغاء تكليفك',
        message: `تم إلغاء تكليفك من مهمة "${task?.title}"`,
        relatedType: 'task',
        relatedId: taskId,
        io: ctx.io
      })
      ctx.io.emit('list:update', { type: 'task', action: 'updated', data: { id: taskId } })
    }

    return { message: 'تم إزالة المكلف' }
  }
}
