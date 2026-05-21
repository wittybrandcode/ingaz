import { describe, it, expect, vi } from 'vitest'
import { createTestDb, seedUser } from './helpers.js'
import { AuthService } from '../services/AuthService.js'

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
    getDb: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    })),
    uploadsDir: '/test/uploads',
  }
})

vi.mock('../notify.js', () => ({
  setDefaultPrefs: vi.fn(),
  parseMentions: vi.fn().mockResolvedValue(''),
}))

describe('AuthService', () => {
  it('login with valid credentials returns user and token', async () => {
    const db = await createTestDb()
    seedUser(db, { id: 1, name: 'Admin', email: 'admin@test.com', role_id: 1 })
    const service = new AuthService(db)

    const result = await service.login('admin@test.com', 'password123')

    expect(result.user).toBeDefined()
    expect(result.token).toBeDefined()
    expect(result.user.email).toBe('admin@test.com')
    expect(result.user.name).toBe('Admin')
    expect(result.user.password).toBeUndefined()
    expect(result.token.split('.')).toHaveLength(3)
  })

  it('login with wrong password throws 401', async () => {
    const db = await createTestDb()
    seedUser(db, { id: 1, email: 'user@test.com', role_id: 3 })
    const service = new AuthService(db)

    await expect(service.login('user@test.com', 'wrongpass')).rejects.toThrow('بيانات الدخول غير صحيحة')
  })

  it('login with non-existent email throws 401', async () => {
    const db = await createTestDb()
    const service = new AuthService(db)

    await expect(service.login('nobody@test.com', 'password123')).rejects.toThrow('بيانات الدخول غير صحيحة')
  })

  it('me returns user data for valid id', async () => {
    const db = await createTestDb()
    seedUser(db, { id: 5, name: 'Alice', email: 'alice@test.com', role_id: 3 })
    const service = new AuthService(db)

    const result = await service.me(5)
    expect(result.id).toBe(5)
    expect(result.name).toBe('Alice')
    expect(result.email).toBe('alice@test.com')
  })

  it('me throws 404 for invalid id', async () => {
    const db = await createTestDb()
    const service = new AuthService(db)

    await expect(service.me(999)).rejects.toThrow('المستخدم غير موجود')
  })

  it('login with inactive user still returns data', async () => {
    const db = await createTestDb()
    seedUser(db, { id: 1, name: 'Inactive', email: 'inactive@test.com', role_id: 3, status: 'inactive' })
    const service = new AuthService(db)

    const result = await service.login('inactive@test.com', 'password123')
    expect(result.user).toBeDefined()
    expect(result.user.status).toBe('inactive')
  })
})
