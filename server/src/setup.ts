import 'dotenv/config'
import { Pool } from 'pg'

export async function migrateSchema() {
  const url = new URL(process.env.DATABASE_URL!)
  const pool = new Pool({
    host: url.hostname,
    port: Number(url.port) || 5432,
    database: url.pathname.slice(1),
    user: url.username,
    password: url.password ? decodeURIComponent(url.password) : undefined,
  })

  console.log('[1/4] Dropping old CHECK constraints...')
  const tables = ['subtasks', 'tasks', 'projects']
  for (const tbl of tables) {
    const res = await pool.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = '${tbl}'::regclass AND contype = 'c'`
    )
    for (const row of res.rows) {
      await pool.query(`ALTER TABLE "${tbl}" DROP CONSTRAINT "${row.conname}"`)
    }
  }

  console.log('[2/4] Migrating existing data to new statuses...')
  await pool.query(`UPDATE subtasks SET status = 'open' WHERE status IN ('pending', 'in_progress', 'submitted')`)
  await pool.query(`UPDATE subtasks SET status = 'completed' WHERE status = 'approved'`)
  await pool.query(`UPDATE subtasks SET status = 'cancelled' WHERE status = 'rejected'`)
  await pool.query(`UPDATE tasks SET status = 'open' WHERE status = 'active'`)

  console.log('[3/4] Adding new CHECK constraints...')
  await pool.query(`ALTER TABLE subtasks ADD CONSTRAINT subtasks_status_check CHECK (status IN ('open', 'completed', 'cancelled', 'deferred'))`)
  await pool.query(`ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('active', 'open', 'in_progress', 'completed'))`)
  await pool.query(`ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('active', 'completed', 'archived'))`)

  console.log('[4/4] Adding new columns...')
  await pool.query('ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS winner_comment_id INTEGER')
  await pool.query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_winner INTEGER DEFAULT 0')
  await pool.query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS winner_selected_at TIMESTAMP')
  await pool.query('ALTER TABLE comments ADD COLUMN IF NOT EXISTS winner_selected_by INTEGER REFERENCES users(id)')
  await pool.query(`ALTER TABLE subtasks ALTER COLUMN status SET DEFAULT 'open'`)

  await pool.end()
  console.log('Schema migration complete.')
}

// Run directly
const isMain = process.argv[1]?.endsWith('setup.ts')
if (isMain) {
  migrateSchema().catch(e => { console.error('Migration failed:', e); process.exit(1) })
}
