import { Router } from 'express'
import multer from 'multer'
import path from 'path'
const uploadsDir = path.join(process.cwd(), 'uploads')
import { authenticate } from '../middleware/auth.js'
import { validate, loginSchema, updateProfileSchema } from '../validation.js'
import { authService, AppError } from '../services/index.js'

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const name = 'avatar-' + Date.now() + path.extname(file.originalname)
    cb(null, name)
  }
})
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowed.includes(file.mimetype)) return cb(null, true)
    cb(new Error('يُسمح فقط بملفات الصور: jpeg, png, webp, gif'))
  }
})

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

router.post('/login', validate(loginSchema), tryCatch(async (req, res) => {
  const { user, token } = await authService.login(req.body.email, req.body.password, req.app.get('io'))
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  })
  res.success({ user, token })
}))

router.get('/me', authenticate, tryCatch(async (req, res) => {
  const user = await authService.me(req.user.id)
  res.success(user)
}))

router.put('/profile', authenticate, validate(updateProfileSchema), tryCatch(async (req, res) => {
  const result = await authService.updateProfile(req.user.id, req.body, req.app.get('io'))
  res.success(result)
}))

router.post('/avatar', authenticate, uploadAvatar.single('avatar'), tryCatch(async (req, res) => {
  if (!req.file) return res.fail(400, 'لم يتم رفع ملف')
  const result = await authService.updateAvatar(req.user.id, req.file.filename)
  res.success(result)
}))

router.post('/logout', authenticate, (req: any, res: any) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]
  authService.logout(token)
  res.clearCookie('token', { path: '/' })
  res.success({ message: 'تم تسجيل الخروج' })
})

export default router
