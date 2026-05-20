import type { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export function requestId(req: Request, _res: Response, next: NextFunction) {
  req.id = crypto.randomUUID()
  next()
}

declare module 'express-serve-static-core' {
  interface Request {
    id: string
  }
}
