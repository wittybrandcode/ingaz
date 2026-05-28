import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, seedUser, seedProject, seedTask, seedSubtask } from './helpers.js'
import { CommentService } from '../services/CommentService.js'
import * as testSchema from './test-schema.js'
import type { ServiceContext } from '../services/BaseService.js'

const adminCtx: ServiceContext = { userId: 1, roleId: 1, isManager: 1 }

describe('CommentService', () => {
  describe('getBySubtask', () => {
    it('returns comments for a subtask with user info', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, name: 'Alice' })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1 })
      db.insert(testSchema.comments).values({ subtaskId: 1, userId: 1, content: 'My comment' }).run()
      const service = new CommentService(db)

      const comments = await service.getBySubtask(1)
      expect(comments).toHaveLength(1)
      expect(comments[0].content).toBe('My comment')
      expect(comments[0].userName).toBe('Alice')
    })

    it('returns empty array when no comments exist', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1 })
      const service = new CommentService(db)

      const comments = await service.getBySubtask(1)
      expect(comments).toEqual([])
    })
  })

  describe('create', () => {
    it('creates a comment and returns enriched data', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, name: 'Alice' })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1 })
      const service = new CommentService(db)

      const comment = await service.create({ subtask_id: 1, content: 'Hello world' }, adminCtx)
      expect(comment.content).toBe('Hello world')
      expect(comment.userId).toBe(1)
      expect(comment.subtaskId).toBe(1)
      expect(comment.userName).toBe('Alice')
    })
  })

  describe('selectWinner', () => {
    it('selects a winner comment and updates subtask/task status', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, name: 'Admin' })
      seedUser(db, { id: 2, name: 'Worker' })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1, assigned_to: 2, status: 'open' })
      db.insert(testSchema.comments).values({ subtaskId: 1, userId: 2, content: 'Winner comment' }).run()
      const service = new CommentService(db)

      const result = await service.selectWinner(1, adminCtx)
      expect(result.message).toBeTruthy()

      const [comment] = db.select({ isWinner: testSchema.comments.isWinner }).from(testSchema.comments).where(eq(testSchema.comments.id, 1)).all()
      expect(comment?.isWinner).toBe(1)

      const [subtask] = db.select({ status: testSchema.subtasks.status, winnerCommentId: testSchema.subtasks.winnerCommentId }).from(testSchema.subtasks).where(eq(testSchema.subtasks.id, 1)).all()
      expect(subtask?.status).toBe('completed')
      expect(subtask?.winnerCommentId).toBe(1)
    })

    it('throws 404 when comment does not exist', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      const service = new CommentService(db)

      await expect(service.selectWinner(999, adminCtx)).rejects.toThrow('التعليق غير موجود')
    })

    it('throws 400 when comment is already a winner', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, name: 'Admin' })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1, status: 'open' })
      db.insert(testSchema.comments).values({ subtaskId: 1, userId: 1, content: 'Already winner', isWinner: 1 }).run()
      const service = new CommentService(db)

      await expect(service.selectWinner(1, adminCtx)).rejects.toThrow('هذا التعليق فائز مسبقاً')
    })

    it('throws 404 when subtask is deleted (cascade removes comment)', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, name: 'Admin' })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1, status: 'open' })
      db.insert(testSchema.comments).values({ subtaskId: 1, userId: 1, content: 'Comment' }).run()
      db.delete(testSchema.subtasks).where(eq(testSchema.subtasks.id, 1)).run()
      const service = new CommentService(db)

      await expect(service.selectWinner(1, adminCtx)).rejects.toThrow('التعليق غير موجود')
    })

    it('throws 400 when subtask is not open', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, name: 'Admin' })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1, status: 'completed' })
      db.insert(testSchema.comments).values({ subtaskId: 1, userId: 1, content: 'Late comment' }).run()
      const service = new CommentService(db)

      await expect(service.selectWinner(1, adminCtx)).rejects.toThrow('يمكن ترشيح فائز في المهام المفتوحة فقط')
    })
  })
})
