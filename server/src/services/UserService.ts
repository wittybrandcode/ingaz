import bcrypt from 'bcryptjs'
import { eq, not, count, sql } from 'drizzle-orm'
import { PAGINATION } from '../constants.js'
import { BaseService, AppError } from './BaseService.js'
import type { ServiceContext } from './BaseService.js'
import { schema, addActivityLog } from '../db/index.js'
import { camelToSnake } from '../lib/case-transform.js'
import { setDefaultPrefs } from '../notify.js'
import { NotificationService } from './NotificationService.js'

export class UserService extends BaseService {
  async list(page: number, pageSize: number, includeArchived = false) {
    page = Math.max(1, page)
    pageSize = Math.min(PAGINATION.MAX_PAGE_SIZE, Math.max(1, pageSize || PAGINATION.DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    let whereClause: any = undefined
    if (!includeArchived) {
      whereClause = not(eq(schema.users.status, 'archived'))
    }

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(schema.users)
      .where(whereClause)
    const total = totalRow?.count ?? 0

    const users = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        roleId: schema.users.roleId,
        avatar: schema.users.avatar,
        status: schema.users.status,
        roleName: schema.roles.name,
      })
      .from(schema.users)
      .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
      .where(whereClause)
      .orderBy(sql`${schema.users.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    return { data: camelToSnake(users), total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async create(data: { name: string; email: string; password: string; roleId: number; status?: string }, ctx: ServiceContext) {
    const [existing] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, data.email))
      .limit(1)
    if (existing) throw new AppError(409, 'هذا البريد غير متاح')

    const hash = bcrypt.hashSync(data.password, 10)
    const [user] = await this.db.insert(schema.users).values({
      name: data.name,
      email: data.email,
      password: hash,
      roleId: data.roleId,
      status: data.status || 'active',
    }).returning({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      roleId: schema.users.roleId,
      status: schema.users.status,
      avatar: schema.users.avatar,
    })

    await addActivityLog(ctx.userId, 'create_user', `أنشأ مستخدم "${data.name}"`)
    setDefaultPrefs(user.id)

    if (ctx.io) {
      const notifService = new NotificationService(this.db)
      const allUsers = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.status, 'active'))
      await notifService.createMany(
        allUsers.map((u: any) => ({
          userId: u.id,
          title: `انضم عضو جديد: ${user.name}`,
          type: 'user_joined',
        })),
        ctx.io,
      )
    }

    return user
  }

  async update(id: number, data: { name?: string; email?: string; password?: string; roleId?: number; status?: string }, ctx?: ServiceContext) {
    const updates: Record<string, any> = {}
    if (data.name) updates.name = data.name
    if (data.email) updates.email = data.email
    if (data.password) updates.password = await bcrypt.hash(data.password, 10)
    if (data.roleId) updates.roleId = data.roleId
    if (data.status) updates.status = data.status

    if (Object.keys(updates).length === 0) throw new AppError(400, 'لا توجد حقول للتحديث')

    if (data.roleId !== undefined) {
      const [oldUser] = await this.db
        .select({ roleId: schema.users.roleId })
        .from(schema.users)
        .where(eq(schema.users.id, id))
        .limit(1)
      if (oldUser && oldUser.roleId !== data.roleId) {
        const [newRole] = await this.db
          .select({ name: schema.roles.name })
          .from(schema.roles)
          .where(eq(schema.roles.id, data.roleId))
          .limit(1)
        if (newRole && ctx?.io) {
          const notifService = new NotificationService(this.db)
          await notifService.create({
            userId: id,
            title: `تم تغيير دورك إلى ${newRole.name}`,
            type: 'role_changed',
          }, ctx.io)
        }
      }
    }

    await this.db.update(schema.users).set(updates).where(eq(schema.users.id, id))
    return { message: 'تم تحديث المستخدم' }
  }

  async archive(id: number, ctx: ServiceContext) {
    if (id === ctx.userId) throw new AppError(400, 'لا يمكنك أرشفة حسابك الشخصي')
    await addActivityLog(ctx.userId, 'archive_user', `أرشف المستخدم ${id}`)
    await this.db.update(schema.users).set({ status: 'archived' }).where(eq(schema.users.id, id))
    return { message: 'تم أرشفة المستخدم' }
  }

  async restore(id: number, ctx: ServiceContext) {
    await addActivityLog(ctx.userId, 'restore_user', `استعادة المستخدم ${id}`)
    await this.db.update(schema.users).set({ status: 'active' }).where(eq(schema.users.id, id))
    return { message: 'تم استعادة المستخدم' }
  }
}
