import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getPool } from './db/index.js'

export async function runMigrations() {
  const pool = getPool()
  const db = drizzle(pool)
  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations complete!')
}