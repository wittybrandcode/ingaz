import { describe, it, expect, vi } from 'vitest'
import { createTestDb, seedUser, seedProject, seedTask, seedSubtask } from './helpers.js'
import { UploadService } from '../services/UploadService.js'
import type { ServiceContext } from '../services/BaseService.js'
import * as testSchema from './test-schema.js'

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    unlinkSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  unlinkSync: vi.fn(),
}))

const adminCtx: ServiceContext = { userId: 1, roleId: 1, isManager: 1 }
const userCtx: ServiceContext = { userId: 2, roleId: 2, isManager: 0 }
const mockFile = { filename: 'test-file.pdf', originalname: 'document.pdf', mimetype: 'application/pdf', size: 1024, path: '/tmp/test-file.pdf' }

describe('UploadService', () => {
  describe('checkPermission', () => {
    it('allows managers for any entity type', async () => {
      const db = createTestDb()
      const service = new UploadService(db)

      const result = await service.checkPermission('project', 1, 1, 1)
      expect(result.allowed).toBe(true)
    })

    it('allows any user for project entity type', async () => {
      const db = createTestDb()
      const service = new UploadService(db)

      const result = await service.checkPermission('project', 1, 2, 0)
      expect(result.allowed).toBe(true)
    })

    it('allows task creator for task entity type', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedUser(db, { id: 2 })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 2 })
      const service = new UploadService(db)

      const result = await service.checkPermission('task', 1, 2, 0)
      expect(result.allowed).toBe(true)
    })

    it('denies non-creator for task entity type', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedUser(db, { id: 2 })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      const service = new UploadService(db)

      const result = await service.checkPermission('task', 1, 2, 0)
      expect(result.allowed).toBe(false)
    })

    it('allows subtask assignee for subtask entity type', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedUser(db, { id: 2 })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1, assigned_to: 2 })
      const service = new UploadService(db)

      const result = await service.checkPermission('subtask', 1, 2, 0)
      expect(result.allowed).toBe(true)
    })

    it('denies non-assignee for subtask entity type', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedUser(db, { id: 2 })
      seedUser(db, { id: 3 })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      seedSubtask(db, { id: 1, task_id: 1, assigned_to: 2 })
      const service = new UploadService(db)

      const result = await service.checkPermission('subtask', 1, 3, 0)
      expect(result.allowed).toBe(false)
    })

    it('returns error for invalid entity type', async () => {
      const db = createTestDb()
      const service = new UploadService(db)

      const result = await service.checkPermission('invalid', 1, 1, 0)
      expect(result.allowed).toBe(false)
    })
  })

  describe('upload', () => {
    it('inserts attachment records', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedProject(db, { id: 1, created_by: 1 })
      const service = new UploadService(db)

      const attachments = await service.upload('project', 1, [mockFile], adminCtx)
      expect(attachments).toHaveLength(1)
      expect(attachments[0].filename).toBe('test-file.pdf')
      expect(attachments[0].entityType).toBe('project')
      expect(attachments[0].entityId).toBe(1)
    })

    it('throws 400 when no files provided', async () => {
      const db = createTestDb()
      const service = new UploadService(db)

      await expect(service.upload('project', 1, [], adminCtx)).rejects.toThrow('لم يتم رفع ملفات')
    })

    it('throws 403 when permission denied', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedUser(db, { id: 2 })
      seedProject(db, { id: 1, created_by: 1 })
      seedTask(db, { id: 1, project_id: 1, created_by: 1 })
      const service = new UploadService(db)

      await expect(service.upload('task', 1, [mockFile], userCtx)).rejects.toThrow('لا يمكنك الرفع لهذه المهمة')
    })
  })

  describe('getFiles', () => {
    it('returns files for entity type and id', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      db.insert(testSchema.attachments).values({ entityType: 'project', entityId: 1, filename: 'a.pdf', originalName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, uploadedBy: 1 }).run()
      db.insert(testSchema.attachments).values({ entityType: 'project', entityId: 2, filename: 'b.pdf', originalName: 'b.pdf', mimeType: 'application/pdf', fileSize: 200, uploadedBy: 1 }).run()
      const service = new UploadService(db)

      const files = await service.getFiles('project', 1)
      expect(files).toHaveLength(1)
      expect(files[0].entityId).toBe(1)
    })

    it('throws 400 when no entity params', async () => {
      const db = createTestDb()
      const service = new UploadService(db)

      await expect(service.getFiles()).rejects.toThrow('يجب تحديد entity_type مع entity_id')
    })
  })

  describe('getFilesBulk', () => {
    it('returns files grouped by entity id', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      db.insert(testSchema.attachments).values({ entityType: 'task', entityId: 1, filename: 'a.pdf', originalName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, uploadedBy: 1 }).run()
      db.insert(testSchema.attachments).values({ entityType: 'task', entityId: 1, filename: 'b.pdf', originalName: 'b.pdf', mimeType: 'application/pdf', fileSize: 200, uploadedBy: 1 }).run()
      db.insert(testSchema.attachments).values({ entityType: 'task', entityId: 2, filename: 'c.pdf', originalName: 'c.pdf', mimeType: 'application/pdf', fileSize: 300, uploadedBy: 1 }).run()
      const service = new UploadService(db)

      const grouped = await service.getFilesBulk('task', [1, 2], true)
      expect(Object.keys(grouped)).toHaveLength(2)
      expect(grouped[1]).toHaveLength(2)
      expect(grouped[2]).toHaveLength(1)
    })

    it('returns flat array when groupBy is false', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      db.insert(testSchema.attachments).values({ entityType: 'task', entityId: 1, filename: 'a.pdf', originalName: 'a.pdf', mimeType: 'application/pdf', fileSize: 100, uploadedBy: 1 }).run()
      const service = new UploadService(db)

      const files = await service.getFilesBulk('task', [1], false)
      expect(Array.isArray(files)).toBe(true)
      expect(files).toHaveLength(1)
    })

    it('returns empty when no ids provided', async () => {
      const db = createTestDb()
      const service = new UploadService(db)

      const grouped = await service.getFilesBulk('task', [], true)
      expect(grouped).toEqual({})
    })
  })

  describe('deleteFile', () => {
    it('deletes attachment record and file from disk', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      db.insert(testSchema.attachments).values({ entityType: 'project', entityId: 1, filename: 'delete-me.pdf', originalName: 'delete-me.pdf', mimeType: 'application/pdf', fileSize: 100, uploadedBy: 1 }).run()
      const service = new UploadService(db)

      const result = await service.deleteFile(1, adminCtx)
      expect(result.message).toBeTruthy()

      const files = await service.getFiles('project', 1)
      expect(files).toHaveLength(0)
    })

    it('throws 404 on non-existent file', async () => {
      const db = createTestDb()
      const service = new UploadService(db)

      await expect(service.deleteFile(999, adminCtx)).rejects.toThrow('الملف غير موجود')
    })

    it('throws 403 when non-manager tries to delete another users file', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1 })
      seedUser(db, { id: 2 })
      db.insert(testSchema.attachments).values({ entityType: 'project', entityId: 1, filename: 'other.pdf', originalName: 'other.pdf', mimeType: 'application/pdf', fileSize: 100, uploadedBy: 1 }).run()
      const service = new UploadService(db)

      await expect(service.deleteFile(1, userCtx)).rejects.toThrow('لا يمكنك حذف هذا الملف')
    })
  })
})
