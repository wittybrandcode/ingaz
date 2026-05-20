import { Router } from 'express'
import { ROLES } from '../constants.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { analyticsService } from '../services/index.js'

const router = Router()

router.get('/dashboard', authenticate, authorize(ROLES.ADMIN, ROLES.DEPUTY), async (req, res) => {
  res.success(await analyticsService.dashboard())
})

export default router
