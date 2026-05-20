import { sql, eq, and } from 'drizzle-orm'
import { count } from 'drizzle-orm'
import { BaseService } from './BaseService.js'
import { schema } from '../db/index.js'

export class AnalyticsService extends BaseService {
  async dashboard() {
    const [projectRow] = await this.db
      .select({ count: count() })
      .from(schema.projects)
      .where(eq(schema.projects.status, 'active'))
    const [taskRow] = await this.db
      .select({ count: count() })
      .from(schema.tasks)
      .where(eq(schema.tasks.status, 'active'))
    const [subtaskRow] = await this.db
      .select({ count: count() })
      .from(schema.subtasks)
    const [userRow] = await this.db
      .select({ count: count() })
      .from(schema.users)
      .where(eq(schema.users.status, 'active'))

    const statusDistribution = await this.db
      .select({
        status: schema.subtasks.status,
        count: count(),
      })
      .from(schema.subtasks)
      .groupBy(schema.subtasks.status)

    const recentActivity = await this.db
      .select({
        id: schema.activityLogs.id,
        userId: schema.activityLogs.userId,
        action: schema.activityLogs.action,
        details: schema.activityLogs.details,
        createdAt: schema.activityLogs.createdAt,
        userName: schema.users.name,
        userAvatar: schema.users.avatar,
      })
      .from(schema.activityLogs)
      .innerJoin(schema.users, eq(schema.activityLogs.userId, schema.users.id))
      .orderBy(sql`${schema.activityLogs.createdAt} DESC`)
      .limit(20)

    const projectProgress = await this.db
      .select({
        id: schema.projects.id,
        title: schema.projects.title,
        totalSubtasks: count(schema.subtasks.id),
        approvedSubtasks: sql`COALESCE(SUM(CASE WHEN ${schema.subtasks.status} = 'approved' THEN 1 ELSE 0 END), 0)`,
      })
      .from(schema.projects)
      .leftJoin(schema.tasks,
        and(
          eq(schema.tasks.projectId, schema.projects.id),
          eq(schema.tasks.status, 'active'),
        )
      )
      .leftJoin(schema.subtasks, eq(schema.subtasks.taskId, schema.tasks.id))
      .where(eq(schema.projects.status, 'active'))
      .groupBy(schema.projects.id)

    const tasksByUser = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        avatar: schema.users.avatar,
        total: count(schema.subtasks.id),
        approved: sql`COALESCE(SUM(CASE WHEN ${schema.subtasks.status} = 'approved' THEN 1 ELSE 0 END), 0)`,
      })
      .from(schema.users)
      .leftJoin(schema.subtasks, eq(schema.subtasks.assignedTo, schema.users.id))
      .where(eq(schema.users.status, 'active'))
      .groupBy(schema.users.id)

    return {
      counts: {
        projects: projectRow?.count ?? 0,
        tasks: taskRow?.count ?? 0,
        subtasks: subtaskRow?.count ?? 0,
        users: userRow?.count ?? 0,
      },
      statusDistribution,
      recentActivity,
      projectProgress,
      tasksByUser,
    }
  }
}
