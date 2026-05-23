import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { memberService } from '../services/index.js'

const router = Router()

router.get('/', authenticate, async (_req: any, res: any) => {
  const result = await memberService.list()
  res.success(result)
})

export default router
