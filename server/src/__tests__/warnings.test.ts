import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, seedUser } from './helpers.js'
import * as testSchema from './test-schema.js'
import { WarningService } from '../services/WarningService.js'
import type { ServiceContext } from '../services/BaseService.js'

const adminCtx: ServiceContext = { userId: 1, roleId: 1 }

const mockGetCreditLevel = vi.hoisted(() => vi.fn())
const mockClearFrozenCache = vi.hoisted(() => vi.fn())
const mockDrizzleDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  orderBy: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue({ rows: [] }),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(undefined),
}))

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
    getDb: vi.fn(() => mockDrizzleDb),
    uploadsDir: '/test/uploads',
  }
})

vi.mock('../middleware/auth.js', () => ({
  getCreditLevel: mockGetCreditLevel,
  clearFrozenCache: mockClearFrozenCache,
}))

describe('WarningService', () => {
  beforeEach(() => {
    mockGetCreditLevel.mockReset()
    mockClearFrozenCache.mockReset()
  })

  describe('warning types CRUD', () => {
    it('listWarningTypes returns all types', async () => {
      const db = await createTestDb()
      const service = new WarningService(db)

      const types = await service.listWarningTypes()
      expect(types.length).toBeGreaterThanOrEqual(7)
      expect(types[0].name).toBeTruthy()
    })

    it('createWarningType inserts a new type', async () => {
      const db = await createTestDb()
      const service = new WarningService(db)

      const created = await service.createWarningType({ name: 'Test Warning', points: 3 })
      expect(created.name).toBe('Test Warning')
      expect(created.points).toBe(3)

      const all = await service.listWarningTypes()
      expect(all.some((t: any) => t.name === 'Test Warning')).toBe(true)
    })

    it('updateWarningType modifies an existing type', async () => {
      const db = await createTestDb()
      const service = new WarningService(db)

      const created = await service.createWarningType({ name: 'Original', points: 1 })
      const updated = await service.updateWarningType(created.id, { name: 'Updated', points: 5 })

      expect(updated.name).toBe('Updated')
      expect(updated.points).toBe(5)
    })

    it('deleteWarningType removes the type', async () => {
      const db = await createTestDb()
      const service = new WarningService(db)

      const created = await service.createWarningType({ name: 'Temp', points: 1 })
      await service.deleteWarningType(created.id)

      const all = await service.listWarningTypes()
      expect(all.some((t: any) => t.id === created.id)).toBe(false)
    })
  })

  describe('restriction levels', () => {
    it('listLevels returns 4 default levels', async () => {
      const db = await createTestDb()
      const service = new WarningService(db)

      const levels = await service.listLevels()
      expect(levels).toHaveLength(4)
      expect(levels[0].name).toBe('excellent')
      expect(levels[3].name).toBe('frozen')
    })

    it('updateLevel modifies fields', async () => {
      const db = await createTestDb()
      const service = new WarningService(db)

      const levels = await service.listLevels()
      const excellent = levels[0]
      await       service.updateLevel(excellent.id, { minScore: 6 })

      const updated = await service.listLevels()
      expect(updated[0].minScore).toBe(6)
    })
  })

  describe('credit scores', () => {
    it('getMyLevel returns user credit info', async () => {
      const db = await createTestDb()
      mockGetCreditLevel.mockReturnValue({ name: 'excellent', name_ar: 'ممتاز', can_login: 1 })
      seedUser(db, { id: 5, credit_score: 9 })
      const service = new WarningService(db)

      const result = await service.getMyLevel(5)
      expect(result.credit_score).toBe(9)
      expect(result.level.name).toBe('excellent')
    })

    it('listCreditScores returns paginated users with levels', async () => {
      const db = await createTestDb()
      seedUser(db, { id: 1, name: 'User A', credit_score: 8, role_id: 3 })
      seedUser(db, { id: 2, name: 'User B', credit_score: 3, role_id: 3 })
      const service = new WarningService(db)

      const result = await service.listCreditScores(1, 10)
      expect(result.data).toHaveLength(2)
      expect(result.data[0].creditScore).toBeLessThanOrEqual(result.data[1].creditScore)
      expect(result.data[0].level).toBeDefined()
    })
  })

  describe('warning creation and lifecycle', () => {
    it('create issues a warning and deducts points when sustained', async () => {
      const db = await createTestDb()
      mockGetCreditLevel.mockReturnValue({ name: 'excellent', can_login: 1, can_create_tasks: 1 })
      seedUser(db, { id: 1, role_id: 1 })
      seedUser(db, { id: 10, credit_score: 10 })
      const types = await new WarningService(db).listWarningTypes()
      const warningTypeId = types[0].id

      const service = new WarningService(db)
      const warning = await service.create({ user_id: 10, reason: 'Late submission', warning_type_id: warningTypeId }, adminCtx)

      expect(warning.userId).toBe(10)
      expect(warning.reason).toBe('Late submission')
      expect(warning.status).toBe('pending')
      expect(warning.pointsDeducted).toBeGreaterThanOrEqual(1)
    })

    it('respond to a warning', async () => {
      const db = await createTestDb()
      mockGetCreditLevel.mockReturnValue({ name: 'excellent', can_login: 1 })
      seedUser(db, { id: 1, role_id: 1 })
      seedUser(db, { id: 10, credit_score: 10 })
      const empCtx: ServiceContext = { userId: 10, roleId: 3 }

      const service = new WarningService(db)
      const warning = await service.create({ user_id: 10, reason: 'Tardy' }, adminCtx)

      const responded = await service.respond(warning.id, 'I apologize, will do better', empCtx)
      expect(responded.status).toBe('responded')
      expect(responded.responseText).toBe('I apologize, will do better')
    })

    it('respond to already-responded warning throws 400', async () => {
      const db = await createTestDb()
      mockGetCreditLevel.mockReturnValue({ name: 'excellent', can_login: 1 })
      seedUser(db, { id: 1, role_id: 1 })
      seedUser(db, { id: 10, credit_score: 10 })
      const empCtx: ServiceContext = { userId: 10, roleId: 3 }

      const service = new WarningService(db)
      const warning = await service.create({ user_id: 10, reason: 'Missed deadline' }, adminCtx)
      await service.respond(warning.id, 'Sorry', empCtx)

      await expect(service.respond(warning.id, 'Again', empCtx)).rejects.toThrow('تم الرد على هذا الإنذار مسبقاً')
    })

    it('respond to non-existent warning throws 404', async () => {
      const db = await createTestDb()
      const empCtx: ServiceContext = { userId: 10, roleId: 3 }
      const service = new WarningService(db)

      await expect(service.respond(999, 'Hello?', empCtx)).rejects.toThrow('الإنذار غير موجود')
    })

    it('clear warning restores credit points', async () => {
      const db = await createTestDb()
      mockGetCreditLevel.mockReturnValue({ name: 'excellent', can_login: 1 })
      seedUser(db, { id: 1, role_id: 1 })
      seedUser(db, { id: 10, credit_score: 7 })
      const empCtx: ServiceContext = { userId: 10, roleId: 3 }

      const service = new WarningService(db)
      const warning = await service.create({ user_id: 10, reason: 'Absent', deadline_hours: 48 }, adminCtx)

      await service.respond(warning.id, 'Was sick', empCtx)
      await service.clear(warning.id, adminCtx)

      const [cleared] = db.select().from(testSchema.warnings).where(eq(testSchema.warnings.id, warning.id)).all()
      expect(cleared.status).toBe('cleared')

      const user = db.select({ creditScore: testSchema.users.creditScore }).from(testSchema.users).where(eq(testSchema.users.id, 10)).get()
      expect(user?.creditScore).toBeGreaterThan(7)
    })

    it('sustain warning deducts points and triggers freeze check', async () => {
      const db = await createTestDb()
      mockGetCreditLevel
        .mockReturnValueOnce({ name: 'warning', can_login: 1 })
        .mockReturnValueOnce({ name: 'frozen', can_login: 0 })
      seedUser(db, { id: 1, role_id: 1 })
      seedUser(db, { id: 10, credit_score: 3 })
      const empCtx: ServiceContext = { userId: 10, roleId: 3 }

      const service = new WarningService(db)
      const warning = await service.create({ user_id: 10, reason: 'Repeated absences', warning_type_id: null, deadline_hours: 48 }, adminCtx)

      await service.respond(warning.id, 'Will improve', empCtx)
      await service.sustain(warning.id, adminCtx)

      const user = db.select({ creditScore: testSchema.users.creditScore }).from(testSchema.users).where(eq(testSchema.users.id, 10)).get()
      expect(user?.creditScore).toBeLessThan(3)
      expect(mockGetCreditLevel).toHaveBeenCalled()
    })

    it('sustain non-existent warning throws 404', async () => {
      const db = await createTestDb()
      const service = new WarningService(db)

      await expect(service.sustain(999, adminCtx)).rejects.toThrow('الإنذار غير موجود')
    })
  })

  describe('freeze / unfreeze', () => {
    it('getFreezeStatus returns frozen=false for active user', async () => {
      const db = await createTestDb()
      seedUser(db, { id: 5, credit_score: 8 })
      const service = new WarningService(db)

      const result = await service.getFreezeStatus(5)
      expect(result.frozen).toBe(false)
      expect(result.credit_score).toBe(8)
    })

    it('getFreezeStatus returns frozen=true for frozen user', async () => {
      const db = await createTestDb()
      seedUser(db, { id: 5, credit_score: 0, ...{ frozen_at: new Date().toISOString(), freeze_reason: 'Low credit' } })

      const service = new WarningService(db)
      const result = await service.getFreezeStatus(5)
      expect(result.frozen).toBe(true)
      expect(result.freeze_reason).toBe('Low credit')
    })

    it('unfreeze resets user credit to 5', async () => {
      const db = await createTestDb()
      seedUser(db, { id: 5, credit_score: 0, ...{ frozen_at: new Date().toISOString() } })
      const service = new WarningService(db)

      await service.unfreeze(5, adminCtx)
      const user = db.select({
        creditScore: testSchema.users.creditScore,
        frozenAt: testSchema.users.frozenAt,
        unfrozenAt: testSchema.users.unfrozenAt,
      }).from(testSchema.users).where(eq(testSchema.users.id, 5)).get()
      expect(user?.creditScore).toBe(5)
      expect(user?.frozenAt).toBeNull()
      expect(user?.unfrozenAt).toBeTruthy()
    })

    it('unfreeze non-existent user throws 404', async () => {
      const db = await createTestDb()
      const service = new WarningService(db)

      await expect(service.unfreeze(999, adminCtx)).rejects.toThrow('المستخدم غير موجود')
    })
  })

  describe('pagination', () => {
    it('list returns paginated warnings', async () => {
      const db = await createTestDb()
      mockGetCreditLevel.mockReturnValue({ name: 'excellent', can_login: 1 })
      seedUser(db, { id: 1, role_id: 1 })
      seedUser(db, { id: 10, credit_score: 10 })

      const service = new WarningService(db)
      await service.create({ user_id: 10, reason: 'Warning 1' }, adminCtx)
      await service.create({ user_id: 10, reason: 'Warning 2' }, adminCtx)

      const result = await service.list(1, 10)
      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('listMy returns user-specific warnings', async () => {
      const db = await createTestDb()
      mockGetCreditLevel.mockReturnValue({ name: 'excellent', can_login: 1 })
      seedUser(db, { id: 1, role_id: 1 })
      seedUser(db, { id: 10, credit_score: 10 })
      seedUser(db, { id: 11, credit_score: 10 })

      const service = new WarningService(db)
      await service.create({ user_id: 10, reason: 'For user 10' }, adminCtx)
      await service.create({ user_id: 11, reason: 'For user 11' }, adminCtx)

      const result = await service.listMy(10, 1, 10)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].reason).toBe('For user 10')
    })
  })
})
