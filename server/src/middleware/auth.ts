import jwt from 'jsonwebtoken'
import type { JwtPayload } from 'jsonwebtoken'
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { eq, and, lte, sql } from 'drizzle-orm'
import { getDb, schema } from '../db/index.js'
import { ROLES, TOKEN } from '../constants.js'

const JWT_SECRET: string = process.env.JWT_SECRET!

const tokenBlacklist = new Map<string, number>()
const frozenCache = new Map<number, { frozen_at: string | null; expiry: number }>()
const FROZEN_CACHE_TTL = 30000

interface TokenUser {
  id: number
  email: string
  name: string
  avatar: string | null
  role_id: number
}

export function generateToken(user: TokenUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role_id: user.role_id },
    JWT_SECRET,
    { expiresIn: TOKEN.EXPIRY }
  )
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function blacklistToken(token: string): void {
  try {
    const decoded = jwt.decode(token)
    if (decoded && typeof decoded !== 'string' && decoded.exp) {
      const expiry = decoded.exp * 1000
      tokenBlacklist.set(token, expiry)
    }
  } catch {}
}

export async function persistBlacklist(token: string, expiry: number) {
  const h = hashToken(token)
  await getDb().insert(schema.tokenBlacklist).values({
    tokenHash: h,
    expiresAt: expiry,
  })
}

function cleanupBlacklist(): void {
  const now = Date.now()
  for (const [token, exp] of tokenBlacklist) {
    if (exp <= now) tokenBlacklist.delete(token)
  }
  getDb().delete(schema.tokenBlacklist)
    .where(eq(schema.tokenBlacklist.expiresAt, Math.floor(now / 1000)))
}

export async function isBlacklisted(token: string): Promise<boolean> {
  if (tokenBlacklist.has(token)) return true
  const h = hashToken(token)
  const rows = await getDb()
    .select({ expiresAt: schema.tokenBlacklist.expiresAt })
    .from(schema.tokenBlacklist)
    .where(
      and(
        eq(schema.tokenBlacklist.tokenHash, h),
        eq(schema.tokenBlacklist.expiresAt, Math.floor(Date.now() / 1000)),
      )
    )
    .limit(1)
  if (rows.length > 0) {
    tokenBlacklist.set(token, rows[0].expiresAt)
    return true
  }
  return false
}

setInterval(cleanupBlacklist, 3600000)

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.fail(401, 'رمز التوكن غير موجود')
    return
  }
  if (await isBlacklisted(token)) {
    res.fail(401, 'رمز التوكن ملغي')
    return
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as Request['user']
    next()
  } catch {
    res.fail(401, 'رمز التوكن غير صالح')
  }
}

export function authorize(...roleIds: number[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!roleIds.includes(req.user.role_id)) {
      res.fail(403, 'صلاحيات غير كافية')
      return
    }
    next()
  }
}

export function authorizePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user.role_id === ROLES.ADMIN || req.user.role_id === ROLES.DEPUTY) { next(); return }
    const rows = await getDb()
      .select()
      .from(schema.rolePermissions)
      .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
      .where(
        and(
          eq(schema.rolePermissions.roleId, req.user.role_id),
          eq(schema.permissions.key, permissionKey),
        )
      )
      .limit(1)
    if (rows.length === 0) { res.fail(403, 'صلاحيات غير كافية'); return }
    next()
  }
}

export async function hasPermission(roleId: number, permissionKey: string): Promise<boolean> {
  if (roleId === ROLES.ADMIN || roleId === ROLES.DEPUTY) return true
  const rows = await getDb()
    .select()
    .from(schema.rolePermissions)
    .innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
    .where(
      and(
        eq(schema.rolePermissions.roleId, roleId),
        eq(schema.permissions.key, permissionKey),
      )
    )
    .limit(1)
  return rows.length > 0
}

export function clearFrozenCache(userId: number): void {
  frozenCache.delete(userId)
}

export async function checkFrozen(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cached = frozenCache.get(req.user.id)
  if (cached && Date.now() < cached.expiry) {
    if (cached.frozen_at) { res.fail(403, 'الحساب مجمد'); return }
    next()
    return
  }
  const rows: any[] = await getDb()
    .select({ frozenAt: schema.users.frozenAt, creditScore: schema.users.creditScore })
    .from(schema.users)
    .where(eq(schema.users.id, req.user.id))
    .limit(1)
  const user = rows[0]
  frozenCache.set(req.user.id, { frozen_at: user?.frozenAt ? new Date(user.frozenAt).toISOString() : null, expiry: Date.now() + FROZEN_CACHE_TTL })
  if (user?.frozenAt) {
    res.fail(403, 'الحساب مجمد')
    return
  }
  next()
}

export async function getCreditLevel(userId: number) {
  const rows = await getDb()
    .select({ creditScore: schema.users.creditScore })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  const user = rows[0]
  if (!user) return null
  const levels = await getDb()
    .select()
    .from(schema.restrictionLevels)
    .where(lte(schema.restrictionLevels.minScore, user.creditScore))
    .orderBy(sql`${schema.restrictionLevels.minScore} DESC`)
    .limit(1)
  return levels[0] || null
}

export function requireCredit(permissionField: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const level = await getCreditLevel(req.user.id)
    if (!level) { next(); return }
    const lvl = level as Record<string, unknown>
    if (!lvl[permissionField]) {
      res.status(403).json({
        success: false,
        error: 'حسابك مقيد من تنفيذ هذا الإجراء',
        restriction: lvl.name,
        restriction_label: lvl.name_ar,
      })
      return
    }
    next()
  }
}
