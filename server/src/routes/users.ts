import { Router } from 'express'
import { ROLES } from '../constants.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate, createUserSchema, updateUserSchema } from '../validation.js'
import { userService, AppError } from '../services/index.js'
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
  const result = await userService.list(parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)), String(req.query.archived) === '1')
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

router.post('/', authenticate, authorize(ROLES.ADMIN), validate(createUserSchema), tryCatch(async (req, res) => {
  const user = await userService.create(req.body, ctx(req))
  res.success(user, 201)
}))

router.put('/:id', authenticate, authorize(ROLES.ADMIN), validate(updateUserSchema), tryCatch(async (req, res) => {
  const result = await userService.update(Number(req.params.id), req.body, ctx(req))
  res.success(result)
}))

router.delete('/:id', authenticate, authorize(ROLES.ADMIN), tryCatch(async (req, res) => {
  const result = await userService.archive(Number(req.params.id), ctx(req))
  res.success(result)
}))

router.put('/:id/restore', authenticate, authorize(ROLES.ADMIN), tryCatch(async (req, res) => {
  const result = await userService.restore(Number(req.params.id), ctx(req))
  res.success(result)
}))

export default router
