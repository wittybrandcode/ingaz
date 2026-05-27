import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { memberService, AppError } from '../services/index.js'
import { onlineUsers } from '../lib/onlineUsers.js'

const router = Router()

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

router.get('/', authenticate, tryCatch(async (req: any, res: any) => {
  const result = await memberService.list(req.user.id)
  const withOnline = result.map(m => ({ ...m, online: onlineUsers.has(m.id) }))
  res.success(withOnline)
}))

router.get('/:id/tasks', authenticate, tryCatch(async (req: any, res: any) => {
  const id = Number(req.params.id)
  if (!id || isNaN(id)) return res.fail(400, 'معرف غير صالح')
  const result = await memberService.getActiveTasks(id)
  res.success(result)
}))

router.get('/:id/activity', authenticate, tryCatch(async (req: any, res: any) => {
  const id = Number(req.params.id)
  if (!id || isNaN(id)) return res.fail(400, 'معرف غير صالح')
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10))
  const result = await memberService.getActivity(id, limit)
  res.success(result)
}))

export default router
