import { describe, it, expect } from 'vitest'
import { createTestDb, seedUser, seedProject, seedTask, seedSubtask } from './helpers.js'
import { AnalyticsService } from '../services/AnalyticsService.js'
import * as testSchema from './test-schema.js'

describe('AnalyticsService', () => {
  describe('dashboard', () => {
    it('returns zero counts when database is empty', async () => {
      const db = createTestDb()
      const service = new AnalyticsService(db)

      const result = await service.dashboard()
      expect(result.counts.projects).toBe(0)
      expect(result.counts.tasks).toBe(0)
      expect(result.counts.subtasks).toBe(0)
      expect(result.counts.users).toBe(0)
    })

    it('returns correct counts for seeded data', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, status: 'active' })
      seedUser(db, { id: 2, status: 'active' })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1, status: 'active' })
      seedSubtask(db, { id: 1, task_id: 1, status: 'open' })
      const service = new AnalyticsService(db)

      const result = await service.dashboard()
      expect(result.counts.projects).toBe(1)
      expect(result.counts.tasks).toBe(1)
      expect(result.counts.subtasks).toBe(1)
      expect(result.counts.users).toBe(2)
    })

    it('excludes inactive users from count', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, status: 'active' })
      seedUser(db, { id: 2, status: 'inactive' })
      const service = new AnalyticsService(db)

      const result = await service.dashboard()
      expect(result.counts.users).toBe(1)
    })

    it('returns status distribution for subtasks', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1, status: 'open' })
      seedSubtask(db, { id: 2, task_id: 1, status: 'completed' })
      seedSubtask(db, { id: 3, task_id: 1, status: 'open' })
      const service = new AnalyticsService(db)

      const result = await service.dashboard()
      const openCount = result.statusDistribution.find((s: any) => s.status === 'open')
      const completedCount = result.statusDistribution.find((s: any) => s.status === 'completed')
      expect(openCount?.count).toBe(2)
      expect(completedCount?.count).toBe(1)
    })

    it('returns recent activity with user info', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, name: 'Alice' })
      db.insert(testSchema.activityLogs).values({ userId: 1, action: 'login', details: 'Logged in' }).run()
      const service = new AnalyticsService(db)

      const result = await service.dashboard()
      expect(result.recentActivity).toHaveLength(1)
      expect(result.recentActivity[0].userName).toBe('Alice')
      expect(result.recentActivity[0].action).toBe('login')
    })

    it('returns project progress with subtask counts', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedProject(db, { id: 1, created_by: 1, title: 'Project A' })
      seedTask(db, { id: 1, project_id: 1, created_by: 1, status: 'active' })
      seedSubtask(db, { id: 1, task_id: 1, status: 'open' })
      seedSubtask(db, { id: 2, task_id: 1, status: 'completed' })
      const service = new AnalyticsService(db)

      const result = await service.dashboard()
      expect(result.projectProgress).toHaveLength(1)
      expect(result.projectProgress[0].title).toBe('Project A')
    })

    it('returns tasks by user', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, name: 'Worker' })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1, assigned_to: 1, status: 'completed' })
      seedSubtask(db, { id: 2, task_id: 1, assigned_to: 1, status: 'open' })
      const service = new AnalyticsService(db)

      const result = await service.dashboard()
      const userStats = result.tasksByUser.find((u: any) => u.name === 'Worker')
      expect(userStats).toBeDefined()
      expect(Number(userStats.total)).toBeGreaterThanOrEqual(2)
    })
  })
})
