import { eq, and, count, lte, inArray, sql } from 'drizzle-orm'
import { aliasedTable } from 'drizzle-orm'
import { ROLES, PAGINATION, WARNING_DEADLINE_HOURS, CREDIT } from '../constants.js'
import { BaseService, AppError } from './BaseService.js'
import type { ServiceContext } from './BaseService.js'
import { schema, addActivityLog } from '../db/index.js'
import { NotificationService } from './NotificationService.js'
import { getCreditLevel, clearFrozenCache } from '../middleware/auth.js'

const issuer = aliasedTable(schema.users, 'issuer')

export class WarningService extends BaseService {
  private notifService: NotificationService

  constructor(db: any, notifService?: NotificationService) {
    super(db)
    this.notifService = notifService || new NotificationService(db)
  }

  private async autoFreezeCheck(userId: number, ctx: ServiceContext) {
    const level = await getCreditLevel(userId)
    if (level && level.name === 'frozen' && !level.canLogin) {
      const existing: any[] = await this.db
        .select({ frozenAt: schema.users.frozenAt })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1)
      if (!existing[0]?.frozenAt) {
        await this.db.update(schema.users).set({
          frozenAt: new Date().toISOString(),
          freezeReason: 'رصيدك من النقاط وصل إلى مستوى حرج. يرجى التواصل مع المدير.',
        }).where(eq(schema.users.id, userId))
        clearFrozenCache(userId)
        if (ctx.io) {
          this.notifService.create({
            userId, type: 'account_frozen', title: 'تم تجميد حسابك ❄️',
            message: 'وصل رصيد نقاطك إلى مستوى متدنٍ جداً. تم تجميد حسابك تلقائياً. يرجى التواصل مع المدير.',
            relatedType: undefined, relatedId: undefined,
          }, ctx.io)
        }
      }
    }
  }

  // Warning Types CRUD
  async listWarningTypes() {
    return this.db
      .select()
      .from(schema.warningTypes)
      .orderBy(schema.warningTypes.points)
  }

  async createWarningType(data: { name: string; description?: string | null; points?: number; is_active?: number }) {
    const [wt] = await this.db.insert(schema.warningTypes).values({
      name: data.name.trim(),
      description: data.description || null,
      points: data.points ?? 1,
      isActive: data.is_active ?? 1,
    }).returning()
    return wt
  }

  async updateWarningType(id: number, data: { name?: string; description?: string | null; points?: number; is_active?: number }) {
    const updates: Record<string, any> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.points !== undefined) updates.points = data.points
    if (data.is_active !== undefined) updates.isActive = data.is_active
    if (Object.keys(updates).length === 0) throw new AppError(400, 'لا توجد حقول')
    await this.db.update(schema.warningTypes).set(updates).where(eq(schema.warningTypes.id, id))
    const [wt] = await this.db.select().from(schema.warningTypes).where(eq(schema.warningTypes.id, id))
    return wt
  }

  async deleteWarningType(id: number) {
    await this.db.delete(schema.warningTypes).where(eq(schema.warningTypes.id, id))
    return { message: 'تم الحذف' }
  }

  // Restriction Levels
  async listLevels() {
    return this.db
      .select()
      .from(schema.restrictionLevels)
      .orderBy(schema.restrictionLevels.sortOrder)
  }

  async updateLevel(id: number, data: Record<string, any>) {
    const fields = ['name', 'nameAr', 'minScore', 'color', 'icon', 'showBanner', 'canLogin', 'canCreateProjects', 'canCreateTasks', 'canEdit', 'canAssign', 'canSubmit', 'canComment']
    const updates: Record<string, any> = {}
    for (const f of fields) {
      if (data[f] !== undefined) updates[f] = data[f]
    }
    if (Object.keys(updates).length === 0) throw new AppError(400, 'لا توجد حقول')
    await this.db.update(schema.restrictionLevels).set(updates).where(eq(schema.restrictionLevels.id, id))
    const [level] = await this.db.select().from(schema.restrictionLevels).where(eq(schema.restrictionLevels.id, id))
    return level
  }

  // Credit Scores
  async listCreditScores(page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db.select({ count: count() }).from(schema.users)
    const total = totalRow?.count ?? 0

    const users: any[] = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        avatar: schema.users.avatar,
        creditScore: schema.users.creditScore,
        frozenAt: schema.users.frozenAt,
        roleName: schema.roles.name,
        roleId: schema.roles.id,
      })
      .from(schema.users)
      .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
      .orderBy(schema.users.creditScore)
      .limit(pageSize)
      .offset(offset)

    const levels: any[] = await this.db
      .select()
      .from(schema.restrictionLevels)
      .orderBy(sql`${schema.restrictionLevels.minScore} DESC`)

    const enriched = users.map((u: any) => {
      const level = levels.find((l: any) => l.minScore <= u.creditScore) || levels[levels.length - 1]
      return { ...u, level }
    })

    return { data: enriched, total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async getMyLevel(userId: number) {
    const [user]: any[] = await this.db
      .select({ creditScore: schema.users.creditScore, frozenAt: schema.users.frozenAt })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    const level = await getCreditLevel(userId)
    return { credit_score: user?.creditScore ?? 10, frozen_at: user?.frozenAt, level }
  }

  // Main Warnings
  async list(page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db.select({ count: count() }).from(schema.warnings)
    const total = totalRow?.count ?? 0

    const warnings: any[] = await this.db
      .select({
        id: schema.warnings.id,
        userId: schema.warnings.userId,
        issuedBy: schema.warnings.issuedBy,
        reason: schema.warnings.reason,
        status: schema.warnings.status,
        responseText: schema.warnings.responseText,
        respondedAt: schema.warnings.respondedAt,
        clearedBy: schema.warnings.clearedBy,
        clearedAt: schema.warnings.clearedAt,
        deadline: schema.warnings.deadline,
        warningTypeId: schema.warnings.warningTypeId,
        pointsDeducted: schema.warnings.pointsDeducted,
        creditBefore: schema.warnings.creditBefore,
        creditAfter: schema.warnings.creditAfter,
        warningTypeName: schema.warnings.warningTypeName,
        createdAt: schema.warnings.createdAt,
        warningTypeNameFromWT: sql`COALESCE(${schema.warnings.warningTypeName}, ${schema.warningTypes.name})`,
        warningTypePoints: schema.warningTypes.points,
        userName: schema.users.name,
        userAvatar: schema.users.avatar,
        userCreditScore: schema.users.creditScore,
        issuedByName: issuer.name,
        issuedByAvatar: issuer.avatar,
      })
      .from(schema.warnings)
      .leftJoin(schema.warningTypes, eq(schema.warnings.warningTypeId, schema.warningTypes.id))
      .innerJoin(schema.users, eq(schema.warnings.userId, schema.users.id))
      .innerJoin(issuer, eq(schema.warnings.issuedBy, issuer.id))
      .orderBy(sql`${schema.warnings.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    return { data: warnings, total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async listMy(userId: number, page: number, pageSize: number) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(schema.warnings)
      .where(eq(schema.warnings.userId, userId))
    const total = totalRow?.count ?? 0

    const warnings: any[] = await this.db
      .select({
        id: schema.warnings.id,
        userId: schema.warnings.userId,
        issuedBy: schema.warnings.issuedBy,
        reason: schema.warnings.reason,
        status: schema.warnings.status,
        responseText: schema.warnings.responseText,
        respondedAt: schema.warnings.respondedAt,
        deadline: schema.warnings.deadline,
        pointsDeducted: schema.warnings.pointsDeducted,
        creditBefore: schema.warnings.creditBefore,
        creditAfter: schema.warnings.creditAfter,
        warningTypeName: schema.warnings.warningTypeName,
        createdAt: schema.warnings.createdAt,
        warningTypeNameFromWT: sql`COALESCE(${schema.warnings.warningTypeName}, ${schema.warningTypes.name})`,
        warningTypePoints: schema.warningTypes.points,
        issuedByName: issuer.name,
        issuedByAvatar: issuer.avatar,
      })
      .from(schema.warnings)
      .leftJoin(schema.warningTypes, eq(schema.warnings.warningTypeId, schema.warningTypes.id))
      .innerJoin(issuer, eq(schema.warnings.issuedBy, issuer.id))
      .where(eq(schema.warnings.userId, userId))
      .orderBy(sql`${schema.warnings.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    return { data: warnings, total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async create(data: { user_id: number; reason: string; deadline_hours?: number; warning_type_id?: number | null }, ctx: ServiceContext) {
    let points = 1
    let typeName: string | null = null
    if (data.warning_type_id) {
      const [wt]: any[] = await this.db
        .select({ name: schema.warningTypes.name, points: schema.warningTypes.points })
        .from(schema.warningTypes)
        .where(
          and(
            eq(schema.warningTypes.id, data.warning_type_id),
            eq(schema.warningTypes.isActive, 1),
          )
        )
        .limit(1)
      if (wt) { points = wt.points; typeName = wt.name }
    }

    const [user]: any[] = await this.db
      .select({ creditScore: schema.users.creditScore })
      .from(schema.users)
      .where(eq(schema.users.id, data.user_id))
      .limit(1)
    const creditBefore = user?.creditScore ?? 10
    const deadline = new Date(Date.now() + (data.deadline_hours || WARNING_DEADLINE_HOURS) * 3600000).toISOString()

    let enriched: any
    await this.db.transaction(async (tx: any) => {
      const [warning]: any[] = await tx.insert(schema.warnings).values({
        userId: data.user_id,
        issuedBy: ctx.userId,
        reason: data.reason.trim(),
        deadline,
        warningTypeId: data.warning_type_id || null,
        pointsDeducted: points,
        creditBefore,
        warningTypeName: typeName,
      }).returning()

      const [enrichedRow]: any[] = await tx
        .select({
          id: schema.warnings.id,
          userId: schema.warnings.userId,
          issuedBy: schema.warnings.issuedBy,
          reason: schema.warnings.reason,
          status: schema.warnings.status,
          deadline: schema.warnings.deadline,
          warningTypeId: schema.warnings.warningTypeId,
          pointsDeducted: schema.warnings.pointsDeducted,
          creditBefore: schema.warnings.creditBefore,
          warningTypeName: schema.warnings.warningTypeName,
          createdAt: schema.warnings.createdAt,
          warningTypeNameFromWT: sql`COALESCE(${schema.warnings.warningTypeName}, ${schema.warningTypes.name})`,
          warningTypePoints: schema.warningTypes.points,
          issuedByName: issuer.name,
        })
        .from(schema.warnings)
        .leftJoin(schema.warningTypes, eq(schema.warnings.warningTypeId, schema.warningTypes.id))
        .innerJoin(issuer, eq(schema.warnings.issuedBy, issuer.id))
        .where(eq(schema.warnings.id, warning.id))
        .limit(1)
      enriched = enrichedRow

      await tx.insert(schema.activityLogs).values({
        userId: ctx.userId,
        action: 'create_warning',
        details: `أصدر إنذاراً بحق المستخدم ${data.user_id}: ${data.reason.trim()}`,
      })

      if (ctx.io) {
        const notifTx = new NotificationService(tx)
        await notifTx.create({
          userId: data.user_id, type: 'warning',
          title: `إنذار ⚠️ (قد يخصم ${points} نقطة)`,
          message: `تم إصدار إنذار بحقك: ${data.reason.trim()}\nيرجى الرد خلال ${data.deadline_hours || WARNING_DEADLINE_HOURS} ساعة`,
          relatedType: 'warning', relatedId: warning.id,
        }, ctx.io)
      }
    })

    return enriched
  }

  async respond(id: number, responseText: string, ctx: ServiceContext) {
    const [warning]: any[] = await this.db
      .select()
      .from(schema.warnings)
      .where(
        and(
          eq(schema.warnings.id, id),
          eq(schema.warnings.userId, ctx.userId),
        )
      )
      .limit(1)
    if (!warning) throw new AppError(404, 'الإنذار غير موجود')
    if (warning.status !== 'pending') throw new AppError(400, 'تم الرد على هذا الإنذار مسبقاً')

    let updated: any
    await this.db.transaction(async (tx: any) => {
      await tx.update(schema.warnings).set({
        status: 'responded',
        responseText: responseText.trim(),
        respondedAt: new Date().toISOString(),
      }).where(eq(schema.warnings.id, id))

      const [updatedRow]: any[] = await tx
        .select({
          id: schema.warnings.id,
          userId: schema.warnings.userId,
          issuedBy: schema.warnings.issuedBy,
          reason: schema.warnings.reason,
          status: schema.warnings.status,
          responseText: schema.warnings.responseText,
          respondedAt: schema.warnings.respondedAt,
          deadline: schema.warnings.deadline,
          pointsDeducted: schema.warnings.pointsDeducted,
          creditBefore: schema.warnings.creditBefore,
          warningTypeName: schema.warnings.warningTypeName,
          createdAt: schema.warnings.createdAt,
          warningTypeNameFromWT: sql`COALESCE(${schema.warnings.warningTypeName}, ${schema.warningTypes.name})`,
          userName: schema.users.name,
          userAvatar: schema.users.avatar,
          issuedByName: issuer.name,
          issuedByAvatar: issuer.avatar,
        })
        .from(schema.warnings)
        .leftJoin(schema.warningTypes, eq(schema.warnings.warningTypeId, schema.warningTypes.id))
        .innerJoin(schema.users, eq(schema.warnings.userId, schema.users.id))
        .innerJoin(issuer, eq(schema.warnings.issuedBy, issuer.id))
        .where(eq(schema.warnings.id, id))
        .limit(1)
      updated = updatedRow

      await tx.insert(schema.activityLogs).values({
        userId: ctx.userId,
        action: 'respond_warning',
        details: `رد على إنذار: ${responseText.trim().slice(0, 100)}`,
      })

      if (ctx.io) {
        const notifTx = new NotificationService(tx)
        await notifTx.create({
          userId: warning.issuedBy, type: 'warning_responded', title: 'رد على إنذار',
          message: `${ctx.userName} رد على الإنذار: ${responseText.trim().slice(0, 100)}`,
          relatedType: 'warning', relatedId: warning.id,
        }, ctx.io)
      }
    })

    return updated
  }

  async clear(id: number, ctx: ServiceContext) {
    const [warning]: any[] = await this.db
      .select()
      .from(schema.warnings)
      .where(eq(schema.warnings.id, id))
      .limit(1)
    if (!warning) throw new AppError(404, 'الإنذار غير موجود')

    let updated: any
    await this.db.transaction(async (tx: any) => {
      await tx.update(schema.warnings).set({
        status: 'cleared',
        clearedBy: ctx.userId,
        clearedAt: new Date().toISOString(),
      }).where(eq(schema.warnings.id, id))

      const [user]: any[] = await tx
        .select({ creditScore: schema.users.creditScore })
        .from(schema.users)
        .where(eq(schema.users.id, warning.userId))
        .limit(1)
      const restored = Math.min(10, (user?.creditScore ?? 0) + warning.pointsDeducted)
      await tx.update(schema.users).set({ creditScore: restored }).where(eq(schema.users.id, warning.userId))

      const [u]: any[] = await tx
        .select({
          id: schema.warnings.id,
          status: schema.warnings.status,
          clearedBy: schema.warnings.clearedBy,
          clearedAt: schema.warnings.clearedAt,
          userId: schema.warnings.userId,
          pointsDeducted: schema.warnings.pointsDeducted,
          warningTypeName: schema.warnings.warningTypeName,
          createdAt: schema.warnings.createdAt,
          warningTypeNameFromWT: sql`COALESCE(${schema.warnings.warningTypeName}, ${schema.warningTypes.name})`,
          userName: schema.users.name,
          userAvatar: schema.users.avatar,
          issuedByName: issuer.name,
          issuedByAvatar: issuer.avatar,
        })
        .from(schema.warnings)
        .leftJoin(schema.warningTypes, eq(schema.warnings.warningTypeId, schema.warningTypes.id))
        .innerJoin(schema.users, eq(schema.warnings.userId, schema.users.id))
        .innerJoin(issuer, eq(schema.warnings.issuedBy, issuer.id))
        .where(eq(schema.warnings.id, id))
        .limit(1)
      updated = u

      await tx.insert(schema.activityLogs).values({
        userId: ctx.userId,
        action: 'clear_warning',
        details: `مسح إنذار للمستخدم ${warning.userId}`,
      })
    })

    if (ctx.io) {
      this.notifService.create({
        userId: warning.userId, type: 'warning_cleared', title: 'تم فك الإنذار ✓',
        message: `${ctx.userName} قبل بتقريرك وتمت استعادة ${warning.pointsDeducted} نقاط`,
        relatedType: 'warning', relatedId: warning.id,
      }, ctx.io)
    }

    return updated
  }

  async sustain(id: number, ctx: ServiceContext) {
    const [warning]: any[] = await this.db
      .select()
      .from(schema.warnings)
      .where(eq(schema.warnings.id, id))
      .limit(1)
    if (!warning) throw new AppError(404, 'الإنذار غير موجود')

    let newScore = 0
    let updated: any
    await this.db.transaction(async (tx: any) => {
      await tx.update(schema.warnings).set({ status: 'sustained' }).where(eq(schema.warnings.id, id))

      const [targetUser]: any[] = await tx
        .select({ creditScore: schema.users.creditScore })
        .from(schema.users)
        .where(eq(schema.users.id, warning.userId))
        .limit(1)
      newScore = Math.max(0, (targetUser?.creditScore ?? 10) - warning.pointsDeducted)

      await tx.update(schema.warnings).set({ creditAfter: newScore }).where(eq(schema.warnings.id, id))
      await tx.update(schema.users).set({ creditScore: newScore }).where(eq(schema.users.id, warning.userId))

      const [u]: any[] = await tx
        .select({
          id: schema.warnings.id,
          status: schema.warnings.status,
          creditAfter: schema.warnings.creditAfter,
          userId: schema.warnings.userId,
          pointsDeducted: schema.warnings.pointsDeducted,
          warningTypeName: schema.warnings.warningTypeName,
          createdAt: schema.warnings.createdAt,
          warningTypeNameFromWT: sql`COALESCE(${schema.warnings.warningTypeName}, ${schema.warningTypes.name})`,
          userName: schema.users.name,
          userCreditScore: schema.users.creditScore,
          issuedByName: issuer.name,
        })
        .from(schema.warnings)
        .leftJoin(schema.warningTypes, eq(schema.warnings.warningTypeId, schema.warningTypes.id))
        .innerJoin(schema.users, eq(schema.warnings.userId, schema.users.id))
        .innerJoin(issuer, eq(schema.warnings.issuedBy, issuer.id))
        .where(eq(schema.warnings.id, id))
        .limit(1)
      updated = u

      await tx.insert(schema.activityLogs).values({
        userId: ctx.userId,
        action: 'sustain_warning',
        details: `أبقى على إنذار للمستخدم ${warning.userId}، خصم ${warning.pointsDeducted} نقاط`,
      })
    })

    if (ctx.io) {
      this.notifService.create({
        userId: warning.userId, type: 'warning_sustained',
        title: `تم خصم ${warning.pointsDeducted} نقاط من رصيدك`,
        message: `${ctx.userName} أبقى على الإنذار. رصيدك الحالي: ${newScore}/10`,
        relatedType: 'warning', relatedId: warning.id,
      }, ctx.io)
    }

    await this.autoFreezeCheck(warning.userId, ctx)

    return updated
  }

  async getFreezeStatus(userId: number) {
    const [user]: any[] = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        frozenAt: schema.users.frozenAt,
        freezeReason: schema.users.freezeReason,
        creditScore: schema.users.creditScore,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    const frozen = !!(user?.frozenAt)
    if (frozen) {
      const warnings: any[] = await this.db
        .select({
          id: schema.warnings.id,
          userId: schema.warnings.userId,
          issuedBy: schema.warnings.issuedBy,
          reason: schema.warnings.reason,
          status: schema.warnings.status,
          deadline: schema.warnings.deadline,
          pointsDeducted: schema.warnings.pointsDeducted,
          warningTypeName: schema.warnings.warningTypeName,
          createdAt: schema.warnings.createdAt,
          warningTypeNameFromWT: sql`COALESCE(${schema.warnings.warningTypeName}, ${schema.warningTypes.name})`,
          issuedByName: issuer.name,
          issuedByAvatar: issuer.avatar,
        })
        .from(schema.warnings)
        .leftJoin(schema.warningTypes, eq(schema.warnings.warningTypeId, schema.warningTypes.id))
        .innerJoin(issuer, eq(schema.warnings.issuedBy, issuer.id))
        .where(
          and(
            eq(schema.warnings.userId, userId),
            inArray(schema.warnings.status, ['sustained', 'ignored']),
          )
        )
        .orderBy(sql`${schema.warnings.createdAt} DESC`)
      return { frozen: true, frozen_at: user.frozenAt, freeze_reason: user.freezeReason, credit_score: user.creditScore, warnings }
    }
    return { frozen: false, credit_score: user.creditScore }
  }

  async unfreeze(userId: number, ctx: ServiceContext) {
    const [user]: any[] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    if (!user) throw new AppError(404, 'المستخدم غير موجود')

    await this.db.update(schema.users).set({
      frozenAt: null,
      freezeReason: null,
      unfrozenAt: new Date().toISOString(),
      creditScore: 5,
    }).where(eq(schema.users.id, userId))
    clearFrozenCache(userId)

    await addActivityLog(ctx.userId, 'unfreeze_user', `فك تجميد المستخدم ${userId}`)

    if (ctx.io) {
      this.notifService.create({
        userId, type: 'account_unfrozen', title: 'تم فك تجميد حسابك ✅',
        message: `${ctx.userName} قام بفك تجميد حسابك ورد رصيدك إلى 5 نقاط`,
        relatedType: undefined, relatedId: undefined,
      }, ctx.io)
    }

    return { message: 'تم فك التجميد، تم إعادة الرصيد إلى 5 نقاط' }
  }
}
