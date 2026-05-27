import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { validate, updateNotificationPrefSchema } from '../validation.js'
import { notificationService, AppError } from '../services/index.js'

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
  const result = await notificationService.list(req.user.id, parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
}))

router.get('/unread', authenticate, tryCatch(async (req: any, res: any) => {
  res.success(await notificationService.unreadCount(req.user.id))
}))

router.put('/:id/read', authenticate, tryCatch(async (req: any, res: any) => {
  res.success(await notificationService.markRead(Number(req.params.id), req.user.id))
}))

router.put('/read-all', authenticate, tryCatch(async (req: any, res: any) => {
  res.success(await notificationService.markAllRead(req.user.id))
}))

router.get('/preferences', authenticate, tryCatch(async (req: any, res: any) => {
  res.success(await notificationService.getPreferences(req.user.id))
}))

router.put('/preferences/:typeKey', authenticate, validate(updateNotificationPrefSchema), tryCatch(async (req: any, res: any) => {
  res.success(await notificationService.updatePreference(req.user.id, req.params.typeKey, req.body))
}))

router.get('/daily-summary', authenticate, tryCatch(async (req: any, res: any) => {
  res.success(await notificationService.dailySummary(req.user.id))
}))

router.put('/types/batch', authenticate, tryCatch(async (req: any, res: any) => {
  res.success(await notificationService.updateBatchTypes(req.user.id, req.body.types))
}))

export default router
