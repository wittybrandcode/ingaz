import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getPool } from './db/index.js'
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

export async function runMigrations() {
  const pool = getPool()
  const db = drizzle(pool)
  logger.info('Running migrations...')
  await migrate(db, { migrationsFolder: './drizzle' })
  logger.info('Migrations complete!')
}