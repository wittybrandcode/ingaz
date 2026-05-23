export { ROLES } from './types'

export const ASSIGN_REQUIRED_PERMS = [
  'projects.view', 'projects.assign', 'tasks.assign', 'subtasks.assign',
  'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete',
  'subtasks.view', 'subtasks.create', 'subtasks.edit', 'subtasks.delete',
  'subtasks.submit', 'subtasks.complete', 'subtasks.cancel', 'subtasks.defer',
  'users.view', 'roles.view', 'analytics.view', 'comments.create',
]
