import type { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  status?: number
  code?: string
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500
  const message = err.message || 'Internal server error'

  if (status === 500) {
    console.error('[ErrorHandler]', err, 'Request ID:', (req as any).id)
  }

  res.status(status).json({ success: false, error: message })
}

export function createError(status: number, message: string): AppError {
  const err: AppError = new Error(message)
  err.status = status
  return err
}
