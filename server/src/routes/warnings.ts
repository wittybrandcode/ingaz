import { Router } from 'express'
import { ROLES } from '../constants.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate, createWarningTypeSchema, updateWarningTypeSchema, createWarningSchema, respondWarningSchema } from '../validation.js'
import { warningService, AppError } from '../services/index.js'
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

// Warning Types
router.get('/types', authenticate, authorize(ROLES.ADMIN), async (req: any, res: any) => {
  res.success(await warningService.listWarningTypes())
})

router.post('/types', authenticate, authorize(ROLES.ADMIN), validate(createWarningTypeSchema), tryCatch(async (req, res) => {
  const wt = await warningService.createWarningType(req.body)
  res.success(wt, 201)
}))

router.put('/types/:id', authenticate, authorize(ROLES.ADMIN), validate(updateWarningTypeSchema), tryCatch(async (req, res) => {
  res.success(await warningService.updateWarningType(Number(req.params.id), req.body))
}))

router.delete('/types/:id', authenticate, authorize(ROLES.ADMIN), async (req: any, res: any) => {
  res.success(await warningService.deleteWarningType(Number(req.params.id)))
})

// Restriction Levels
router.get('/levels', authenticate, authorize(ROLES.ADMIN), async (req: any, res: any) => {
  res.success(await warningService.listLevels())
})

router.put('/levels/:id', authenticate, authorize(ROLES.ADMIN), tryCatch(async (req, res) => {
  res.success(await warningService.updateLevel(Number(req.params.id), req.body))
}))

// Credit Scores
router.get('/credit-scores', authenticate, authorize(ROLES.ADMIN), async (req: any, res: any) => {
  const result = await warningService.listCreditScores(parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

// My Level
router.get('/my-level', authenticate, async (req: any, res: any) => {
  res.success(await warningService.getMyLevel(req.user.id))
})

// Main warnings
router.get('/', authenticate, authorize(ROLES.ADMIN, ROLES.DEPUTY), async (req: any, res: any) => {
  const result = await warningService.list(parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

router.get('/my', authenticate, async (req: any, res: any) => {
  const result = await warningService.listMy(req.user.id, parseInt(String(req.query.page)) || 1, parseInt(String(req.query.pageSize)))
  res.set('X-Total-Count', String(result.total))
  res.set('X-Total-Pages', String(result.pages))
  res.set('X-Page', String(result.page))
  res.set('X-Page-Size', String(result.pageSize))
  res.success(result.data)
})

router.post('/', authenticate, authorize(ROLES.ADMIN, ROLES.DEPUTY), validate(createWarningSchema), tryCatch(async (req, res) => {
  const warning = await warningService.create(req.body, ctx(req))
  res.success(warning, 201)
}))

router.put('/:id/respond', authenticate, validate(respondWarningSchema), tryCatch(async (req, res) => {
  const result = await warningService.respond(Number(req.params.id), req.body.response_text, ctx(req))
  res.success(result)
}))

router.put('/:id/clear', authenticate, authorize(ROLES.ADMIN, ROLES.DEPUTY), tryCatch(async (req, res) => {
  const result = await warningService.clear(Number(req.params.id), ctx(req))
  res.success(result)
}))

router.put('/:id/sustain', authenticate, authorize(ROLES.ADMIN, ROLES.DEPUTY), tryCatch(async (req, res) => {
  const result = await warningService.sustain(Number(req.params.id), ctx(req))
  res.success(result)
}))

router.get('/freeze/status', authenticate, async (req: any, res: any) => {
  res.success(await warningService.getFreezeStatus(req.user.id))
})

router.put('/unfreeze/:userId', authenticate, authorize(ROLES.ADMIN), tryCatch(async (req, res) => {
  const result = await warningService.unfreeze(Number(req.params.userId), ctx(req))
  res.success(result)
}))

export default router
