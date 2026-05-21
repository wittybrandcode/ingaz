import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, seedUser, seedProject, seedTask, seedSubtask } from './helpers.js'
import { DeadlineService } from '../services/DeadlineService.js'
import { NotificationService } from '../services/NotificationService.js'
import * as testSchema from './test-schema.js'

let db: any
let deadlineService: DeadlineService
let notifService: NotificationService

beforeAll(() => {
  db = createTestDb()
  deadlineService = new DeadlineService(db)
  notifService = new NotificationService(db)
})

beforeEach(() => {
  vi.restoreAllMocks()
  db.delete(testSchema.deadlineReminders).run()
  db.delete(testSchema.notifications).run()
  db.delete(testSchema.subtasks).run()
  db.delete(testSchema.tasks).run()
  db.delete(testSchema.projects).run()
  db.delete(testSchema.users).run()
})

function seeds(
  subtaskOverrides: Record<string, any> = {},
  projectId = 1,
  taskId = 1,
  subtaskId = 1,
) {
  seedUser(db, { id: subtaskOverrides.assignedTo ?? 1 })
  seedProject(db, { id: projectId })
  seedTask(db, { id: taskId, project_id: projectId })
  seedSubtask(db, {
    id: subtaskId,
    task_id: taskId,
    assigned_to: subtaskOverrides.assignedTo ?? 1,
    deadline: subtaskOverrides.deadline ?? new Date(Date.now() + 12 * 3600000).toISOString(),
    status: subtaskOverrides.status ?? 'open',
  })
}

function makeSubtask(overrides: Record<string, any> = {}): any {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? 'Test Subtask',
    deadline: overrides.deadline ?? new Date(Date.now() + 12 * 3600000).toISOString(),
    assignedTo: overrides.assignedTo ?? 1,
    status: overrides.status ?? 'open',
    taskTitle: overrides.taskTitle ?? 'Test Task',
    projectTitle: overrides.projectTitle ?? 'Test Project',
    userName: overrides.userName ?? 'Test User',
  }
}

