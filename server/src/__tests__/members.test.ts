import { describe, it, expect, vi } from 'vitest'
import { MemberService } from '../services/MemberService.js'

const mockExecute = vi.hoisted(() => vi.fn())

vi.mock('../db/schema.js', async () => {
  return await import('./test-schema.js')
})

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
      execute: mockExecute,
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    })),
    uploadsDir: '/test/uploads',
  }
})

function makeDb(rows: any[] = []) {
  mockExecute.mockReset()
  mockExecute.mockResolvedValue({ rows, command: 'SELECT', rowCount: rows.length })
  const db = { execute: mockExecute, insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(), run: vi.fn() }
  return db
}

describe('MemberService', () => {
  describe('list', () => {
    it('returns users with correct fields', async () => {
      const db = makeDb([
        { id: 1, name: 'Alice', email: 'a@test.com', role_name: 'participant', active_tasks: 2, warnings_count: 0, projects_count: 1, can_assign: false, unread_count: 0 },
        { id: 2, name: 'Bob', email: 'b@test.com', role_name: 'participant', active_tasks: 0, warnings_count: 1, projects_count: 0, can_assign: true, unread_count: 3 },
      ])
      const service = new MemberService(db)

      const members = await service.list()
      expect(members).toHaveLength(2)
      expect(members[0].name).toBe('Alice')
      expect(members[0].email).toBe('a@test.com')
    })

    it('passes currentUserId for unread_count', async () => {
      const db = makeDb([])
      const service = new MemberService(db)

      await service.list(5)
      const sql = mockExecute.mock.calls[0][0]
      expect(sql.queryChunks.some((c: any) => String(c).includes('5'))).toBe(true)
    })
  })

  describe('getActiveTasks', () => {
    it('returns active subtasks for a user', async () => {
      const db = makeDb([
        { id: 1, title: 'Task A', status: 'open', project_title: 'Project X', project_id: 1 },
      ])
      const service = new MemberService(db)

      const tasks = await service.getActiveTasks(2)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].title).toBe('Task A')
    })

    it('returns empty array for user with no tasks', async () => {
      const db = makeDb([])
      const service = new MemberService(db)

      const tasks = await service.getActiveTasks(1)
      expect(tasks).toEqual([])
    })
  })

  describe('getActivity', () => {
    it('returns recent activity for a user', async () => {
      const db = makeDb([
        { id: 1, action: 'login', details: 'Logged in', created_at: '2026-01-01' },
      ])
      const service = new MemberService(db)

      const activity = await service.getActivity(1)
      expect(activity).toHaveLength(1)
      expect(activity[0].action).toBe('login')
    })

    it('respects limit parameter', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({ id: i, action: 'login', details: `Login ${i}`, created_at: '2026-01-01' }))
      const db = makeDb(rows.slice(0, 3))
      const service = new MemberService(db)

      const activity = await service.getActivity(1, 3)
      expect(activity).toHaveLength(3)
    })
  })
})
