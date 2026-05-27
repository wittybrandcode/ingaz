import { eq, and, sql } from 'drizzle-orm'
import { BaseService, AppError } from './BaseService.js'
import type { ServiceContext } from './BaseService.js'
import { schema, isProjectManager, isSubtaskAssignee, addActivityLog, getTaskAssignees } from '../db/index.js'
import { parseMentions } from '../notify.js'
import { camelToSnake } from '../lib/case-transform.js'
import { NotificationService } from './NotificationService.js'

export class CommentService extends BaseService {
  private notifService: NotificationService

  constructor(db: any, notifService?: NotificationService) {
    super(db)
    this.notifService = notifService || new NotificationService(db)
  }

  async getBySubtask(subtaskId: number) {
    return this.db
      .select({
        id: schema.comments.id,
        subtaskId: schema.comments.subtaskId,
        userId: schema.comments.userId,
        content: schema.comments.content,
        isWinner: schema.comments.isWinner,
        winnerSelectedAt: schema.comments.winnerSelectedAt,
        winnerSelectedBy: schema.comments.winnerSelectedBy,
        createdAt: schema.comments.createdAt,
        userName: schema.users.name,
        userAvatar: schema.users.avatar,
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.comments.userId, schema.users.id))
      .where(eq(schema.comments.subtaskId, subtaskId))
      .orderBy(schema.comments.createdAt)
  }

  async create(data: { subtask_id: number; content: string }, ctx: ServiceContext) {
    const [comment] = await this.db.insert(schema.comments).values({
      subtaskId: data.subtask_id,
      userId: ctx.userId,
      content: data.content.trim(),
    }).returning()

    const [enriched] = await this.db
      .select({
        id: schema.comments.id,
        subtaskId: schema.comments.subtaskId,
        userId: schema.comments.userId,
        content: schema.comments.content,
        isWinner: schema.comments.isWinner,
        winnerSelectedAt: schema.comments.winnerSelectedAt,
        winnerSelectedBy: schema.comments.winnerSelectedBy,
        createdAt: schema.comments.createdAt,
        userName: schema.users.name,
        userAvatar: schema.users.avatar,
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.comments.userId, schema.users.id))
      .where(eq(schema.comments.id, comment.id))
      .limit(1)

    if (ctx.io) ctx.io.emit('comment:new', camelToSnake(enriched))

    const [subtask] = await this.db
      .select({
        id: schema.subtasks.id,
        assignedTo: schema.subtasks.assignedTo,
        title: schema.subtasks.title,
        taskTitle: schema.tasks.title,
        projectTitle: schema.projects.title,
      })
      .from(schema.subtasks)
      .innerJoin(schema.tasks, eq(schema.subtasks.taskId, schema.tasks.id))
      .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
      .where(eq(schema.subtasks.id, data.subtask_id))
      .limit(1)

    if (subtask) {
      if (subtask.assignedTo && subtask.assignedTo !== ctx.userId) {
        this.notifService.create({
          userId: subtask.assignedTo,
          type: 'comment',
          title: `${ctx.userName} علّق على مهمتك`,
          message: data.content.trim().slice(0, 100),
          relatedType: 'subtask',
          relatedId: subtask.id,
        }, ctx.io)
      }

      const mentionedIds = await parseMentions(data.content)
      const mentionItems = mentionedIds
        .filter(mid => mid !== ctx.userId)
        .map(mid => ({
          userId: mid,
          type: '@mention',
          title: `${ctx.userName} أشار إليك في تعليق`,
          message: data.content.trim().slice(0, 100),
          relatedType: 'subtask',
          relatedId: subtask.id,
        }))
      if (mentionItems.length > 0) {
        this.notifService.createMany(mentionItems, ctx.io)
      }
    }

    return enriched
  }

