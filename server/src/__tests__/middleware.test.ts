import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { createTestDb, seedUser } from './helpers.js'
import { ROLES } from '../constants.js'

process.env.JWT_SECRET = 'test-jwt-secret-for-middleware-tests'

const mockState = vi.hoisted(() => ({ db: null as any }))

vi.mock('../db/index.js', async () => {
  const schema = await import('./test-schema.js')
  return {
    schema,
    addActivityLog: vi.fn(),
    isProjectManager: vi.fn().mockReturnValue(false),
    getTaskAssignees: vi.fn().mockReturnValue([]),
    getSubtaskAssignees: vi.fn().mockReturnValue([]),
    getBulkSubtaskAssignees: vi.fn().mockReturnValue({}),
    getUserPermissions: vi.fn().mockResolvedValue([]),
    getDb: vi.fn(() => mockState.db),
    uploadsDir: '/test/uploads',
  }
})

import {
  authenticate,
  authorize,
  checkFrozen,
  requireCredit,
  isBlacklisted,
  blacklistToken,
  generateToken,
  clearFrozenCache,
} from '../middleware/auth.js'

function mockReq(overrides: Record<string, any> = {}): any {
  const req: Record<string, any> = {
    cookies: {},
    headers: {},
    user: null,
    ...overrides,
  }
  return req
}

function mockRes(): any {
  const res: Record<string, any> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    success: vi.fn().mockReturnThis(),
  }
  return res
}

function mockNext(): any {
  return vi.fn()
}

beforeEach(() => {
  mockState.db = createTestDb()
})

describe('authenticate', () => {
  it('returns 401 when no token provided', async () => {
    const req = mockReq()
    const res = mockRes()
    const next = mockNext()

    await authenticate(req, res, next)

    expect(res.fail).toHaveBeenCalledWith(401, 'رمز التوكن غير موجود')
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 with invalid token', async () => {
    const req = mockReq({ headers: { authorization: 'Bearer invalid-token' } })
    const res = mockRes()
    const next = mockNext()

    await authenticate(req, res, next)

    expect(res.fail).toHaveBeenCalledWith(401, 'رمز التوكن غير صالح')
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() with valid token', async () => {
    const token = generateToken({ id: 1, email: 'test@test.com', name: 'Test', avatar: null, role_id: ROLES.ADMIN, is_manager: 0 })
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    const next = mockNext()

    await authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.fail).not.toHaveBeenCalled()
    expect(req.user).toBeDefined()
  })

  it('returns 401 when token is blacklisted', async () => {
    const token = generateToken({ id: 1, email: 'test@test.com', name: 'Test', avatar: null, role_id: ROLES.ADMIN, is_manager: 0 })
    blacklistToken(token)

    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    const next = mockNext()

    await authenticate(req, res, next)

    expect(res.fail).toHaveBeenCalledWith(401, 'رمز التوكن ملغي')
    expect(next).not.toHaveBeenCalled()
  })
})

describe('authorize', () => {
  it('returns 403 when role not in allowed list', async () => {
    const req = mockReq({ user: { id: 1, role_id: 3, is_manager: 0 } })
    const res = mockRes()
    const next = mockNext()

    const middleware = authorize(ROLES.ADMIN)
    await middleware(req, res, next)

    expect(res.fail).toHaveBeenCalledWith(403, 'صلاحيات غير كافية')
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() when role is allowed', async () => {
    const req = mockReq({ user: { id: 1, role_id: ROLES.ADMIN, is_manager: 0 } })
    const res = mockRes()
    const next = mockNext()

    const middleware = authorize(ROLES.ADMIN)
    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.fail).not.toHaveBeenCalled()
  })
})

describe('checkFrozen', () => {
  it('returns 403 when user is frozen', async () => {
    seedUser(mockState.db, { id: 11, frozen_at: '2024-01-01T00:00:00.000Z' })
    clearFrozenCache(11)

    const req = mockReq({ user: { id: 11 } })
    const res = mockRes()
    const next = mockNext()

    await checkFrozen(req, res, next)

    expect(res.fail).toHaveBeenCalledWith(403, 'الحساب مجمد')
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() when user is not frozen', async () => {
    seedUser(mockState.db, { id: 10, frozen_at: null })
    clearFrozenCache(10)

    const req = mockReq({ user: { id: 10 } })
    const res = mockRes()
    const next = mockNext()

    await checkFrozen(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.fail).not.toHaveBeenCalled()
  })
})

describe('requireCredit', () => {
  it('returns 403 when user lacks the required credit permission', async () => {
    seedUser(mockState.db, { id: 21, credit_score: 4 })
    clearFrozenCache(21)

    const req = mockReq({ user: { id: 21 } })
    const res = mockRes()
    const next = mockNext()

    const middleware = requireCredit('canCreateProjects')
    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'حسابك مقيد من تنفيذ هذا الإجراء' })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() when user has the credit permission', async () => {
    seedUser(mockState.db, { id: 20, credit_score: 10 })
    clearFrozenCache(20)

    const req = mockReq({ user: { id: 20 } })
    const res = mockRes()
    const next = mockNext()

    const middleware = requireCredit('canCreateProjects')
    await middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalledWith(403)
  })
})

describe('isBlacklisted', () => {
  it('returns false for non-blacklisted tokens', async () => {
    const token = generateToken({ id: 1, email: 'a@b.com', name: 'A', avatar: null, role_id: 2, is_manager: 0 })

    const result = await isBlacklisted(token)

    expect(result).toBe(false)
  })

  it('returns true for blacklisted tokens', async () => {
    const token = generateToken({ id: 1, email: 'a@b.com', name: 'A', avatar: null, role_id: 2, is_manager: 0 })
    blacklistToken(token)

    const result = await isBlacklisted(token)

    expect(result).toBe(true)
  })
})
