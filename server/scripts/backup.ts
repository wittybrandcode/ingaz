import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups')

function backup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Skipping backup.')
    process.exit(1)
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupPath = path.join(BACKUP_DIR, `ingaz-${timestamp}.sql`)

  try {
    execSync(`pg_dump "${databaseUrl}" --no-owner --file="${backupPath}"`, { stdio: 'inherit' })
    console.log(`Backup created: ${backupPath}`)

    const MAX_BACKUPS = 14
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('ingaz-') && f.endsWith('.sql'))
      .sort()
      .reverse()

    if (backups.length > MAX_BACKUPS) {
      for (const old of backups.slice(MAX_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, old))
        console.log(`Removed old backup: ${old}`)
      }
    }
  } catch (err) {
    console.error('Backup failed:', err)
    process.exit(1)
  }
}

backup()
