import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestDb, seedUser, seedProject, seedTask, seedProjectMember } from './helpers.js'
import { TaskService } from '../services/TaskService.js'
import { SubtaskService } from '../services/SubtaskService.js'
import type { ServiceContext } from '../services/BaseService.js'

const mockIsProjectManager = vi.hoisted(() => vi.fn())
const mockGetBulkSubtaskAssignees = vi.hoisted(() => vi.fn(() => ({})))
const mockGetTaskAssignees = vi.hoisted(() => vi.fn(() => []))
const mockGetSubtaskAssignees = vi.hoisted(() => vi.fn(() => []))
const mockHasPermission = vi.hoisted(() => vi.fn((roleId: number) => roleId === 1))

vi.mock('../db/index.js', async () => {
  const schema = await import('./test-schema.js')
  return {
    schema,
    isProjectManager: mockIsProjectManager,
    isSubtaskAssignee: vi.fn().mockReturnValue(false),
    addActivityLog: vi.fn(),
    getTaskAssignees: mockGetTaskAssignees,
    getSubtaskAssignees: mockGetSubtaskAssignees,
    getBulkSubtaskAssignees: mockGetBulkSubtaskAssignees,
    getUserPermissions: vi.fn().mockResolvedValue([]),
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
  hasPermission: mockHasPermission,
  generateToken: vi.fn(),
  getCreditLevel: vi.fn(() => ({ name: 'excellent', can_login: 1, can_create_projects: 1, can_create_tasks: 1, can_submit: 1, can_comment: 1 })),
  isBlacklisted: vi.fn(() => false),
  clearFrozenCache: vi.fn(),
}))

const adminCtx: ServiceContext = { userId: 1, roleId: 1, isManager: 0, userName: 'Admin' }
const deputyCtx: ServiceContext = { userId: 2, roleId: 2, isManager: 1, userName: 'Deputy' }
const empCtx: ServiceContext = { userId: 3, roleId: 2, isManager: 0, userName: 'Employee' }
const emp2Ctx: ServiceContext = { userId: 4, roleId: 2, isManager: 0, userName: 'Employee2' }

beforeEach(() => {
  mockIsProjectManager.mockReset()
  mockHasPermission.mockClear()
  mockGetBulkSubtaskAssignees.mockReset().mockReturnValue({})
  mockGetTaskAssignees.mockReset().mockReturnValue([])
  mockGetSubtaskAssignees.mockReset().mockReturnValue([])
})

describe('TaskService', () => {
  function seedBase(db: any) {
    seedUser(db, { id: 1, role_id: 1 })
  }

  it('ADMIN creates task in any project', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })

    const service = new TaskService(db)
    const task = await service.create({ project_id: 10, title: 'Admin Task' }, adminCtx)

    expect(task.id).toBeTruthy()
    expect(task.title).toBe('Admin Task')
  })

  it('EMPLOYEE who is project member creates task', async () => {
    mockIsProjectManager.mockReturnValue(true)
    const db = await createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1 })
    seedProjectMember(db, 10, 3)

    const service = new TaskService(db)
    const task = await service.create({ project_id: 10, title: 'Member Task' }, empCtx)

    expect(task.title).toBe('Member Task')
  })

  it('EMPLOYEE not a project member gets 403', async () => {
    mockIsProjectManager.mockReturnValue(false)
    const db = await createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })
    seedUser(db, { id: 4, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1 })
    seedProjectMember(db, 10, 4)

    const service = new TaskService(db)
    await expect(service.create({ project_id: 10, title: 'No Access' }, empCtx))
      .rejects.toThrow('لا تملك صلاحية إنشاء مهام في هذا المشروع')
  })

  it('DEPUTY creates task in any project', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedUser(db, { id: 2, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1 })

    const service = new TaskService(db)
    const task = await service.create({ project_id: 10, title: 'Deputy Task' }, deputyCtx)

    expect(task.title).toBe('Deputy Task')
  })

  it('list returns paginated tasks', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })
    const service = new TaskService(db)
    await service.create({ project_id: 10, title: 'Task 1' }, adminCtx)
    await service.create({ project_id: 10, title: 'Task 2' }, adminCtx)

    const result = await service.list(1, 10)
    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('listByProject returns tasks for a project', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })
    seedProject(db, { id: 20, created_by: 1 })
    const service = new TaskService(db)
    await service.create({ project_id: 10, title: 'Project 10 Task' }, adminCtx)
    await service.create({ project_id: 20, title: 'Project 20 Task' }, adminCtx)

    const result = await service.listByProject(10, 1, 10)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].title).toBe('Project 10 Task')
  })

  it('sanitizes HTML in title', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })

    const service = new TaskService(db)
    const task = await service.create({ project_id: 10, title: '<script>alert("xss")</script>Safe Title' }, adminCtx)

    expect(task.title).not.toContain('<script>')
    expect(task.title).toContain('Safe Title')
  })
})

