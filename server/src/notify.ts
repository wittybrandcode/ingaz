import { eq, and } from 'drizzle-orm'
import { getDb, schema } from './db/index.js'
import { camelToSnake } from './lib/case-transform.js'

const cachedPrefs = new Map<string, { enabled: number; channels: string[] }>()

async function getPrefs(userId: number, type: string) {
  const key = `${userId}:${type}`
  if (cachedPrefs.has(key)) return cachedPrefs.get(key)!
  const rows = await getDb()
    .select({ enabled: schema.notificationPreferences.enabled, channels: schema.notificationPreferences.channels })
    .from(schema.notificationPreferences)
    .where(
      and(
        eq(schema.notificationPreferences.userId, userId),
        eq(schema.notificationPreferences.notificationType, type),
      )
    )
    .limit(1)
  const pref = rows[0]
  let channels: string[] = ['in_app']
  try {
    if (pref) channels = JSON.parse(pref.channels)
  } catch {
    channels = ['in_app']
  }
  const result = { enabled: pref ? pref.enabled : 1, channels }
  cachedPrefs.set(key, result)
  setTimeout((): void => {
    cachedPrefs.delete(key)
  }, 5000)
  return result
}

export async function notifyAll({
  type,
  title,
  message,
  relatedType,
  relatedId,
  io,
}: {
  type: string
  title: string
  message?: string
  relatedType?: string
  relatedId?: number
  io?: any
}) {
  const userRows = await getDb()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.status, 'active'))

  const created: any[] = []
  for (const user of userRows) {
    const pref = await getPrefs(user.id, type)
    if (!pref.enabled || !pref.channels.includes('in_app')) continue
    const [notif] = await getDb().insert(schema.notifications).values({
      userId: user.id,
      title,
      message: message || null,
      type,
      relatedType: relatedType || null,
      relatedId: relatedId || null,
    }).returning()
    created.push(notif)
    if (io) io.to(`user:${user.id}`).emit('notification', camelToSnake(notif))
  }
  return created
}

export async function notifyUser({
  userId,
  type,
  title,
  message,
  relatedType,
  relatedId,
  io,
}: {
  userId: number
  type: string
  title: string
  message?: string
  relatedType?: string
  relatedId?: number
  io?: any
}) {
  const pref = await getPrefs(userId, type)
  if (!pref.enabled || !pref.channels.includes('in_app')) return null
  const [notif] = await getDb().insert(schema.notifications).values({
    userId,
    title,
    message: message || null,
    type,
    relatedType: relatedType || null,
    relatedId: relatedId || null,
  }).returning()
  if (io) io.to(`user:${userId}`).emit('notification', camelToSnake(notif))
  return notif
}

export async function setDefaultPrefs(userId: number) {
  const types = await getDb()
    .select({ typeKey: schema.notificationTypes.typeKey, defaultEnabled: schema.notificationTypes.defaultEnabled })
    .from(schema.notificationTypes)
  for (const t of types) {
    await getDb().insert(schema.notificationPreferences).values({
      userId,
      notificationType: t.typeKey,
      enabled: t.defaultEnabled,
      channels: '["in_app"]',
    }).onConflictDoNothing()
  }
}

export async function parseMentions(text: string) {
  const regex = /@([^@\s]+(?:\s+[^@\s]+)*)/g
  const mentions: number[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim()
    const rows = await getDb()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.name, name),
          eq(schema.users.status, 'active'),
        )
      )
      .limit(1)
    if (rows.length > 0) mentions.push(rows[0].id)
  }
  return [...new Set(mentions)]
}
