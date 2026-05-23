import { Router } from 'express'
import { authenticate, requireManager, authorizePermission, requireCredit, checkFrozen } from '../middleware/auth.js'
import { validate, createProjectSchema, updateProjectSchema } from '../validation.js'
import { projectService, AppError } from '../services/index.js'
import type { ServiceContext } from '../services/index.js'

const router = Router()

function ctx(req: any): ServiceContext {
  return { userId: req.user.id, roleId: req.user.role_id, isManager: req.user.is_manager, userName: req.user.name, userAvatar: req.user.avatar, io: req.app.get('io') }
}

function tryCatch(handler: (req: any, res: any) => Promise<any> | any) {
  return (req: any, res: any, next: any) => {
    try {
      const result = handler(req, res)
      if (result instanceof Promise) result.catch((e) => {
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
  const result = await projectService.list(parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

router.post('/', authenticate, checkFrozen, authorizePermission('projects.create'), requireCredit('canCreateProjects'), validate(createProjectSchema), tryCatch(async (req, res) => {
  const project = await projectService.create(req.body, ctx(req))
  res.success(project, 201)
}))

router.put('/:id', authenticate, checkFrozen, authorizePermission('projects.edit'), validate(updateProjectSchema), tryCatch(async (req, res) => {
  const project = await projectService.update(Number(req.params.id), req.body, ctx(req))
  res.success(project)
}))

router.get('/:id', authenticate, tryCatch(async (req, res) => {
  const project = await projectService.getById(Number(req.params.id))
  res.success(project)
}))

router.get('/:id/members', authenticate, async (req: any, res: any) => {
  res.success(await projectService.getMembers(Number(req.params.id)))
})

router.post('/:id/members', authenticate, authorizePermission('projects.assign'), tryCatch(async (req, res) => {
  if (!req.body.user_id) return res.fail(400, 'يجب تحديد المستخدم')
  const member = await projectService.addMember(Number(req.params.id), req.body.user_id, ctx(req))
  res.success(member, 201)
}))

router.delete('/:id/members/:userId', authenticate, authorizePermission('projects.assign'), tryCatch(async (req, res) => {
  const result = await projectService.removeMember(Number(req.params.id), Number(req.params.userId))
  res.success(result)
}))

router.post('/:id/archive', authenticate, requireManager, tryCatch(async (req, res) => {
  const result = await projectService.archive(Number(req.params.id), ctx(req))
  res.success(result)
}))

router.delete('/:id/permanent', authenticate, requireManager, tryCatch(async (req, res) => {
  const result = await projectService.permanentDelete(Number(req.params.id), ctx(req))
  res.success(result)
}))

export default router
