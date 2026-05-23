import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { memberService, AppError } from '../services/index.js'

const router = Router()

router.get('/', authenticate, async (_req: any, res: any) => {
  const result = await memberService.list()
  res.success(result)
})

router.get('/:id/tasks', authenticate, async (req: any, res: any) => {
  const id = Number(req.params.id)
  if (!id || isNaN(id)) return res.fail(400, 'معرف غير صالح')
  try {
    const result = await memberService.getActiveTasks(id)
    res.success(result)
  } catch (e: any) {
    if (e instanceof AppError) return res.fail(e.statusCode, e.message)
    throw e
  }
})

router.get('/:id/activity', authenticate, async (req: any, res: any) => {
  const id = Number(req.params.id)
  if (!id || isNaN(id)) return res.fail(400, 'معرف غير صالح')
  try {
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10))
    const result = await memberService.getActivity(id, limit)
    res.success(result)
  } catch (e: any) {
    if (e instanceof AppError) return res.fail(e.statusCode, e.message)
    throw e
  }
})

export default router
