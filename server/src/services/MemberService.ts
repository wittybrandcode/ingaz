import { eq, sql, and, count } from 'drizzle-orm'
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
}

export class MemberService extends BaseService {
  async list(): Promise<MemberProfile[]> {
    const rows = await this.db.execute(sql`
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
            WHERE rp.role_id = u.role_id
            AND rp.permission_key IN ('tasks.assign', 'subtasks.assign', 'projects.assign')
          ),
          false
        ) AS can_assign
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.status = 'active' AND COALESCE(u.is_manager, 0) = 0
      ORDER BY u.name
    `)

    return rows as unknown as MemberProfile[]
  }
}
