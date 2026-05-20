import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validate, createCommentSchema } from '../validation.js'
import { commentService, AppError } from '../services/index.js'
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

router.get('/:subtaskId', authenticate, async (req: any, res: any) => {
  res.success(await commentService.getBySubtask(Number(req.params.subtaskId)))
})

router.post('/', authenticate, validate(createCommentSchema), tryCatch(async (req, res) => {
  const comment = await commentService.create(req.body, ctx(req))
  res.success(comment, 201)
}))

router.post('/:id/select-winner', authenticate, tryCatch(async (req, res) => {
  const result = await commentService.selectWinner(Number(req.params.id), ctx(req))
  res.success(result)
}))

export default router