describe('SubtaskService', () => {
  function seedBase(db: any) {
    seedUser(db, { id: 1, role_id: 1 })
  }

  it('ADMIN creates subtask in any task', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })
    seedTask(db, { id: 100, project_id: 10, created_by: 1 })

    const service = new SubtaskService(db)
    const subtask = await service.create({ task_id: 100, title: 'Admin Subtask' }, adminCtx)

    expect(subtask.title).toBe('Admin Subtask')
  })

  it('EMPLOYEE who is project member creates subtask', async () => {
    mockIsProjectManager.mockReturnValue(true)
    const db = await createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1 })
    seedProjectMember(db, 10, 3)
    seedTask(db, { id: 100, project_id: 10, created_by: 1 })

    const service = new SubtaskService(db)
    const subtask = await service.create({ task_id: 100, title: 'Member Subtask' }, empCtx)

    expect(subtask.title).toBe('Member Subtask')
  })

  it('EMPLOYEE not project member gets 403 on subtask create', async () => {
    mockIsProjectManager.mockReturnValue(false)
    const db = await createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1 })
    seedTask(db, { id: 100, project_id: 10, created_by: 1 })

    const service = new SubtaskService(db)
    await expect(service.create({ task_id: 100, title: 'No Access' }, empCtx))
      .rejects.toThrow('لا تملك صلاحية إنشاء مهام فرعية في هذا المشروع')
  })

  it('subtask status transitions (open → cancelled)', async () => {
    mockIsProjectManager.mockReturnValue(true)
    const db = await createTestDb()
    seedBase(db)
    seedUser(db, { id: 3, role_id: 2 })
    seedProject(db, { id: 10, created_by: 1 })
    seedProjectMember(db, 10, 3)
    seedTask(db, { id: 100, project_id: 10, created_by: 1 })

    const service = new SubtaskService(db)
    const subtask = await service.create({ task_id: 100, title: 'Cancellable', assigned_to: 3 }, adminCtx)

    const cancelled = await service.update(subtask.id, { status: 'cancelled' }, adminCtx)
    expect(cancelled.status).toBe('cancelled')
  })

  it('subtask status transitions (open → deferred → open)', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })
    seedTask(db, { id: 100, project_id: 10, created_by: 1 })

    const service = new SubtaskService(db)
    const subtask = await service.create({ task_id: 100, title: 'Deferrable' }, adminCtx)

    const deferred = await service.update(subtask.id, { status: 'deferred' }, adminCtx)
    expect(deferred.status).toBe('deferred')

    const reopened = await service.update(subtask.id, { status: 'open' }, adminCtx)
    expect(reopened.status).toBe('open')
  })

  it('invalid transition throws error', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })
    seedTask(db, { id: 100, project_id: 10, created_by: 1 })

    const service = new SubtaskService(db)
    const subtask = await service.create({ task_id: 100, title: 'Invalid' }, adminCtx)

    await service.update(subtask.id, { status: 'cancelled' }, adminCtx)
    await expect(service.update(subtask.id, { status: 'open' }, adminCtx))
      .rejects.toThrow('لا يمكن تغيير الحالة')
  })

  it('listByTask returns subtasks with assignees', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })
    seedTask(db, { id: 100, project_id: 10, created_by: 1 })

    const service = new SubtaskService(db)
    await service.create({ task_id: 100, title: 'Sub A' }, adminCtx)
    await service.create({ task_id: 100, title: 'Sub B' }, adminCtx)

    const result = await service.listByTask(100, 1, 10)
    expect(result.data).toHaveLength(2)
    expect(result.data[0].assignees).toBeDefined()
  })

  it('getById throws 404 for non-existent subtask', async () => {
    const db = await createTestDb()
    const service = new SubtaskService(db)

    await expect(service.getById(999)).rejects.toThrow('المهمة الفرعية غير موجودة')
  })

  it('delete removes subtask', async () => {
    const db = await createTestDb()
    seedBase(db)
    seedProject(db, { id: 10, created_by: 1 })
    seedTask(db, { id: 100, project_id: 10, created_by: 1 })

    const service = new SubtaskService(db)
    const subtask = await service.create({ task_id: 100, title: 'Delete Me' }, adminCtx)

    const result = await service.delete(subtask.id, adminCtx)
    expect(result.message).toBe('تم حذف المهمة الفرعية')

    await expect(service.getById(subtask.id)).rejects.toThrow('المهمة الفرعية غير موجودة')
  })
})
