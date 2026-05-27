import { eq, sql, desc } from 'drizzle-orm'
import { BaseService } from './BaseService.js'
import * as schema from '../db/schema.js'

export interface MemberProfile {
  id: number
  name: string
  email: string
  avatar: string | null
  role_id: number | null
  role_name: string | null
  is_manager: number | null
  frozen_at: string | null
  active_tasks: number
  warnings_count: number
  projects_count: number
  can_assign: boolean
  unread_count: number
}

export interface MemberActiveTask {
  id: number
  title: string
  project_title: string
  project_id: number
  status: string
  deadline: string | null
}

export interface MemberActivity {
  id: number
  action: string
  details: string
  created_at: string
}

export class MemberService extends BaseService {
  async list(currentUserId?: number): Promise<MemberProfile[]> {
    const result = await this.db.execute(sql`
      SELECT
        u.id, u.name, u.email, u.avatar, u.is_manager,
        u.role_id, r.name AS role_name,
        u.frozen_at,
        COALESCE(
          (SELECT COUNT(*) FROM subtask_assignees sa
           JOIN subtasks s ON sa.subtask_id = s.id
           WHERE sa.user_id = u.id AND s.status IN ('open', 'in_progress', 'deferred')),
          0
        ) AS active_tasks,
        COALESCE(
          (SELECT COUNT(*) FROM warnings w WHERE w.user_id = u.id AND w.status = 'pending'),
          0
        ) AS warnings_count,
        COALESCE(
          (SELECT COUNT(*) FROM project_members pm WHERE pm.user_id = u.id),
          0
        ) AS projects_count,
        COALESCE(
          EXISTS (
            SELECT 1 FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = u.role_id
            AND p.key IN ('tasks.assign', 'subtasks.assign', 'projects.assign')
          ),
          false
        ) AS can_assign,
        COALESCE(
          (SELECT COUNT(*) FROM notifications n
           WHERE n.from_user_id = u.id AND n.user_id = ${currentUserId ?? 0} AND n.read = 0),
          0
        ) AS unread_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.status = 'active'
      ORDER BY u.name
    `)

    return (result as any).rows as MemberProfile[]
  }

  async getActiveTasks(userId: number): Promise<MemberActiveTask[]> {
    const result = await this.db.execute(sql`
      SELECT DISTINCT ON (s.id)
        s.id, s.title, s.status, s.deadline,
        p.title AS project_title, p.id AS project_id
      FROM subtask_assignees sa
      JOIN subtasks s ON sa.subtask_id = s.id
      JOIN tasks t ON s.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE sa.user_id = ${userId}
        AND s.status IN ('open', 'in_progress', 'deferred')
      ORDER BY s.id, s.created_at DESC
    `)

    return (result as any).rows as MemberActiveTask[]
  }

  async getActivity(userId: number, limit = 10): Promise<MemberActivity[]> {
    const result = await this.db.execute(sql`
      SELECT id, action, details, created_at
      FROM activity_logs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `)

    return (result as any).rows as MemberActivity[]
  }
}
