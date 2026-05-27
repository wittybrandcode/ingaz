import { Router } from 'express'
import { sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'

const router = Router()

router.get('/', async (_req, res) => {
  let dbStatus = 'connected'
  try {
    await getDb().execute(sql`SELECT 1`)
  } catch {
    dbStatus = 'disconnected'
  }

  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    uptime: process.uptime(),
    db: dbStatus,
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
  })
})

export default router
