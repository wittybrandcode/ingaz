import { getDb } from '../db/index.js'
import { ProjectService } from './ProjectService.js'
import { TaskService } from './TaskService.js'
import { SubtaskService } from './SubtaskService.js'
import { CommentService } from './CommentService.js'
import { UserService } from './UserService.js'
import { WarningService } from './WarningService.js'
import { NotificationService } from './NotificationService.js'
import { AuthService } from './AuthService.js'
import { UploadService } from './UploadService.js'
import { RoleService } from './RoleService.js'
import { AnalyticsService } from './AnalyticsService.js'

const db = getDb()

export const projectService = new ProjectService(db)
export const taskService = new TaskService(db)
export const subtaskService = new SubtaskService(db)
export const commentService = new CommentService(db)
export const userService = new UserService(db)
export const warningService = new WarningService(db)
export const notificationService = new NotificationService(db)
export const authService = new AuthService(db)
export const uploadService = new UploadService(db)
export const roleService = new RoleService(db)
export const analyticsService = new AnalyticsService(db)

export { AppError } from './BaseService.js'
export type { ServiceContext } from './BaseService.js'
