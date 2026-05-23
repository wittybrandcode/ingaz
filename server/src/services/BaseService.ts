export class AppError extends Error {
  statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
  }
}

export interface ServiceContext {
  userId: number
  roleId: number
  isManager: number
  userName?: string
  userAvatar?: string | null
  io?: import('socket.io').Server | null
}

export class BaseService {
  db: any

  constructor(db: any) {
    this.db = db
  }
}
