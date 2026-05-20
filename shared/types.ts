// Core data types shared between client and server

export interface User {
  id: number
  name: string
  email: string
  role_id: number
  role_name: string
  avatar: string | null
  status: string
  frozen_at?: string | null
  freeze_reason?: string | null
  credit_score?: number
  warnings?: number
}

export interface Project {
  id: number
  title: string
  description: string | null
  created_by: number
  created_by_name: string
  created_by_avatar: string | null
  status: 'active' | 'completed' | 'archived'
  tasks_count: number
  subtasks_count?: number
  completed_count?: number
  created_at: string
  members?: { name: string; avatar?: string | null }[]
}

export interface ProjectMember {
  id: number
  project_id: number
  user_id: number
  role: 'manager' | 'member'
  name: string
  email: string
  avatar: string | null
  role_id: number
  role_name: string
  created_at: string
}

export interface Assignee {
  id: number
  task_id?: number
  subtask_id?: number
  user_id: number
  assigned_by: number | null
  name: string
  email: string
  avatar: string | null
  role_id: number
  role_name: string
  created_at: string
}

export interface ProjectDetail extends Project {
  tasks: Task[]
  members: ProjectMember[]
}

export interface Task {
  id: number
  title: string
  description: string | null
  project_id?: number
  subtasks_count: number
  completed_count: number
  created_at: string
  created_by_name?: string
  created_by_avatar?: string | null
  status: 'active' | 'open' | 'in_progress' | 'completed' | 'archived'
  assignees?: { name: string; avatar?: string | null }[]
}

export interface Subtask {
  id: number
  task_id: number
  title: string
  description: string | null
  assigned_to: number | null
  assigned_to_name: string | null
  assigned_to_avatar: string | null
  assignees?: Assignee[]
  status: 'open' | 'completed' | 'cancelled' | 'deferred'
  deadline: string | null
  winner_comment_id?: number | null
  created_at: string
}

export interface Comment {
  id: number
  subtask_id: number
  user_id: number
  content: string
  user_name?: string
  user_avatar?: string | null
  is_winner?: number
  winner_selected_at?: string | null
  winner_selected_by?: number | null
  created_at: string
}

export interface Attachment {
  id: number
  filename: string
  original_name: string
  mime_type: string
  file_size: number
  uploaded_by?: number
  created_at: string
  entity_type?: string
  entity_id?: number
  subtask_id?: number
}

export interface Warning {
  id: number
  user_id: number
  issued_by: number
  reason: string
  status: string
  response_text: string | null
  responded_at: string | null
  cleared_at: string | null
  deadline: string
  created_at: string
  user_name: string
  user_avatar?: string | null
  issued_by_name: string
  issued_by_avatar?: string | null
  warning_type_name?: string
  points_deducted?: number
  credit_before?: number
  credit_after?: number
}

export interface WarningType {
  id: number
  name: string
  description?: string
  points: number
  is_active: number
}

export interface RestrictionLevel {
  id: number
  name: string
  name_ar: string
  min_score: number
  color: string
  icon: string
  show_banner: number
  can_login: number
  can_create_projects: number
  can_create_tasks: number
  can_edit: number
  can_assign: number
  can_submit: number
  can_comment: number
  sort_order: number
}

export interface Role {
  id: number
  name: string
  permissions?: string[]
}

export interface Notification {
  id: number
  user_id: number
  title: string
  message: string
  type: string
  read: number
  related_type: string | null
  related_id: number | null
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  related: any
}

export interface DashboardData {
  counts: { projects: number; tasks: number; subtasks: number; users: number }
  status_distribution: { status: string; count: number }[]
  recent_activity: { id: number; user_name: string; action: string; details: string; created_at: string; user_avatar?: string | null }[]
  project_progress: { id: number; title: string; total_subtasks: number; completed_subtasks: number }[]
  tasks_by_user: { id: number; name: string; total: number; completed: number; avatar?: string | null }[]
}

export const ROLES_VALUES = {
  ADMIN: 1,
  DEPUTY: 2,
  EMPLOYEE: 3,
} as const

export const ROLES = ROLES_VALUES

export const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  completed: 'منفذة',
  cancelled: 'ملغية',
  deferred: 'مؤجلة',
  in_progress: 'قيد التنفيذ',
  active: 'نشط',
  archived: 'مؤرشف',
}
