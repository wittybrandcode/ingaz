import bcrypt from 'bcryptjs'
import path from 'path'
import fs from 'fs'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { BaseService, AppError, type ServiceContext } from './BaseService.js'
import { generateToken, blacklistToken } from '../middleware/auth.js'
import { setDefaultPrefs } from '../notify.js'
import { NotificationService } from './NotificationService.js'
import { camelToSnake } from '../lib/case-transform.js'
import { schema, getUserPermissions } from '../db/index.js'

export interface LoginResult {
  user: any
  token: string
}

export class AuthService extends BaseService {
  async login(email: string, password: string, io?: any) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        password: schema.users.password,
        roleId: schema.users.roleId,
        isManager: schema.users.isManager,
        avatar: schema.users.avatar,
        status: schema.users.status,
        frozenAt: schema.users.frozenAt,
        freezeReason: schema.users.freezeReason,
        roleName: schema.roles.name,
      })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
      .where(
        and(
          eq(schema.users.email, email),
          inArray(schema.users.status, ['active', 'inactive']),
        )
      )
      .limit(1)

    if (!user || !bcrypt.compareSync(password, user.password)) {
      throw new AppError(401, 'بيانات الدخول غير صحيحة')
    }

    await this.db.transaction(async (tx: any) => {
      await setDefaultPrefs(user.id, tx)
      if (io) {
        const notifService = new NotificationService(tx)
        await notifService.create({
          userId: user.id,
          title: 'تم تسجيل دخول جديد إلى حسابك',
          type: 'new_login',
        }, io)
      }
    })

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role_id: user.roleId,
      is_manager: user.isManager,
    })

    const { password: _, ...userData } = user
    const permissions = await getUserPermissions(user.id)

    return { user: { ...userData, permissions }, token }
  }

  async me(userId: number) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        roleId: schema.users.roleId,
        isManager: schema.users.isManager,
        avatar: schema.users.avatar,
        status: schema.users.status,
        frozenAt: schema.users.frozenAt,
        freezeReason: schema.users.freezeReason,
        roleName: schema.roles.name,
      })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
      .where(eq(schema.users.id, userId))
      .limit(1)
    if (!user) throw new AppError(404, 'المستخدم غير موجود')
    const permissions = await getUserPermissions(userId)
    return { ...user, permissions }
  }

  async updateProfile(userId: number, data: { name?: string; password?: string; avatar?: string }, io?: any) {
    const updates: Record<string, any> = {}
    if (data.name) updates.name = data.name
    if (data.password) updates.password = bcrypt.hashSync(data.password, 10)
    if (data.avatar !== undefined) updates.avatar = data.avatar

    if (Object.keys(updates).length === 0) throw new AppError(400, 'لا توجد حقول للتحديث')

    const passwordChanged = !!data.password

    await this.db.transaction(async (tx: any) => {
      await tx.update(schema.users).set(updates).where(eq(schema.users.id, userId))

      if (passwordChanged && io) {
        const notifService = new NotificationService(tx)
        await notifService.create({
          userId,
          title: 'تم تغيير كلمة المرور الخاصة بك',
          type: 'password_changed',
        }, io)
      }
    })

    return { message: 'تم تحديث الملف الشخصي' }
  }

  async updateAvatar(userId: number, filename: string) {
    const [oldUser] = await this.db
      .select({ avatar: schema.users.avatar })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    if (oldUser?.avatar) {
      const oldPath = path.join(process.cwd(), 'uploads', oldUser.avatar)
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }
    await this.db.update(schema.users).set({ avatar: filename }).where(eq(schema.users.id, userId))
    return { avatar: filename }
  }

  logout(token: string) {
    if (token) blacklistToken(token)
    return { message: 'تم تسجيل الخروج' }
  }
}
