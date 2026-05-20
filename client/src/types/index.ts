import type {
  User, Project, ProjectDetail, ProjectMember, Assignee, Task, Subtask, Attachment,
  Warning, WarningType, RestrictionLevel, Role, Notification, DashboardData,
} from '@shared/types'
export type {
  User, Project, ProjectDetail, ProjectMember, Assignee, Task, Subtask, Attachment,
  Warning, WarningType, RestrictionLevel, Role, Notification, DashboardData,
}
export { ROLES_VALUES, ROLES, STATUS_LABELS } from '@shared/types'

// Client-only types (not needed on server)

export interface AuthState {
  user: User | null; loading: boolean
  permissions: string[]
  login: (email: string, password: string) => Promise<void>
  logout: () => void; loadUser: () => Promise<void>
}

export interface SubtaskData extends Subtask {
  task: { id: number; title: string; project_id: number; project_title: string }
}

export interface CreditUser {
  id: number; name: string; email: string; avatar: string | null
  credit_score: number; frozen_at: string | null
  role_name: string; level: RestrictionLevel
}

export interface Permission {
  id: number; key: string; name: string; group_name: string; sort_order: number
}

export interface Comment {
  id: number; subtask_id: number; user_id: number; content: string
  created_at: string; user_name: string; user_avatar: string | null
  is_winner?: number; winner_selected_at?: string | null
  winner_selected_by?: number | null
}

export interface FreezeStatus {
  frozen: boolean; credit_score: number
  frozen_at?: string; freeze_reason?: string; warnings?: Warning[]
}

export interface NotifType {
  id: number; type_key: string; type_group: string
  name: string; description: string; enabled: number; channels: string[]
}