describe('DeadlineService — checkDeadlines', () => {
  it('creates 24h reminder for subtask due within 24 hours', async () => {
    const user = seedUser(db, { id: 1 })
    seedProject(db, { id: 1 })
    seedTask(db, { id: 1, project_id: 1 })
    seedSubtask(db, { id: 10, task_id: 1, assigned_to: 1, deadline: new Date(Date.now() + 12 * 3600000).toISOString() })

    vi.spyOn(deadlineService as any, 'querySubtasks').mockResolvedValue([
      makeSubtask({
        id: 10,
        deadline: new Date(Date.now() + 12 * 3600000).toISOString(),
        assignedTo: user.id,
      }),
    ])

    await deadlineService.checkDeadlines()

    const reminders = db.select().from(testSchema.deadlineReminders).all()
    expect(reminders).toHaveLength(1)
    expect(reminders[0].reminderType).toBe('24h')
    expect(reminders[0].subtaskId).toBe(10)

    const notifs = db.select().from(testSchema.notifications).all()
    expect(notifs.length).toBeGreaterThanOrEqual(1)
    expect(notifs[0].type).toBe('deadline_approaching_24h')
    expect(notifs[0].userId).toBe(user.id)
  })

  it('creates 6h reminder for subtask due within 6 hours', async () => {
    seedUser(db, { id: 1 })
    seedProject(db, { id: 1 })
    seedTask(db, { id: 1, project_id: 1 })
    seedSubtask(db, { id: 20, task_id: 1, assigned_to: 1, deadline: new Date(Date.now() + 3 * 3600000).toISOString() })

    vi.spyOn(deadlineService as any, 'querySubtasks').mockResolvedValue([
      makeSubtask({
        id: 20,
        deadline: new Date(Date.now() + 3 * 3600000).toISOString(),
      }),
    ])

    await deadlineService.checkDeadlines()

    const reminders = db.select().from(testSchema.deadlineReminders).all()
    // Both 24h and 6h fire since 3h is within both windows
    expect(reminders.length).toBeGreaterThanOrEqual(1)
    expect(reminders.map((r: any) => r.reminderType)).toContain('6h')
  })

  it('creates overdue reminder for past deadline', async () => {
    seedUser(db, { id: 1 })
    seedProject(db, { id: 1 })
    seedTask(db, { id: 1, project_id: 1 })
    seedSubtask(db, { id: 1, task_id: 1, assigned_to: 1, deadline: new Date(Date.now() - 2 * 3600000).toISOString() })

    vi.spyOn(deadlineService as any, 'querySubtasks').mockResolvedValue([
      makeSubtask({
        id: 1,
        deadline: new Date(Date.now() - 2 * 3600000).toISOString(),
      }),
    ])

    await deadlineService.checkDeadlines()

    const reminders = db.select().from(testSchema.deadlineReminders).all()
    expect(reminders).toHaveLength(1)
    expect(reminders[0].reminderType).toBe('overdue')
  })

  it('does not create duplicate reminders for same subtask + type', async () => {
    seedUser(db, { id: 1 })
    seedProject(db, { id: 1 })
    seedTask(db, { id: 1, project_id: 1 })
    seedSubtask(db, { id: 10, task_id: 1, assigned_to: 1, deadline: new Date(Date.now() + 12 * 3600000).toISOString() })

    vi.spyOn(deadlineService as any, 'querySubtasks').mockResolvedValue([
      makeSubtask({
        id: 10,
        deadline: new Date(Date.now() + 12 * 3600000).toISOString(),
      }),
    ])

    await deadlineService.checkDeadlines()
    await deadlineService.checkDeadlines()

    const reminders = db.select().from(testSchema.deadlineReminders).all()
    const types = reminders.map((r: any) => `${r.subtaskId}:${r.reminderType}`)
    expect(new Set(types).size).toBe(types.length)
  })

  it('does not send notifications when assignedTo is null', async () => {
    vi.spyOn(deadlineService as any, 'querySubtasks').mockResolvedValue([
      makeSubtask({
        id: 10,
        deadline: new Date(Date.now() + 12 * 3600000).toISOString(),
        assignedTo: null,
      }),
    ])

    await deadlineService.checkDeadlines()

    const reminders = db.select().from(testSchema.deadlineReminders).all()
    expect(reminders).toHaveLength(0)

    const notifs = db.select().from(testSchema.notifications).all()
    expect(notifs).toHaveLength(0)
  })

  it('skips subtasks without deadline', async () => {
    vi.spyOn(deadlineService as any, 'querySubtasks').mockResolvedValue([
      makeSubtask({
        id: 10,
        deadline: null,
      }),
    ])

    await deadlineService.checkDeadlines()

    const reminders = db.select().from(testSchema.deadlineReminders).all()
    expect(reminders).toHaveLength(0)
  })

  it('sends overdue notification to admin and deputy', async () => {
    const emp = seedUser(db, { id: 1 })
    const admin = seedUser(db, { id: 2, email: 'admin@test.com', role_id: 1 })
    const deputy = seedUser(db, { id: 3, email: 'deputy@test.com', role_id: 2 })
    seedProject(db, { id: 1 })
    seedTask(db, { id: 1, project_id: 1 })
    seedSubtask(db, { id: 10, task_id: 1, assigned_to: 1, deadline: new Date(Date.now() - 2 * 3600000).toISOString() })

    vi.spyOn(deadlineService as any, 'querySubtasks').mockResolvedValue([
      makeSubtask({
        id: 10,
        deadline: new Date(Date.now() - 2 * 3600000).toISOString(),
        assignedTo: emp.id,
        userName: 'Employee',
      }),
    ])
    vi.spyOn(deadlineService as any, 'queryManagers').mockResolvedValue([
      { id: admin.id },
      { id: deputy.id },
    ])

    await deadlineService.checkDeadlines()

    const overdueNotifs = db.select().from(testSchema.notifications)
      .where(eq(testSchema.notifications.type, 'deadline_overdue')).all()
    // Employee gets notified + each manager gets notified
    expect(overdueNotifs.length).toBeGreaterThanOrEqual(2)

    const userIds = overdueNotifs.map((n: any) => n.userId)
    expect(userIds).toContain(emp.id)
    expect(userIds).toContain(admin.id)
    expect(userIds).toContain(deputy.id)
  })
})
