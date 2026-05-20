import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { fileTypeFromFile } from 'file-type'
import { authenticate } from '../middleware/auth.js'
const uploadsDir = path.join(process.cwd(), 'uploads')
import { validate, uploadSchema } from '../validation.js'
import { uploadService, AppError } from '../services/index.js'
import type { ServiceContext } from '../services/index.js'

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    cb(null, crypto.randomUUID() + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|zip|rar|txt/
    const ext = allowed.test(path.extname(file.originalname).toLowerCase())
    cb(null, ext || file.mimetype.startsWith('image/'))
  }
})

const router = Router()

function ctx(req: any): ServiceContext {
  return { userId: req.user.id, roleId: req.user.role_id, userName: req.user.name, userAvatar: req.user.avatar, io: req.app.get('io') }
}

router.post('/', authenticate, upload.array('files', 10), validate(uploadSchema), async (req: any, res: any, next: any) => {
  try {
    const { entity_type, entity_id } = req.body
    const files = req.files as any[] | undefined
    for (const file of files || []) {
      if (file.path) {
        const type = await fileTypeFromFile(file.path)
        if (type && !['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(type.mime)) {
          fs.unlinkSync(file.path)
          return res.fail(400, `نوع الملف ${type.mime} غير مسموح`)
        }
      }
    }
    const inserted = await uploadService.upload(entity_type, Number(entity_id), files || [], ctx(req))
    res.success(inserted, 201)
  } catch (err) {
    if (err instanceof AppError) return res.fail(err.statusCode, err.message)
    next(err)
  }
})

router.get('/', authenticate, async (req: any, res: any) => {
  const { entity_type, entity_id, entity_ids, groupBy } = req.query

  if (entity_type && entity_ids) {
    const ids = String(entity_ids).split(',').map(Number).filter(Boolean)
    return res.success(await uploadService.getFilesBulk(String(entity_type), ids, groupBy === 'true'))
  }

  if (entity_type && entity_id) {
    return res.success(await uploadService.getFiles(String(entity_type), Number(entity_id)))
  }

  res.fail(400, 'يجب تحديد entity_type مع entity_id أو entity_ids')
})

router.delete('/:id', authenticate, async (req: any, res: any, next: any) => {
  try {
    const result = await uploadService.deleteFile(Number(req.params.id), ctx(req))
    res.success(result)
  } catch (err) {
    if (err instanceof AppError) return res.fail(err.statusCode, err.message)
    next(err)
  }
})

export default router