  async selectWinner(commentId: number, ctx: ServiceContext) {
    const [comment] = await this.db
      .select({
        id: schema.comments.id,
        subtaskId: schema.comments.subtaskId,
        userId: schema.comments.userId,
        content: schema.comments.content,
        isWinner: schema.comments.isWinner,
      })
      .from(schema.comments)
      .where(eq(schema.comments.id, commentId))
      .limit(1)
    if (!comment) throw new AppError(404, 'التعليق غير موجود')
    if (comment.isWinner) throw new AppError(400, 'هذا التعليق فائز مسبقاً')

    const [subtask] = await this.db
      .select({
        id: schema.subtasks.id,
        status: schema.subtasks.status,
        taskId: schema.subtasks.taskId,
        title: schema.subtasks.title,
      })
      .from(schema.subtasks)
      .where(eq(schema.subtasks.id, comment.subtaskId))
      .limit(1)
    if (!subtask) throw new AppError(404, 'المهمة الفرعية غير موجودة')
    if (subtask.status !== 'open') throw new AppError(400, 'يمكن ترشيح فائز في المهام المفتوحة فقط')

    if (!ctx.isManager) {
      const isTaskAssignee = await this.db
        .select()
        .from(schema.taskAssignees)
        .where(and(eq(schema.taskAssignees.taskId, subtask.taskId), eq(schema.taskAssignees.userId, ctx.userId)))
        .limit(1)
      if (!isTaskAssignee.length) {
        throw new AppError(403, 'لا تملك صلاحية ترشيح فائز في هذه المهمة')
      }
    }

    let task: any
    let newTaskStatus = ''
    let allCompleted = false
    let activeCount = 0
    let completedCount = 0
    await this.db.transaction(async (tx: any) => {
      await tx.update(schema.comments).set({
        isWinner: 1,
        winnerSelectedAt: sql`NOW()`,
        winnerSelectedBy: ctx.userId,
      }).where(eq(schema.comments.id, commentId))

      await tx.update(schema.subtasks).set({
        status: 'completed',
        winnerCommentId: commentId,
      }).where(eq(schema.subtasks.id, subtask.id))

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

      const statusCounts = await tx
        .select({
          activeCount: sql`COUNT(CASE WHEN ${schema.subtasks.status} IN ('open', 'completed') THEN 1 END)`,
          completedCount: sql`COUNT(CASE WHEN ${schema.subtasks.status} = 'completed' THEN 1 END)`,
        })
        .from(schema.subtasks)
        .where(eq(schema.subtasks.taskId, subtask.taskId))

      activeCount = Number(statusCounts[0]?.activeCount || 0)
      completedCount = Number(statusCounts[0]?.completedCount || 0)

      if (activeCount === 0 || activeCount === completedCount) newTaskStatus = 'completed'
      else newTaskStatus = 'in_progress'

      if (task && task.id) {
        await tx.update(schema.tasks).set({ status: newTaskStatus }).where(eq(schema.tasks.id, task.id))
      }

      const allTasks = await tx
        .select({ status: schema.tasks.status })
        .from(schema.tasks)
        .where(eq(schema.tasks.projectId, task.projectId))
      allCompleted = allTasks.length > 0 && allTasks.every((t: { status: string }) => t.status === 'completed')

      if (task && allCompleted) {
        await tx.update(schema.projects).set({ status: 'completed' }).where(eq(schema.projects.id, task.projectId))
      }

      await tx.insert(schema.activityLogs).values({
        userId: ctx.userId,
        action: 'select_winner',
        details: `رشّح ${ctx.userName} تعليقاً فائزاً في "${subtask.title}"`,
      })
    })

    if (ctx.io) {
      ctx.io.emit('comment:winner-selected', { commentId: Number(commentId), subtaskId: subtask.id })

      ctx.io.emit('subtask:updated', {
        id: subtask.id,
        status: 'completed',
        winner_comment_id: commentId,
      })

      ctx.io.emit('list:update', {
        type: 'task',
        action: 'updated',
        data: {
          id: task?.id,
          status: newTaskStatus,
          active_count: activeCount,
          completed_count: completedCount,
        },
      })

      if (allCompleted) {
        ctx.io.emit('list:update', {
          type: 'project',
          action: 'updated',
          data: { id: task?.projectId, status: 'completed' },
        })

        const allUsers = await this.db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.status, 'active'))
        this.notifService.createMany(
          allUsers.map((u: any) => ({
            userId: u.id,
            type: 'project_completed',
            title: 'اكتمل مشروع! 🎉',
            message: `اكتمل مشروع "${task?.projectTitle}"`,
            relatedType: 'project',
            relatedId: task?.projectId,
          })),
          ctx.io,
        )
      } else if (newTaskStatus === 'completed') {
        const allUsers = await this.db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.status, 'active'))
        this.notifService.createMany(
          allUsers.map((u: any) => ({
            userId: u.id,
            type: 'task_completed',
            title: 'اكتملت مهمة',
            message: `اكتملت مهمة "${task?.title}" في مشروع "${task?.projectTitle}"`,
            relatedType: 'project',
            relatedId: task?.projectId,
          })),
          ctx.io,
        )
      }

      const allParticipants = await this.db
        .select({ userId: schema.subtaskAssignees.userId })
        .from(schema.subtaskAssignees)
        .where(eq(schema.subtaskAssignees.subtaskId, subtask.id))

      const notifiedIds = new Set<number>()
      for (const p of allParticipants) {
        if (p.userId !== ctx.userId && !notifiedIds.has(p.userId)) {
          notifiedIds.add(p.userId)
          this.notifService.create({
            userId: p.userId,
            type: 'winner_selected',
            title: 'تم ترشيح تعليق فائز',
            message: `${ctx.userName} رشّح تعليقاً فائزاً في "${subtask.title}"`,
            relatedType: 'subtask',
            relatedId: subtask.id,
          }, ctx.io)
        }
      }
    }

    return { message: 'تم ترشيح التعليق كفائز' }
  }
}
