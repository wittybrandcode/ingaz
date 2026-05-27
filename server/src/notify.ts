import { eq, and, inArray } from 'drizzle-orm'
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
  const names: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    names.push(match[1].trim())
  }
  if (names.length === 0) return []

  const uniqueNames = [...new Set(names)]
  const rows: any[] = await getDb()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        inArray(schema.users.name, uniqueNames),
        eq(schema.users.status, 'active'),
      )
    )
  return rows.map((r: any) => r.id)
}