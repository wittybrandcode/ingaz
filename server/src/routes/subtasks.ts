import { Router } from 'express'
import { ROLES } from '../constants.js'
import { authenticate, authorize, authorizePermission, requireCredit, checkFrozen } from '../middleware/auth.js'
import { validate, createSubtaskSchema, updateSubtaskSchema } from '../validation.js'
import { subtaskService, AppError } from '../services/index.js'
import type { ServiceContext } from '../services/index.js'

const router = Router()

function ctx(req: any): ServiceContext {
  return { userId: req.user.id, roleId: req.user.role_id, userName: req.user.name, userAvatar: req.user.avatar, io: req.app.get('io') }
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
  const result = await subtaskService.list(parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

router.get('/task/:taskId', authenticate, async (req: any, res: any) => {
  const result = await subtaskService.listByTask(Number(req.params.taskId), parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

router.get('/:id', authenticate, tryCatch(async (req, res) => {
  const subtask = await subtaskService.getById(Number(req.params.id))
  res.success(subtask)
}))

router.post('/', authenticate, checkFrozen, requireCredit('canCreateTasks'), validate(createSubtaskSchema), tryCatch(async (req, res) => {
  const subtask = await subtaskService.create(req.body, ctx(req))
  res.success(subtask, 201)
}))

router.put('/:id', authenticate, checkFrozen, validate(updateSubtaskSchema), tryCatch(async (req, res) => {
  const subtask = await subtaskService.update(Number(req.params.id), req.body, ctx(req))
  res.success(subtask)
}))

router.delete('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.DEPUTY), tryCatch(async (req, res) => {
  const result = await subtaskService.delete(Number(req.params.id), ctx(req))
  res.success(result)
}))

router.get('/:id/assignees', authenticate, async (req: any, res: any) => {
  res.success(await subtaskService.getAssignees(Number(req.params.id)))
})

router.post('/:id/assignees', authenticate, authorizePermission('subtasks.assign'), tryCatch(async (req, res) => {
  if (!req.body.user_id) return res.fail(400, 'يجب تحديد المستخدم')
  const assignee = await subtaskService.addAssignee(Number(req.params.id), req.body.user_id, ctx(req))
  res.success(assignee, 201)
}))

router.delete('/:id/assignees/:userId', authenticate, authorizePermission('subtasks.assign'), tryCatch(async (req, res) => {
  const result = await subtaskService.removeAssignee(Number(req.params.id), Number(req.params.userId), ctx(req))
  res.success(result)
}))

export default router
