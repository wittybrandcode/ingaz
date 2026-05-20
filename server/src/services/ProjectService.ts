import sanitizeHtml from 'sanitize-html'
import path from 'path'
import fs from 'fs'
import { eq, and, count, sql, inArray } from 'drizzle-orm'
import { ROLES, PAGINATION } from '../constants.js'
import { BaseService, AppError } from './BaseService.js'
import type { ServiceContext } from './BaseService.js'
import { schema, addActivityLog } from '../db/index.js'
import { notifyAll, notifyUser } from '../notify.js'
import { camelToSnake } from '../lib/case-transform.js'

export class ProjectService extends BaseService {
  async list(page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(schema.projects)
      .where(sql`${schema.projects.status} != 'archived'`)
    const total = totalRow?.count ?? 0

    const projects = await this.db
      .select({
        id: schema.projects.id,
        title: schema.projects.title,
        description: schema.projects.description,
        createdBy: schema.projects.createdBy,
        status: schema.projects.status,
        createdAt: schema.projects.createdAt,
        createdByName: schema.users.name,
        createdByAvatar: schema.users.avatar,
        tasksCount: sql`(SELECT COUNT(*) FROM tasks WHERE project_id = ${schema.projects.id})`,
        subtasksCount: sql`(SELECT COUNT(*) FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ${schema.projects.id}))`,
        completedCount: sql`(SELECT COUNT(*) FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ${schema.projects.id}) AND status = 'completed')`,
      })
      .from(schema.projects)
      .innerJoin(schema.users, eq(schema.projects.createdBy, schema.users.id))
      .where(sql`${schema.projects.status} != 'archived'`)
      .orderBy(sql`${schema.projects.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    const projectIds = projects.map((p: any) => p.id)
    const memberRows = projectIds.length > 0 ? await this.db
      .select({
        projectId: schema.projectMembers.projectId,
        name: schema.users.name,
        avatar: schema.users.avatar,
      })
      .from(schema.projectMembers)
      .innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
      .where(inArray(schema.projectMembers.projectId, projectIds)) : []

    const membersByProject: Record<number, { name: string; avatar: string | null }[]> = {}
    for (const m of memberRows) {
      if (!membersByProject[m.projectId]) membersByProject[m.projectId] = []
      membersByProject[m.projectId].push({ name: m.name, avatar: m.avatar })
    }

    const enriched = projects.map((p: any) => ({ ...p, members: membersByProject[p.id] || [] }))

    return { data: enriched, total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async getById(id: number) {
    const [project] = await this.db
      .select({
        id: schema.projects.id,
        title: schema.projects.title,
        description: schema.projects.description,
        createdBy: schema.projects.createdBy,
        status: schema.projects.status,
        createdAt: schema.projects.createdAt,
        createdByName: schema.users.name,
      })
      .from(schema.projects)
      .innerJoin(schema.users, eq(schema.projects.createdBy, schema.users.id))
      .where(eq(schema.projects.id, id))
      .limit(1)
    if (!project) throw new AppError(404, 'المشروع غير موجود')

    const page = Math.max(1, 1)
    const pageSize = PAGINATION.DEFAULT_PAGE_SIZE
    const offset = (page - 1) * pageSize

    const [tasksTotalRow] = await this.db
      .select({ count: count() })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.projectId, id),
          sql`${schema.tasks.status} != 'archived'`,
        )
      )
    const tasksTotal = tasksTotalRow?.count ?? 0

    const tasks = await this.db
      .select({
        id: schema.tasks.id,
        projectId: schema.tasks.projectId,
        title: schema.tasks.title,
        description: schema.tasks.description,
        createdBy: schema.tasks.createdBy,
        status: schema.tasks.status,
        createdAt: schema.tasks.createdAt,
        subtasksCount: sql`(SELECT COUNT(*) FROM subtasks WHERE task_id = ${schema.tasks.id})`,
        completedCount: sql`(SELECT COUNT(*) FROM subtasks WHERE task_id = ${schema.tasks.id} AND status = 'completed')`,
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.projectId, id),
          sql`${schema.tasks.status} != 'archived'`,
        )
      )
      .orderBy(sql`${schema.tasks.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    const members = await this.db
      .select({
        id: schema.projectMembers.id,
        projectId: schema.projectMembers.projectId,
        userId: schema.projectMembers.userId,
        role: schema.projectMembers.role,
        createdAt: schema.projectMembers.createdAt,
        name: schema.users.name,
        email: schema.users.email,
        avatar: schema.users.avatar,
      })
      .from(schema.projectMembers)
      .innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
      .where(eq(schema.projectMembers.projectId, id))

    return { ...project, tasks, members, tasks_total: tasksTotal, tasks_page: page, tasks_pages: Math.ceil(tasksTotal / pageSize) }
  }

  async create(data: { title: string; description?: string | null }, ctx: ServiceContext) {
    const cleanTitle = sanitizeHtml(data.title, { allowedTags: [], allowedAttributes: {} })
    const cleanDesc = data.description
      ? sanitizeHtml(data.description, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h2', 'h3']), allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ['src', 'alt'] } })
      : null

    const [project] = await this.db.insert(schema.projects).values({
      title: cleanTitle,
      description: cleanDesc,
      createdBy: ctx.userId,
    }).returning()

    await addActivityLog(ctx.userId, 'create_project', `أنشأ مشروع "${cleanTitle}"`)

    if (ctx.io) {
      notifyAll({
        type: 'project_created',
        title: 'مشروع جديد',
        message: `${ctx.userName} أنشأ مشروع "${data.title}"`,
        relatedType: 'project',
        relatedId: project.id,
        io: ctx.io
      })
      ctx.io.emit('list:update', { type: 'project', action: 'created', data: { ...camelToSnake(project), tasks_count: 0, created_by_name: ctx.userName, created_by_avatar: ctx.userAvatar } })
    }

    return project
  }

  async update(id: number, data: { title?: string; description?: string | null; status?: string }, ctx: ServiceContext) {
    const [old] = await this.db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1)
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

    await this.db.update(schema.projects).set(updates).where(eq(schema.projects.id, id))

    const [project] = await this.db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1)

    const changes: string[] = []
    if (data.title && data.title !== old?.title) changes.push(`تغيير الاسم إلى "${data.title}"`)
    if (data.description !== undefined && data.description !== old?.description) changes.push('تحديث الوصف')

    if (ctx.io) {
      ctx.io.emit('list:update', { type: 'project', action: 'updated', data: { id: Number(id), title: data.title, description: data.description !== undefined ? data.description : old?.description } })
    }

    if (changes.length > 0) {
      await addActivityLog(ctx.userId, 'update_project', `حدّث مشروع "${old?.title}": ${changes.join('، ')}`)
      if (ctx.io) {
        notifyAll({
          type: 'project_updated',
          title: 'تحديث مشروع',
          message: `${ctx.userName} حدّث مشروع "${old?.title}": ${changes.join('، ')}`,
          relatedType: 'project',
          relatedId: project.id,
          io: ctx.io
        })
      }
    }

    return project
  }

  async archive(id: number, ctx: ServiceContext) {
    const [project] = await this.db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1)
    await this.db.update(schema.projects).set({ status: 'archived' }).where(eq(schema.projects.id, id))
    await addActivityLog(ctx.userId, 'archive_project', `أرشف مشروع "${project?.title}"`)
    if (ctx.io) {
      ctx.io.emit('list:update', { type: 'project', action: 'deleted', data: { id: Number(id) } })
      notifyAll({
        type: 'project_archived',
        title: 'أرشفة مشروع',
        message: `${ctx.userName} أرشف مشروع "${project?.title}"`,
        relatedType: 'project',
        relatedId: Number(id),
        io: ctx.io
      })
    }
    return { message: 'تم أرشفة المشروع' }
  }

