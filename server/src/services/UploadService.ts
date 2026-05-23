import fs from 'fs'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { BaseService, AppError } from './BaseService.js'
import type { ServiceContext } from './BaseService.js'
import { schema } from '../db/index.js'
import { NotificationService } from './NotificationService.js'

export interface UploadedFile {
  filename: string
  originalname: string
  mimetype: string
  size: number
  path: string
}

export class UploadService extends BaseService {
  async checkPermission(entityType: string, entityId: number, userId: number, isManager: number): Promise<{ allowed: boolean; error?: string }> {
    if (isManager === 1) return { allowed: true }

    if (entityType === 'project') {
      return { allowed: true }
    }

    if (entityType === 'task') {
      const [task] = await this.db
        .select({ createdBy: schema.tasks.createdBy })
        .from(schema.tasks)
        .where(eq(schema.tasks.id, entityId))
        .limit(1)
      if (task && task.createdBy === userId) return { allowed: true }
      return { allowed: false, error: 'لا يمكنك الرفع لهذه المهمة' }
    }

    if (entityType === 'subtask') {
      const [subtask] = await this.db
        .select({ assignedTo: schema.subtasks.assignedTo })
        .from(schema.subtasks)
        .where(eq(schema.subtasks.id, entityId))
        .limit(1)
      if (subtask && subtask.assignedTo === userId) return { allowed: true }
      return { allowed: false, error: 'أنت لست مسنداً لهذه المهمة الفرعية' }
    }

    return { allowed: false, error: 'نوع الكيان غير صالح' }
  }

  async upload(entityType: string, entityId: number, files: UploadedFile[], ctx: ServiceContext) {
    const perm = await this.checkPermission(entityType, entityId, ctx.userId, ctx.isManager)
    if (!perm.allowed) throw new AppError(403, perm.error!)

    if (!files || files.length === 0) throw new AppError(400, 'لم يتم رفع ملفات')

    const inserted = []
    for (const file of files) {
      const [attachment] = await this.db.insert(schema.attachments).values({
        entityType,
        entityId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: ctx.userId,
      }).returning()
      inserted.push(attachment)
    }

    if (ctx.io) {
      const notifService = new NotificationService(this.db)
      if (entityType === 'project') {
        const allUsers = await this.db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.status, 'active'))
        await notifService.createMany(
          allUsers.map((u: any) => ({
            userId: u.id,
            title: 'ملف جديد في المشروع',
            message: `${ctx.userName} رفع ${inserted.length} ملف في المشروع`,
            type: 'file_uploaded',
            relatedType: 'project',
            relatedId: entityId,
          })),
          ctx.io,
        )
      } else if (entityType === 'subtask') {
        const [subtask] = await this.db
          .select({ assignedTo: schema.subtasks.assignedTo, title: schema.subtasks.title })
          .from(schema.subtasks)
          .where(eq(schema.subtasks.id, entityId))
          .limit(1)
        if (subtask?.assignedTo && subtask.assignedTo !== ctx.userId) {
          const originalName = files[0]?.originalname || ''
          await notifService.create({
            userId: subtask.assignedTo,
            title: `تم رفع ملف في المهمة: ${originalName}`,
            type: 'file_uploaded',
            relatedType: 'subtask',
            relatedId: entityId,
          }, ctx.io)
        }
      }
    }

    return inserted
  }

  async getFiles(entityType?: string, entityId?: number) {
    if (entityType && entityId) {
      return this.db
        .select()
        .from(schema.attachments)
        .where(
          and(
            eq(schema.attachments.entityType, entityType),
            eq(schema.attachments.entityId, entityId),
          )
        )
        .orderBy(sql`${schema.attachments.createdAt} DESC`)
    }
    throw new AppError(400, 'يجب تحديد entity_type مع entity_id')
  }

  async getFilesBulk(entityType: string, entityIds: number[], groupBy: boolean) {
    if (entityIds.length === 0) return groupBy ? {} : []
    const rows = await this.db
      .select()
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.entityType, entityType),
          inArray(schema.attachments.entityId, entityIds),
        )
      )
      .orderBy(sql`${schema.attachments.createdAt} DESC`)
    if (groupBy) {
      const grouped: Record<number, any[]> = {}
      for (const r of rows) {
        if (!grouped[r.entityId]) grouped[r.entityId] = []
        grouped[r.entityId].push(r)
      }
      return grouped
    }
    return rows
  }

  async deleteFile(fileId: number, ctx: ServiceContext) {
    const [file] = await this.db
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.id, fileId))
      .limit(1)
    if (!file) throw new AppError(404, 'الملف غير موجود')

    if (file.uploadedBy !== ctx.userId && !ctx.isManager) {
      throw new AppError(403, 'لا يمكنك حذف هذا الملف')
    }

    await this.db.delete(schema.attachments).where(eq(schema.attachments.id, fileId))

    if (fs.existsSync(file.filename)) fs.unlinkSync(file.filename)
    return { message: 'تم حذف الملف' }
  }
}
