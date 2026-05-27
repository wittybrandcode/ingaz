import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestDb, seedUser, seedProject, seedProjectMember } from './helpers.js'
import { ProjectService } from '../services/ProjectService.js'
import type { ServiceContext } from '../services/BaseService.js'

const mockIsProjectManager = vi.hoisted(() => vi.fn())
const mockAddActivityLog = vi.hoisted(() => vi.fn())

vi.mock('../db/index.js', async () => {
  const schema = await import('./test-schema.js')
  return {
    schema,
    isProjectManager: mockIsProjectManager,
    addActivityLog: mockAddActivityLog,
    getTaskAssignees: vi.fn(() => []),
    getSubtaskAssignees: vi.fn(() => []),
    getBulkSubtaskAssignees: vi.fn(() => ({})),
    getDb: vi.fn(),
    uploadsDir: '/test/uploads',
  }
})

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
  mockIsProjectManager.mockReset()
  mockAddActivityLog.mockReset()
})

describe('ProjectService', () => {
  function seedBase(db: any) {
    seedUser(db, { id: 1, role_id: 1 })
  }

  it('list returns paginated projects', async () => {
    const db = createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })
    seedProject(db, { id: 20, created_by: 1 })

    const service = new ProjectService(db)
    const result = await service.list(1, 10)

    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.page).toBe(1)
  })

  it('list excludes archived projects', async () => {
    const db = createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1, status: 'active' })
    seedProject(db, { id: 20, created_by: 1, status: 'archived' })

    const service = new ProjectService(db)
    const result = await service.list(1, 10)

    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe(10)
  })

  it('getById returns project with tasks and members', async () => {
    const db = createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1, title: 'Test Project' })
    seedProjectMember(db, 10, 3)

    const service = new ProjectService(db)
    const project = await service.getById(10)

    expect(project.id).toBe(10)
    expect(project.title).toBe('Test Project')
    expect(project.members).toHaveLength(1)
    expect(project.tasks).toEqual([])
  })

  it('getById throws 404 for non-existent project', async () => {
    const db = createTestDb()
    const service = new ProjectService(db)

    await expect(service.getById(999)).rejects.toThrow('المشروع غير موجود')
  })

  it('create creates a new project', async () => {
    const db = createTestDb()
    seedBase(db)

    const service = new ProjectService(db)
    const project = await service.create({ title: 'New Project' }, adminCtx)

    expect(project.id).toBeTruthy()
    expect(project.title).toBe('New Project')
    expect(project.createdBy).toBe(1)
  })

  it('update updates project details', async () => {
    const db = createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1, title: 'Old Title' })

    const service = new ProjectService(db)
    const updated = await service.update(10, { title: 'New Title' }, adminCtx)

    expect(updated.title).toBe('New Title')
  })

  it('archive archives a project', async () => {
    const db = createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })

    const service = new ProjectService(db)
    const result = await service.archive(10, adminCtx)

    expect(result.message).toBe('تم أرشفة المشروع')
  })

  it('permanentDelete deletes a project', async () => {
    const db = createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })

    const service = new ProjectService(db)
    const result = await service.permanentDelete(10, adminCtx)

    expect(result.message).toBe('تم حذف المشروع نهائياً')
    await expect(service.getById(10)).rejects.toThrow('المشروع غير موجود')
  })

  it('getMembers returns members list', async () => {
    const db = createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1 })
    seedProjectMember(db, 10, 3)

    const service = new ProjectService(db)
    const members = await service.getMembers(10)

    expect(members).toHaveLength(1)
    expect(members[0].userId).toBe(3)
  })

  it('addMember adds a member and removeMember removes them', async () => {
    const db = createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1 })

    const service = new ProjectService(db)
    const member = await service.addMember(10, 3, undefined, 'manager')

    expect(member.userId).toBe(3)
    expect(member.role).toBe('manager')

    const result = await service.removeMember(10, 3)
    expect(result.message).toBe('تم إزالة العضو')

    const members = await service.getMembers(10)
    expect(members).toHaveLength(0)
  })
})