  async permanentDelete(id: number, ctx: ServiceContext) {
    const [project] = await this.db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1)
    const taskRows = await this.db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, id))
    const taskIds = taskRows.map((r: any) => r.id)

    let subtaskIds: number[] = []
    if (taskIds.length > 0) {
      const subRows = await this.db
        .select({ id: schema.subtasks.id })
        .from(schema.subtasks)
        .where(inArray(schema.subtasks.taskId, taskIds))
      subtaskIds = subRows.map((r: any) => r.id)
    }

    for (const tid of [Number(id), ...taskIds, ...subtaskIds]) {
      const atts = await this.db
        .select()
        .from(schema.attachments)
        .where(
          and(
            eq(schema.attachments.entityId, tid),
            sql`${schema.attachments.entityType} IN ('project', 'task', 'subtask')`,
          )
        )
      for (const a of atts) {
        const fp = path.join(process.cwd(), 'uploads', a.filename)
        if (fs.existsSync(fp)) fs.unlinkSync(fp)
      }
      await this.db
        .delete(schema.attachments)
        .where(
          and(
            eq(schema.attachments.entityId, tid),
            sql`${schema.attachments.entityType} IN ('project', 'task', 'subtask')`,
          )
        )
    }

    await this.db.delete(schema.projects).where(eq(schema.projects.id, id))

    await addActivityLog(ctx.userId, 'delete_project', `حذف مشروع "${project?.title}" نهائياً`)
    if (ctx.io) {
      ctx.io.emit('list:update', { type: 'project', action: 'deleted', data: { id: Number(id) } })
      notifyAll({
        type: 'project_deleted',
        title: 'حذف مشروع',
        message: `${ctx.userName} حذف مشروع "${project?.title}" نهائياً`,
        relatedType: 'project',
        relatedId: undefined,
        io: ctx.io
      })
    }

    return { message: 'تم حذف المشروع نهائياً' }
  }

  async getMembers(projectId: number) {
    const rows = await this.db
      .select({
        id: schema.projectMembers.id,
        projectId: schema.projectMembers.projectId,
        userId: schema.projectMembers.userId,
        role: schema.projectMembers.role,
        createdAt: schema.projectMembers.createdAt,
        name: schema.users.name,
        email: schema.users.email,
        avatar: schema.users.avatar,
        roleId: schema.users.roleId,
        roleName: schema.roles.name,
      })
      .from(schema.projectMembers)
      .innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
      .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
      .where(eq(schema.projectMembers.projectId, projectId))
      .orderBy(sql`${schema.projectMembers.createdAt} DESC`)
    return camelToSnake(rows)
  }

  async addMember(projectId: number, userId: number, ctx?: ServiceContext) {
    try {
      const [member] = await this.db.insert(schema.projectMembers).values({
        projectId,
        userId,
        role: 'manager',
      }).returning()

      const [enriched] = await this.db
        .select({
          id: schema.projectMembers.id,
          projectId: schema.projectMembers.projectId,
          userId: schema.projectMembers.userId,
          role: schema.projectMembers.role,
          createdAt: schema.projectMembers.createdAt,
          name: schema.users.name,
          email: schema.users.email,
          avatar: schema.users.avatar,
          roleId: schema.users.roleId,
          roleName: schema.roles.name,
        })
        .from(schema.projectMembers)
        .innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
        .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
        .where(eq(schema.projectMembers.id, member.id))
        .limit(1)

      if (ctx?.io) {
        const [project] = await this.db
          .select({ title: schema.projects.title })
          .from(schema.projects)
          .where(eq(schema.projects.id, projectId))
          .limit(1)
        notifyUser({
          userId,
          type: 'project_assigned',
          title: 'تمت إضافتك كمشرف على مشروع',
          message: `تمت إضافتك كمشرف على مشروع "${project?.title}"`,
          relatedType: 'project',
          relatedId: projectId,
          io: ctx.io,
        })
      }

      return camelToSnake(enriched)
    } catch (e: any) {
      if (e.code === '23505') throw new AppError(409, 'المستخدم مضاف مسبقاً')
      throw e
    }
  }

  async removeMember(projectId: number, memberUserId: number) {
    const result = await this.db
      .delete(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, memberUserId),
        )
      )
    if (result.length === 0) throw new AppError(404, 'العضو غير موجود')
    return { message: 'تم إزالة العضو' }
  }
}
