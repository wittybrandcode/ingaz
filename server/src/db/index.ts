import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { sql, eq, and } from 'drizzle-orm'
import * as schema from './schema.js'

let pool: Pool | null = null
let db: ReturnType<typeof drizzle> | null = null

export function getPool(): Pool {
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL!)
    pool = new Pool({
      host: url.hostname,
      port: Number(url.port) || 5432,
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
    })
  }
  return pool
}

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema }) as any
  }
  return db as any
}

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
    db = null
  }
}

export { schema }
export { sql, eq, and }

export async function isProjectManager(userId: number, projectId: number): Promise<boolean> {
  const rows = await getDb()
    .select()
    .from(schema.projectMembers)
    .where(
      and(
        eq(schema.projectMembers.projectId, projectId),
        eq(schema.projectMembers.userId, userId),
        eq(schema.projectMembers.role, 'manager'),
      )
    )
    .limit(1)
  return rows.length > 0
}

export async function addActivityLog(userId: number, action: string, details: string | null = null) {
  await getDb().insert(schema.activityLogs).values({
    userId,
    action,
    details,
  })
}

export async function getUserPermissions(userId: number): Promise<string[]> {
  const [user] = await getDb()
    .select({ isManager: schema.users.isManager, roleId: schema.users.roleId })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  if (user?.isManager) {
    const rows = await getDb()
      .select({ key: schema.permissions.key })
      .from(schema.permissions)
    return rows.map((r: any) => r.key)
  }
  if (!user?.roleId) return []
  const rows = await getDb()
    .select({ key: schema.permissions.key })
    .from(schema.rolePermissions)
    .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
    .where(eq(schema.rolePermissions.roleId, user.roleId))
  return rows.map((r: any) => r.key)
}

export async function getTaskAssignees(taskId: number) {
  const rows = await getDb()
    .select({
      id: schema.taskAssignees.id,
      taskId: schema.taskAssignees.taskId,
      userId: schema.taskAssignees.userId,
      assignedBy: schema.taskAssignees.assignedBy,
      createdAt: schema.taskAssignees.createdAt,
      name: schema.users.name,
      email: schema.users.email,
      avatar: schema.users.avatar,
      roleId: schema.users.roleId,
      roleName: schema.roles.name,
    })
    .from(schema.taskAssignees)
    .innerJoin(schema.users, eq(schema.taskAssignees.userId, schema.users.id))
    .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .where(eq(schema.taskAssignees.taskId, taskId))
    .orderBy(sql`${schema.taskAssignees.createdAt} DESC`)
  return rows
}

export async function getSubtaskAssignees(subtaskId: number) {
  const rows = await getDb()
    .select({
      id: schema.subtaskAssignees.id,
      subtaskId: schema.subtaskAssignees.subtaskId,
      userId: schema.subtaskAssignees.userId,
      assignedBy: schema.subtaskAssignees.assignedBy,
      createdAt: schema.subtaskAssignees.createdAt,
      name: schema.users.name,
      email: schema.users.email,
      avatar: schema.users.avatar,
      roleId: schema.users.roleId,
      roleName: schema.roles.name,
    })
    .from(schema.subtaskAssignees)
    .innerJoin(schema.users, eq(schema.subtaskAssignees.userId, schema.users.id))
    .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .where(eq(schema.subtaskAssignees.subtaskId, subtaskId))
    .orderBy(sql`${schema.subtaskAssignees.createdAt} DESC`)
  return rows
}

export async function getBulkSubtaskAssignees(subtaskIds: number[]): Promise<Record<number, any[]>> {
  if (subtaskIds.length === 0) return {}
  const rows = await getDb()
    .select({
      id: schema.subtaskAssignees.id,
      subtaskId: schema.subtaskAssignees.subtaskId,
      userId: schema.subtaskAssignees.userId,
      assignedBy: schema.subtaskAssignees.assignedBy,
      createdAt: schema.subtaskAssignees.createdAt,
      name: schema.users.name,
      email: schema.users.email,
      avatar: schema.users.avatar,
      roleId: schema.users.roleId,
      roleName: schema.roles.name,
    })
    .from(schema.subtaskAssignees)
    .innerJoin(schema.users, eq(schema.subtaskAssignees.userId, schema.users.id))
    .innerJoin(schema.roles, eq(schema.users.roleId, schema.roles.id))
    .where(sql`${schema.subtaskAssignees.subtaskId} IN (${sql.join(subtaskIds, sql`, `)})`)
    .orderBy(sql`${schema.subtaskAssignees.createdAt} DESC`)
  const grouped: Record<number, any[]> = {}
  for (const row of rows) {
    if (!grouped[row.subtaskId]) grouped[row.subtaskId] = []
    grouped[row.subtaskId].push(row)
  }
  for (const id of subtaskIds) {
    if (!grouped[id]) grouped[id] = []
  }
  return grouped
}

export async function isSubtaskAssignee(subtaskId: number, userId: number): Promise<boolean> {
  const rows = await getDb()
    .select()
    .from(schema.subtaskAssignees)
    .where(
      and(
        eq(schema.subtaskAssignees.subtaskId, subtaskId),
        eq(schema.subtaskAssignees.userId, userId),
      )
    )
    .limit(1)
  return rows.length > 0
}
