import jwt from 'jsonwebtoken'
import type { JwtPayload } from 'jsonwebtoken'
import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { eq, and, lte, gte, sql } from 'drizzle-orm'
import { getDb, schema } from '../db/index.js'
import { TOKEN } from '../constants.js'

const JWT_SECRET: string = process.env.JWT_SECRET!

const tokenBlacklist = new Map<string, number>()
const frozenCache = new Map<number, { isFrozen: boolean; expiry: number }>()
const FROZEN_CACHE_TTL = 30000

interface TokenUser {
  id: number
  email: string
  name: string
  avatar: string | null
  role_id: number
  is_manager: number
}

export function generateToken(user: TokenUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar: user.avatar, role_id: user.role_id, is_manager: user.is_manager },
    JWT_SECRET,
    { expiresIn: TOKEN.EXPIRY }
  )
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Store JWT exp (seconds since epoch) both in-memory and in DB */
export function blacklistToken(token: string): void {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null
    if (decoded?.exp) {
      const expiry = decoded.exp
      tokenBlacklist.set(token, expiry)
      persistBlacklist(token, expiry).catch(() => {})
    }
  } catch { /* jwt.decode may throw on malformed tokens */ }
}

async function persistBlacklist(token: string, expirySec: number) {
  const h = hashToken(token)
  await getDb().insert(schema.tokenBlacklist).values({
    tokenHash: h,
    expiresAt: expirySec,
  }).onConflictDoNothing()
}

function cleanupBlacklist(): void {
  const now = Math.floor(Date.now() / 1000)
  for (const [token, exp] of tokenBlacklist) {
    if (exp <= now) tokenBlacklist.delete(token)
  }
  getDb().delete(schema.tokenBlacklist)
    .where(lte(schema.tokenBlacklist.expiresAt, now))
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
        gte(schema.tokenBlacklist.expiresAt, Math.floor(Date.now() / 1000)),
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
    const decoded = jwt.verify(token, JWT_SECRET) as any
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      avatar: decoded.avatar,
      role_id: decoded.role_id,
      is_manager: decoded.is_manager,
    } as Request['user']
    next()
  } catch {
    res.fail(401, 'رمز التوكن غير صالح')
  }
}

export function authorize(...roleIds: number[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user.is_manager) { next(); return }
    if (roleIds.includes(req.user.role_id)) { next(); return }
    res.fail(403, 'صلاحيات غير كافية')
  }
}

export function authorizePermission(permissionKey: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user.is_manager) { next(); return }
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
    if (rows.length > 0) { next(); return }
    res.fail(403, 'صلاحيات غير كافية')
  }
}

export async function hasPermission(roleId: number, permissionKey: string, userId?: number): Promise<boolean> {
  if (userId) {
    const [user] = await getDb()
      .select({ isManager: schema.users.isManager })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)
    if (user?.isManager) return true
  }
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

export function requireManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.is_manager) {
    res.fail(403, 'غير مصرح')
    return
  }
  next()
}

export function clearFrozenCache(userId: number): void {
  frozenCache.delete(userId)
}

export async function checkFrozen(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cached = frozenCache.get(req.user.id)
  if (cached && Date.now() < cached.expiry) {
    if (cached.isFrozen) { res.fail(403, 'الحساب مجمد'); return }
    next()
    return
  }
  const rows: any[] = await getDb()
    .select({ frozenAt: schema.users.frozenAt, creditScore: schema.users.creditScore })
    .from(schema.users)
    .where(eq(schema.users.id, req.user.id))
    .limit(1)
  const user = rows[0]
  frozenCache.set(req.user.id, { isFrozen: !!user?.frozenAt, expiry: Date.now() + FROZEN_CACHE_TTL })
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
