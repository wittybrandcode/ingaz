import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestDb, seedUser } from './helpers.js'
import { UserService } from '../services/UserService.js'
import type { ServiceContext } from '../services/BaseService.js'

const mockAddActivityLog = vi.hoisted(() => vi.fn())
const mockSetDefaultPrefs = vi.hoisted(() => vi.fn())

vi.mock('../db/index.js', async () => {
  const schema = await import('./test-schema.js')
  return {
    schema,
    addActivityLog: mockAddActivityLog,
    getUserPermissions: vi.fn().mockResolvedValue([]),
    getDb: vi.fn(),
  }
})

vi.mock('../notify.js', () => ({
  setDefaultPrefs: mockSetDefaultPrefs,
}))

vi.mock('../middleware/auth.js', () => ({
  authenticate: (req: any, res: any, next: any) => next(),
  authorize: (...roleIds: number[]) => (req: any, res: any, next: any) => next(),
  authorizePermission: (_perm: string) => (req: any, res: any, next: any) => next(),
  checkFrozen: (req: any, res: any, next: any) => next(),
  requireCredit: (_field: string) => (req: any, res: any, next: any) => next(),
  hasPermission: vi.fn(() => true),
  generateToken: vi.fn(),
  getCreditLevel: vi.fn(() => ({ name: 'excellent', can_login: 1, can_create_projects: 1, can_create_tasks: 1, can_submit: 1, can_comment: 1 })),
  isBlacklisted: vi.fn(() => false),
  clearFrozenCache: vi.fn(),
}))

const adminCtx: ServiceContext = { userId: 1, roleId: 1, isManager: 0, userName: 'Admin' }

beforeEach(() => {
  mockAddActivityLog.mockReset()
  mockSetDefaultPrefs.mockReset()
})

describe('UserService', () => {
  function seedBase(db: any) {
    seedUser(db, { id: 1, role_id: 1 })
    seedUser(db, { id: 2, role_id: 2 })
  }

  it('list returns non-archived users', async () => {
    const db = createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2, name: 'Active User' })

    const service = new UserService(db)
    const result = await service.list(1, 10)

    expect(result.data).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  it('list excludes archived users by default', async () => {
    const db = createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2, status: 'archived' })

    const service = new UserService(db)
    const result = await service.list(1, 10)

    expect(result.data).toHaveLength(2)
  })

  it('list includes archived users when includeArchived is true', async () => {
    const db = createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2, status: 'archived' })

    const service = new UserService(db)
    const result = await service.list(1, 10, true)

    expect(result.data).toHaveLength(3)
  })

  it('create creates a new user', async () => {
    const db = createTestDb()
    seedBase(db)

    const service = new UserService(db)
    const user = await service.create(
      { name: 'New User', email: 'new@test.com', password: 'secret123', roleId: 2 },
      adminCtx,
    )

    expect(user.id).toBeTruthy()
    expect(user.name).toBe('New User')
    expect(user.email).toBe('new@test.com')
    expect(mockSetDefaultPrefs).toHaveBeenCalledWith(user.id)
  })

  it('create throws 409 for duplicate email', async () => {
    const db = createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2, email: 'dup@test.com' })

    const service = new UserService(db)
    await expect(
      service.create({ name: 'Dup', email: 'dup@test.com', password: 'secret123', roleId: 2 }, adminCtx),
    ).rejects.toThrow('هذا البريد غير متاح')
  })

  it('update updates user details', async () => {
    const db = createTestDb()
    seedBase(db)

    const service = new UserService(db)
    const result = await service.update(1, { name: 'Updated Name' })

    expect(result.message).toBe('تم تحديث المستخدم')
  })

  it('update throws 400 with no fields provided', async () => {
    const db = createTestDb()
    seedBase(db)

    const service = new UserService(db)
    await expect(service.update(1, {})).rejects.toThrow('لا توجد حقول للتحديث')
  })

  it('archive archives a user and restore restores them', async () => {
    const db = createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })

    const service = new UserService(db)
    const archiveResult = await service.archive(3, adminCtx)
    expect(archiveResult.message).toBe('تم أرشفة المستخدم')

    let list = await service.list(1, 10)
    expect(list.data.find((u: any) => u.id === 3)).toBeUndefined()

    const restoreResult = await service.restore(3, adminCtx)
    expect(restoreResult.message).toBe('تم استعادة المستخدم')

    list = await service.list(1, 10)
    expect(list.data.find((u: any) => u.id === 3)).toBeDefined()
  })

  it('archive throws 400 when archiving own account', async () => {
    const db = createTestDb()
    seedBase(db)

    const service = new UserService(db)
    const ownCtx: ServiceContext = { userId: 1, roleId: 1, isManager: 0, userName: 'Admin' }

    await expect(service.archive(1, ownCtx)).rejects.toThrow('لا يمكنك أرشفة حسابك الشخصي')
  })
})
