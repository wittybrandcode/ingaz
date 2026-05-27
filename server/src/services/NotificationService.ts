import { eq, and, not, count, sql, inArray } from 'drizzle-orm'
import { PAGINATION } from '../constants.js'
import { BaseService } from './BaseService.js'
import { schema } from '../db/index.js'

export class NotificationService extends BaseService {
  async list(userId: number, page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
    const count_ = totalRow?.count ?? 0

    const notifications = await this.db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(sql`${schema.notifications.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    const subtaskIds = notifications
      .filter((n: any) => n.relatedType === 'subtask' && n.relatedId)
      .map((n: any) => n.relatedId)
    const projectIds = notifications
      .filter((n: any) => n.relatedType === 'project' && n.relatedId)
      .map((n: any) => n.relatedId)
    const taskIds = notifications
      .filter((n: any) => n.relatedType === 'task' && n.relatedId)
      .map((n: any) => n.relatedId)

    const relatedMap: Record<string, any> = {}

    if (subtaskIds.length > 0) {
      const subtasks = await this.db
        .select({
          id: schema.subtasks.id,
          title: schema.subtasks.title,
          description: schema.subtasks.description,
          status: schema.subtasks.status,
          assignedTo: schema.subtasks.assignedTo,
          deadline: schema.subtasks.deadline,
          taskId: schema.tasks.id,
          taskTitle: schema.tasks.title,
          projectId: schema.projects.id,
          projectTitle: schema.projects.title,
        })
        .from(schema.subtasks)
        .innerJoin(schema.tasks, eq(schema.subtasks.taskId, schema.tasks.id))
        .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
        .where(inArray(schema.subtasks.id, subtaskIds))
      for (const s of subtasks) relatedMap[`subtask:${s.id}`] = s
    }

    if (projectIds.length > 0) {
      const projects = await this.db
        .select({ id: schema.projects.id, title: schema.projects.title })
        .from(schema.projects)
        .where(inArray(schema.projects.id, projectIds))
      for (const p of projects) relatedMap[`project:${p.id}`] = p
    }

    if (taskIds.length > 0) {
      const tasks = await this.db
        .select({ id: schema.tasks.id, title: schema.tasks.title })
        .from(schema.tasks)
        .where(inArray(schema.tasks.id, taskIds))
      for (const t of tasks) relatedMap[`task:${t.id}`] = t
    }

    const enriched = notifications.map((n: any) => {
      let related = null
      if (n.relatedType === 'subtask' && n.relatedId) related = relatedMap[`subtask:${n.relatedId}`] || null
      if (n.relatedType === 'project' && n.relatedId) related = relatedMap[`project:${n.relatedId}`] || null
      if (n.relatedType === 'task' && n.relatedId) related = relatedMap[`task:${n.relatedId}`] || null
      return { ...n, related }
    })

    return { data: enriched, total: count_, pages: Math.ceil(count_ / pageSize), page, pageSize }
  }

  async unreadCount(userId: number) {
    const [row] = await this.db
      .select({ count: count() })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.read, 0),
        )
      )
    return row
  }

  async markRead(notificationId: number, userId: number) {
    await this.db
      .update(schema.notifications)
      .set({ read: 1 })
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.userId, userId),
        )
      )
    return { message: 'تم تحديد كمقروء' }
  }

  async markAllRead(userId: number) {
    await this.db
      .update(schema.notifications)
      .set({ read: 1 })
      .where(eq(schema.notifications.userId, userId))
    return { message: 'تم تحديد الكل كمقروء' }
  }

  async getPreferences(userId: number) {
    const types = await this.db
      .select()
      .from(schema.notificationTypes)
      .orderBy(schema.notificationTypes.typeGroup, schema.notificationTypes.id)

    const prefs = await this.db
      .select()
      .from(schema.notificationPreferences)
      .where(eq(schema.notificationPreferences.userId, userId))

    const prefMap: Record<string, any> = {}
    for (const p of prefs) {
      prefMap[p.notificationType] = { enabled: p.enabled, channels: JSON.parse(p.channels) }
    }

    return types.map((t: any) => ({
      ...t,
      enabled: prefMap[t.typeKey]?.enabled ?? t.defaultEnabled,
      channels: prefMap[t.typeKey]?.channels ?? ['in_app'],
    }))
  }

  async updatePreference(userId: number, typeKey: string, data: { enabled?: number; channels?: string[] }) {
    const [pref] = await this.db
      .select({ id: schema.notificationPreferences.id })
      .from(schema.notificationPreferences)
      .where(
        and(
          eq(schema.notificationPreferences.userId, userId),
          eq(schema.notificationPreferences.notificationType, typeKey),
        )
      )
      .limit(1)

    const channels = data.channels ? JSON.stringify(data.channels) : '["in_app"]'

    if (pref) {
      await this.db
        .update(schema.notificationPreferences)
        .set({ enabled: data.enabled ?? 1, channels })
        .where(eq(schema.notificationPreferences.id, pref.id))
    } else {
      await this.db.insert(schema.notificationPreferences).values({
        userId,
        notificationType: typeKey,
        enabled: data.enabled ?? 1,
        channels,
      })
    }
    return { message: 'تم تحديث التفضيلات' }
  }

  async dailySummary(userId: number) {
    const today = new Date().toISOString().split('T')[0]

    const pendingSubtasks = await this.db
      .select({
        id: schema.subtasks.id,
        title: schema.subtasks.title,
        deadline: schema.subtasks.deadline,
        status: schema.subtasks.status,
        taskTitle: schema.tasks.title,
        projectTitle: schema.projects.title,
      })
      .from(schema.subtasks)
      .innerJoin(schema.tasks, eq(schema.subtasks.taskId, schema.tasks.id))
      .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
      .where(
        and(
          eq(schema.subtasks.assignedTo, userId),
          not(inArray(schema.subtasks.status, ['approved', 'rejected'])),
        )
      )
      .orderBy(schema.subtasks.deadline)

    const overdue = pendingSubtasks.filter((s: any) => s.deadline && s.deadline < today)
    const todayDue = pendingSubtasks.filter((s: any) => s.deadline && s.deadline.split('T')[0] === today)

    const [stats] = await this.db
      .select({
        total: count(),
        approved: sql`COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0)`,
        rejected: sql`COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0)`,
        pending: sql`COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)`,
        inProgress: sql`COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0)`,
      })
      .from(schema.subtasks)
      .where(eq(schema.subtasks.assignedTo, userId))

    return { pendingSubtasks, overdue, todayDue, stats }
  }

  async isEnabled(userId: number, typeKey: string): Promise<boolean> {
    const [pref] = await this.db
      .select({ enabled: schema.notificationPreferences.enabled })
      .from(schema.notificationPreferences)
      .where(
        and(
          eq(schema.notificationPreferences.userId, userId),
          eq(schema.notificationPreferences.notificationType, typeKey),
        )
      )
      .limit(1)
    if (pref) return pref.enabled === 1
    const [typeRow] = await this.db
      .select({ defaultEnabled: schema.notificationTypes.defaultEnabled })
      .from(schema.notificationTypes)
      .where(eq(schema.notificationTypes.typeKey, typeKey))
      .limit(1)
    return typeRow ? typeRow.defaultEnabled === 1 : true
  }

  async create(data: {
    userId: number
    fromUserId?: number
    title: string
    message?: string
    type: string
    relatedType?: string
    relatedId?: number
  }, io?: any) {
    if (!await this.isEnabled(data.userId, data.type)) return null
    const [notif] = await this.db.insert(schema.notifications).values({
      userId: data.userId,
      fromUserId: data.fromUserId ?? null,
      title: data.title,
      message: data.message ?? null,
      type: data.type,
      relatedType: data.relatedType ?? null,
      relatedId: data.relatedId ?? null,
    }).returning()
    if (notif && io) {
      try { io.to(`user:${data.userId}`).emit('notification', notif) } catch { /* socket send failed silently */ }
    }
    return notif || null
  }

  async createMany(items: {
    userId: number
    fromUserId?: number
    title: string
    message?: string
    type: string
    relatedType?: string
    relatedId?: number
  }[], io?: any) {
    if (items.length === 0) return []

    const seen = new Set<string>()
    const uniquePairs: { userId: number; typeKey: string }[] = []
    for (const item of items) {
      const key = `${item.userId}:${item.type}`
      if (!seen.has(key)) {
        seen.add(key)
        uniquePairs.push({ userId: item.userId, typeKey: item.type })
      }
    }

    const pairsSql = sql.join(
      uniquePairs.map(p => sql`(${p.userId}, ${p.typeKey})`),
      sql`, `,
    )
    const prefs: any[] = await this.db
      .select()
      .from(schema.notificationPreferences)
      .where(sql`(${schema.notificationPreferences.userId}, ${schema.notificationPreferences.notificationType}) IN (${pairsSql})`)

    const prefMap = new Map<string, boolean>()
    for (const p of prefs) {
      prefMap.set(`${p.userId}:${p.notificationType}`, p.enabled === 1)
    }

    const missingTypeKeys = [...new Set(
      uniquePairs
        .filter(p => !prefMap.has(`${p.userId}:${p.typeKey}`))
        .map(p => p.typeKey)
    )]

    const defaults: any[] = missingTypeKeys.length > 0 ? await this.db
      .select({ typeKey: schema.notificationTypes.typeKey, defaultEnabled: schema.notificationTypes.defaultEnabled })
      .from(schema.notificationTypes)
      .where(inArray(schema.notificationTypes.typeKey, missingTypeKeys)) : []
    const defaultMap = new Map(defaults.map((d: any) => [d.typeKey, d.defaultEnabled === 1]))

    const enabledItems = items.filter(item => {
      const cached = prefMap.get(`${item.userId}:${item.type}`)
      if (cached !== undefined) return cached
      return defaultMap.get(item.type) ?? true
    })

    if (enabledItems.length === 0) return []
    const notifs = await this.db.insert(schema.notifications).values(
      enabledItems.map(item => ({
        userId: item.userId,
        fromUserId: item.fromUserId ?? null,
        title: item.title,
        message: item.message ?? null,
        type: item.type,
        relatedType: item.relatedType ?? null,
        relatedId: item.relatedId ?? null,
      }))
    ).returning()
    if (io) {
      for (let i = 0; i < notifs.length; i++) {
        try { io.to(`user:${notifs[i].userId}`).emit('notification', notifs[i]) } catch { /* socket send failed silently */ }
      }
    }
    return notifs
  }

  async updateBatchTypes(userId: number, types: { id: number; enabled: boolean }[]) {
    for (const t of types) {
      const [typeRow] = await this.db
        .select({ typeKey: schema.notificationTypes.typeKey })
        .from(schema.notificationTypes)
        .where(eq(schema.notificationTypes.id, t.id))
        .limit(1)
      if (typeRow) {
        await this.db
          .update(schema.notificationPreferences)
          .set({ enabled: t.enabled ? 1 : 0 })
          .where(
            and(
              eq(schema.notificationPreferences.userId, userId),
              eq(schema.notificationPreferences.notificationType, typeRow.typeKey),
            )
          )
      }
    }
    return { message: 'تم حفظ الإعدادات' }
  }
}
