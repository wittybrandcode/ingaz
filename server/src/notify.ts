import { eq, and } from 'drizzle-orm'
import { getDb, schema } from './db/index.js'

export async function setDefaultPrefs(userId: number, tx?: any) {
  const db = tx || getDb()
  const types = await db
    .select({ typeKey: schema.notificationTypes.typeKey, defaultEnabled: schema.notificationTypes.defaultEnabled })
    .from(schema.notificationTypes)
  for (const t of types) {
    await db.insert(schema.notificationPreferences).values({
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
