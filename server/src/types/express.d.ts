export {}

declare module 'express-serve-static-core' {
  interface Response {
    success(data: any, status?: number): void
    fail(status: number, error: string): void
  }
  interface Request {
    user: {
      id: number
      email: string
      name: string
      avatar?: string | null
      role_id: number
      is_manager: number
    }
  }
}
