import 'dotenv/config'
import { runMigrations } from './migrate.js'

/**
 * تطبيق تحديثات schema عبر Drizzle Migrator.
 * 
 * هذا يستبدل setup.ts القديم الذي كان يستخدم SQL يدوي.
 * جميع تغييرات schema يجب أن تتم عبر Drizzle ORM schema.ts
 * ثم توليد migration عبر `npm run db:generate`.
 * 
 * للترقية من الإصدار القديم:
 * 1. تأكد من تشغيل `start.bat` مرة واحدة على الأقل (يشغّل runMigrations تلقائياً)
 * 2. أو شغّل: `npx tsx src/setup.ts`
 */
export async function migrateSchema() {
  console.log('[setup] Running Drizzle migrations...')
  await runMigrations()
  console.log('[setup] Drizzle migrations complete.')
  console.log('[setup] Legacy manual SQL migrations are deprecated.')
  console.log('[setup] All schema changes should be in drizzle/*.sql via drizzle-kit.')
}

// Run directly
const isMain = process.argv[1]?.endsWith('setup.ts')
if (isMain) {
  migrateSchema().catch(e => { console.error('Migration failed:', e); process.exit(1) })
}
