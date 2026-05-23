import { Router } from 'express'
import { authenticate, requireManager } from '../middleware/auth.js'
import { analyticsService } from '../services/index.js'

const router = Router()

router.get('/dashboard', authenticate, requireManager, async (req, res) => {
  res.success(await analyticsService.dashboard())
})

export default router
