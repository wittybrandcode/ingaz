import { Router } from 'express'
import { authenticate, requireManager, authorizePermission } from '../middleware/auth.js'
import { validate, createRoleSchema, updateRoleSchema, updateRolePermissionsSchema } from '../validation.js'
import { roleService, AppError } from '../services/index.js'

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

router.get('/', authenticate, authorizePermission('roles.view'), async (req: any, res: any) => {
  res.success(await roleService.list())
})

router.post('/', authenticate, requireManager, validate(createRoleSchema), tryCatch(async (req, res) => {
  const role = await roleService.create(req.body)
  res.success(role, 201)
}))

router.put('/:id', authenticate, requireManager, validate(updateRoleSchema), tryCatch(async (req, res) => {
  res.success(await roleService.update(Number(req.params.id), req.body))
}))

router.delete('/:id', authenticate, requireManager, tryCatch(async (req, res) => {
  res.success(await roleService.delete(Number(req.params.id)))
}))

router.get('/:id/permissions', authenticate, requireManager, async (req: any, res: any) => {
  res.success(await roleService.getPermissions(Number(req.params.id)))
})

router.put('/:id/permissions', authenticate, requireManager, validate(updateRolePermissionsSchema), tryCatch(async (req, res) => {
  res.success(await roleService.updatePermissions(Number(req.params.id), req.body.permissions))
}))

router.get('/permissions/list', authenticate, async (req: any, res: any) => {
  res.success(await roleService.listAllPermissions())
})

export default router
