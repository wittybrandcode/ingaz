import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, seedUser } from './helpers.js'
import { NotificationService } from '../services/NotificationService.js'
import * as testSchema from './test-schema.js'

let db: any
let notificationService: NotificationService

beforeAll(() => {
  db = createTestDb()
  notificationService = new NotificationService(db)
})

beforeEach(() => {
  db.delete(testSchema.notifications).run()
  db.delete(testSchema.notificationPreferences).run()
  db.delete(testSchema.users).run()
})

describe('NotificationService — create', () => {
  it('creates a notification in the database', async () => {
    const user = seedUser(db, { id: 1 })
    const notif = await notificationService.create({
      userId: user.id,
      title: 'Test Notification',
      message: 'This is a test',
      type: 'info',
    })
    expect(notif).toBeDefined()
    expect(notif.title).toBe('Test Notification')
    expect(notif.message).toBe('This is a test')
    expect(notif.type).toBe('info')
    expect(notif.read).toBe(0)
    expect(notif.userId).toBe(user.id)
  })

  it('creates a notification with related entity', async () => {
    const user = seedUser(db, { id: 1 })
    const notif = await notificationService.create({
      userId: user.id,
      title: 'Subtask assigned',
      type: 'subtask_assigned',
      relatedType: 'subtask',
      relatedId: 42,
    })
    expect(notif).toBeDefined()
    expect(notif.relatedType).toBe('subtask')
    expect(notif.relatedId).toBe(42)
  })

  it('returns null when notification type is disabled in preferences', async () => {
    const user = seedUser(db, { id: 1 })
    db.insert(testSchema.notificationPreferences).values({
      userId: user.id,
      notificationType: 'info',
      enabled: 0,
      channels: '["in_app"]',
    }).run()
    const notif = await notificationService.create({
      userId: user.id,
      title: 'Disabled test',
      type: 'info',
    })
    expect(notif).toBeNull()
  })

  it('respects default_enabled from notification_types when no preference exists', async () => {
    const user = seedUser(db, { id: 1 })
    db.update(testSchema.notificationTypes)
      .set({ defaultEnabled: 0 })
      .where(eq(testSchema.notificationTypes.typeKey, 'info'))
      .run()
    const notif = await notificationService.create({
      userId: user.id,
      title: 'Disabled by default',
      type: 'info',
    })
    expect(notif).toBeNull()
    db.update(testSchema.notificationTypes)
      .set({ defaultEnabled: 1 })
      .where(eq(testSchema.notificationTypes.typeKey, 'info'))
      .run()
  })
})

describe('NotificationService — createMany', () => {
  it('creates notifications for multiple users', async () => {
    const user1 = seedUser(db, { id: 1, email: 'u1@test.com' })
    const user2 = seedUser(db, { id: 2, email: 'u2@test.com' })
    const user3 = seedUser(db, { id: 3, email: 'u3@test.com' })
    const notifs = await notificationService.createMany([
      { userId: user1.id, title: 'Notif A', type: 'info' },
      { userId: user2.id, title: 'Notif B', type: 'info' },
      { userId: user3.id, title: 'Notif C', type: 'info' },
    ])
    expect(notifs).toHaveLength(3)
  })

  it('skips users who have disabled the notification type', async () => {
    const user1 = seedUser(db, { id: 1, email: 'u1@test.com' })
    const user2 = seedUser(db, { id: 2, email: 'u2@test.com' })
    db.insert(testSchema.notificationPreferences).values({
      userId: user2.id,
      notificationType: 'info',
      enabled: 0,
      channels: '["in_app"]',
    }).run()
    const notifs = await notificationService.createMany([
      { userId: user1.id, title: 'Enabled', type: 'info' },
      { userId: user2.id, title: 'Disabled', type: 'info' },
    ])
    expect(notifs).toHaveLength(1)
    expect(notifs[0].title).toBe('Enabled')
  })

  it('returns empty array when all users have disabled', async () => {
    const user = seedUser(db, { id: 1 })
    db.insert(testSchema.notificationPreferences).values({
      userId: user.id,
      notificationType: 'info',
      enabled: 0,
      channels: '["in_app"]',
    }).run()
    const notifs = await notificationService.createMany([
      { userId: user.id, title: 'Should not create', type: 'info' },
    ])
    expect(notifs).toEqual([])
  })
})

describe('NotificationService — isEnabled', () => {
  it('returns true when no preference exists and default is enabled', async () => {
    const user = seedUser(db, { id: 1 })
    const enabled = await notificationService.isEnabled(user.id, 'subtask_assigned')
    expect(enabled).toBe(true)
  })

  it('returns false when preference explicitly disables', async () => {
    const user = seedUser(db, { id: 1 })
    db.insert(testSchema.notificationPreferences).values({
      userId: user.id,
      notificationType: 'subtask_assigned',
      enabled: 0,
      channels: '["in_app"]',
    }).run()
    const enabled = await notificationService.isEnabled(user.id, 'subtask_assigned')
    expect(enabled).toBe(false)
  })

  it('returns true when preference explicitly enables', async () => {
    const user = seedUser(db, { id: 1 })
    db.insert(testSchema.notificationPreferences).values({
      userId: user.id,
      notificationType: 'subtask_assigned',
      enabled: 1,
      channels: '["in_app"]',
    }).run()
    const enabled = await notificationService.isEnabled(user.id, 'subtask_assigned')
    expect(enabled).toBe(true)
  })
})
