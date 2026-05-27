import { Router } from 'express'
import { authenticate, authorizePermission, requireCredit, checkFrozen } from '../middleware/auth.js'
import { validate, createTaskSchema, updateTaskSchema } from '../validation.js'
import { taskService, AppError } from '../services/index.js'
import type { ServiceContext } from '../services/index.js'

const router = Router()

function ctx(req: any): ServiceContext {
  return { userId: req.user.id, roleId: req.user.role_id, isManager: req.user.is_manager, userName: req.user.name, userAvatar: req.user.avatar, io: req.app.get('io') }
}

function tryCatch(handler: (req: any, res: any) => any) {
  return (req: any, res: any, next: any) => {
    try {
      const result = handler(req, res)
      if (result instanceof Promise) result.catch(e => {
        if (e instanceof AppError) return res.fail(e.statusCode, e.message)
        next(e)
      })
    } catch (e) {
      if (e instanceof AppError) return res.fail(e.statusCode, e.message)
      next(e)
    }
  }
}

router.get('/', authenticate, async (req: any, res: any) => {
  const result = await taskService.list(parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

router.get('/project/:projectId', authenticate, async (req: any, res: any) => {
  const result = await taskService.listByProject(Number(req.params.projectId), parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

router.post('/', authenticate, checkFrozen, requireCredit('canCreateTasks'), validate(createTaskSchema), tryCatch(async (req, res) => {
  const task = await taskService.create(req.body, ctx(req))
  res.success(task, 201)
}))

router.put('/:id', authenticate, authorizePermission('tasks.edit'), checkFrozen, validate(updateTaskSchema), tryCatch(async (req, res) => {
  const task = await taskService.update(Number(req.params.id), req.body, ctx(req))
  res.success(task)
}))

router.delete('/:id', authenticate, authorizePermission('tasks.delete'), checkFrozen, tryCatch(async (req, res) => {
  const result = await taskService.archive(Number(req.params.id), ctx(req))
  res.success(result)
}))

router.get('/:id/assignees', authenticate, async (req: any, res: any) => {
  res.success(await taskService.getAssignees(Number(req.params.id)))
})

router.post('/:id/assignees', authenticate, authorizePermission('tasks.assign'), checkFrozen, tryCatch(async (req, res) => {
  if (!req.body.user_id) return res.fail(400, 'يجب تحديد المستخدم')
  const assignee = await taskService.addAssignee(Number(req.params.id), req.body.user_id, ctx(req))
  res.success(assignee, 201)
}))

router.delete('/:id/assignees/:userId', authenticate, authorizePermission('tasks.assign'), checkFrozen, tryCatch(async (req, res) => {
  const result = await taskService.removeAssignee(Number(req.params.id), Number(req.params.userId), ctx(req))
  res.success(result)
}))

export default router
