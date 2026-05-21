import { eq, and, sql, isNotNull, notInArray } from 'drizzle-orm'
import { BaseService } from './BaseService.js'
import { NotificationService } from './NotificationService.js'
import { schema, getDb } from '../db/index.js'
import { ROLES } from '../constants.js'

const MS_6H = 6 * 3600000
const MS_24H = 24 * 3600000

export class DeadlineService extends BaseService {
  private notifService: NotificationService

  constructor(db?: any) {
    super(db || getDb())
    this.notifService = new NotificationService(this.db)
  }

  async checkDeadlines(io?: any) {
    const now = Date.now()
    const in6h = now + MS_6H
    const in24h = now + MS_24H

    const subtasksWithDeadlines = await this.querySubtasks()

    for (const s of subtasksWithDeadlines) {
      const dl = new Date(s.deadline).getTime()

      if (dl > now && dl <= in24h && s.assignedTo) {
        await this.sendReminder(s, '24h', 'deadline_approaching_24h', '⏰ تبقى أقل من 24 ساعة على الموعد النهائي', io)
      }

      if (dl > now && dl <= in6h && s.assignedTo) {
        await this.sendReminder(s, '6h', 'deadline_approaching_6h', '🔴 تبقى أقل من 6 ساعات على الموعد النهائي!', io)
      }

      if (dl < now - 60000 && s.assignedTo) {
        const inserted = await this.tryInsert(s.id, 'overdue')
        if (!inserted) continue

        await this.notifService.create({
          userId: s.assignedTo,
          type: 'deadline_overdue',
          title: '⛔ تم تجاوز الموعد النهائي!',
          message: `مهمة "${s.title}" في "${s.taskTitle}" - كان الموعد ${new Date(s.deadline).toLocaleDateString('ar-SA')}`,
          relatedType: 'subtask',
          relatedId: s.id,
        }, io)

        const managers = await this.queryManagers()
        for (const m of managers) {
          if (m.id !== s.assignedTo) {
            await this.notifService.create({
              userId: m.id,
              type: 'deadline_overdue',
              title: `⛔ ${s.userName || 'موظف'} تجاوز الموعد النهائي`,
              message: `مهمة "${s.title}" في "${s.taskTitle}"`,
              relatedType: 'subtask',
              relatedId: s.id,
            }, io)
          }
        }

        await this.db.update(schema.deadlineReminders).set({ sent: 1 })
          .where(
            and(
              eq(schema.deadlineReminders.subtaskId, s.id),
              eq(schema.deadlineReminders.reminderType, 'overdue'),
            )
          )
      }
    }
  }

  protected async querySubtasks(): Promise<any[]> {
    return this.db
      .select({
        id: schema.subtasks.id,
        title: schema.subtasks.title,
        deadline: schema.subtasks.deadline,
        assignedTo: schema.subtasks.assignedTo,
        status: schema.subtasks.status,
        taskTitle: schema.tasks.title,
        projectTitle: schema.projects.title,
        userName: schema.users.name,
      })
      .from(schema.subtasks)
      .innerJoin(schema.tasks, eq(schema.subtasks.taskId, schema.tasks.id))
      .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
      .leftJoin(schema.users, eq(schema.subtasks.assignedTo, schema.users.id))
      .where(
        and(
          isNotNull(schema.subtasks.deadline),
          notInArray(schema.subtasks.status, ['approved', 'rejected']),
        )
      )
  }

  protected async queryManagers(): Promise<any[]> {
    return this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`${schema.users.roleId} IN (${ROLES.ADMIN}, ${ROLES.DEPUTY})`)
  }

  private async tryInsert(subtaskId: number, reminderType: string): Promise<boolean> {
    try {
      await this.db.insert(schema.deadlineReminders).values({ subtaskId, reminderType }).run()
      return true
    } catch {
      return false
    }
  }

  private async sendReminder(s: any, reminderType: string, type: string, title: string, io?: any) {
    const inserted = await this.tryInsert(s.id, reminderType)
    if (!inserted) return

    await this.notifService.create({
      userId: s.assignedTo,
      type,
      title,
      message: `مهمة "${s.title}" في "${s.taskTitle}" - ${new Date(s.deadline).toLocaleDateString('ar-SA')}`,
      relatedType: 'subtask',
      relatedId: s.id,
    }, io)

    await this.db.update(schema.deadlineReminders).set({ sent: 1 })
      .where(
        and(
          eq(schema.deadlineReminders.subtaskId, s.id),
          eq(schema.deadlineReminders.reminderType, reminderType),
        )
      )
  }
}
