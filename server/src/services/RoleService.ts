import { eq, inArray } from 'drizzle-orm'
import { BaseService, AppError } from './BaseService.js'
import { schema } from '../db/index.js'

export class RoleService extends BaseService {
  async list() {
    const roles: any[] = await this.db.select().from(schema.roles).orderBy(schema.roles.id)
    const roleIds = roles.map(r => r.id)
    const permsByRole: Record<number, string[]> = {}
    if (roleIds.length > 0) {
      const allPerms = await this.db
        .select({
          roleId: schema.rolePermissions.roleId,
          key: schema.permissions.key,
        })
        .from(schema.rolePermissions)
        .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
        .where(inArray(schema.rolePermissions.roleId, roleIds))
      for (const rp of allPerms) {
        if (!permsByRole[rp.roleId]) permsByRole[rp.roleId] = []
        permsByRole[rp.roleId].push(rp.key)
      }
    }
    return roles.map((r: any) => ({ ...r, permissions: permsByRole[r.id] || [] }))
  }

  async create(data: { name: string }) {
    const [role] = await this.db.insert(schema.roles).values({ name: data.name.trim() }).returning()
    return role
  }

  async update(id: number, data: { name: string }) {
    await this.db.update(schema.roles).set({ name: data.name.trim() }).where(eq(schema.roles.id, id))
    const [role] = await this.db.select().from(schema.roles).where(eq(schema.roles.id, id))
    return role
  }

  async delete(id: number) {
    if (id <= 3) throw new AppError(400, 'لا يمكن حذف الأدوار الافتراضية')
    await this.db.delete(schema.roles).where(eq(schema.roles.id, id))
    return { message: 'تم حذف الدور' }
  }

  async getPermissions(id: number) {
    const perms = await this.db
      .select({ key: schema.permissions.key })
      .from(schema.rolePermissions)
      .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
      .where(eq(schema.rolePermissions.roleId, id))
    return perms.map((p: any) => p.key)
  }

  async updatePermissions(id: number, permissions: string[]) {
    await this.db.transaction(async (tx: any) => {
      await tx.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, id))
      for (const key of permissions) {
        const permRows = await tx
          .select({ id: schema.permissions.id })
          .from(schema.permissions)
          .where(eq(schema.permissions.key, key))
          .limit(1)
        if (permRows.length > 0) {
          await tx.insert(schema.rolePermissions).values({
            roleId: id,
            permissionId: permRows[0].id,
          })
        }
      }
    })
    return { permissions }
  }

  async listAllPermissions() {
    const perms = await this.db
      .select()
      .from(schema.permissions)
      .orderBy(schema.permissions.groupName, schema.permissions.sortOrder)
    const grouped = perms.reduce((acc: any, p: any) => {
      if (!acc[p.groupName]) acc[p.groupName] = []
      acc[p.groupName].push(p)
      return acc
    }, {} as Record<string, any[]>)
    return grouped
  }
}
