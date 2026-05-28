import { eq, lt, lte, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import * as schema from '../db/schema.js'

interface JobDefinition {
  type: string
  intervalMs: number
  execute: () => Promise<void>
}

export class BackgroundJobService {
  private jobs = new Map<string, JobDefinition>()
  private running = new Map<string, Promise<void>>()
  private timers = new Map<string, NodeJS.Timeout>()
  private started = false
  private db: any

  constructor(db?: any) {
    this.db = db
  }

  private getDb(): any {
    return this.db || getDb()
  }

  register(job: JobDefinition) {
    this.jobs.set(job.type, job)
  }

  async start() {
    if (this.started) return
    this.started = true
    const db = this.getDb()

    // Rehydrate: catch up on missed runs since server was down
    for (const [, job] of this.jobs) {
      await this.catchUp(job)
    }

    // Set up recurring timers
    for (const [, job] of this.jobs) {
      this.scheduleNext(job)
    }
  }

  async stop() {
    this.started = false
    for (const [, timer] of this.timers) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.running.clear()
  }

  private async catchUp(job: JobDefinition) {
    try {
      const db = this.getDb()
      const [record] = await db
        .select()
        .from(schema.backgroundJobs)
        .where(eq(schema.backgroundJobs.jobType, job.type))
        .limit(1)

      if (!record) {
        // First time — seed the record
        await db.insert(schema.backgroundJobs).values({
          jobType: job.type,
          status: 'idle',
          nextRunAt: new Date(Date.now() + job.intervalMs),
          intervalMs: job.intervalMs,
        })
        return
      }

      // If next_run_at is in the past, run immediately
      if (record.status !== 'running' && new Date(record.nextRunAt) <= new Date()) {
        await this.runJob(job, record.id)
      }
    } catch (e) {
      console.error(`[BackgroundJob] catchUp error for ${job.type}:`, e)
    }
  }

  private scheduleNext(job: JobDefinition) {
    const timer = setTimeout(async () => {
      try {
        const db = this.getDb()
        const [record] = await db
          .select()
          .from(schema.backgroundJobs)
          .where(eq(schema.backgroundJobs.jobType, job.type))
          .limit(1)

        if (record) {
          await this.runJob(job, record.id)
        }
      } catch (e) {
        console.error(`[BackgroundJob] run error for ${job.type}:`, e)
      }

      // Schedule next run
      if (this.started) {
        this.scheduleNext(job)
      }
    }, job.intervalMs)

    this.timers.set(job.type, timer)
  }

  private async runJob(job: JobDefinition, jobId: number) {
    // Prevent concurrent runs
    if (this.running.has(job.type)) {
      return
    }

    const db = this.getDb()
    const runPromise = (async () => {
      try {
        // Mark as running
        await db
          .update(schema.backgroundJobs)
          .set({
            status: 'running',
            lastRunAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.backgroundJobs.id, jobId))

        // Execute
        await job.execute()

        // Mark as completed + schedule next
        await db
          .update(schema.backgroundJobs)
          .set({
            status: 'idle',
            nextRunAt: new Date(Date.now() + job.intervalMs),
            retryCount: 0,
            updatedAt: new Date(),
          })
          .where(eq(schema.backgroundJobs.id, jobId))
      } catch (e: any) {
        console.error(`[BackgroundJob] ${job.type} failed:`, e)

        const [record] = await db
          .select({ retryCount: schema.backgroundJobs.retryCount })
          .from(schema.backgroundJobs)
          .where(eq(schema.backgroundJobs.id, jobId))
          .limit(1)

        const retryCount = (record?.retryCount ?? 0) + 1
        const maxRetries = job.type === 'sendDailySummaries' ? 0 : 3

        if (retryCount <= maxRetries) {
          // Retry after a backoff delay
          const backoffMs = Math.min(retryCount * 60000, 300000)
          await db
            .update(schema.backgroundJobs)
            .set({
              status: 'idle',
              nextRunAt: new Date(Date.now() + backoffMs),
              retryCount,
              lastError: e.message || String(e),
              updatedAt: new Date(),
            })
            .where(eq(schema.backgroundJobs.id, jobId))
        } else {
          // Max retries exceeded — mark as failed, retry at next interval
          await db
            .update(schema.backgroundJobs)
            .set({
              status: 'failed',
              nextRunAt: new Date(Date.now() + job.intervalMs),
              retryCount,
              lastError: e.message || String(e),
              updatedAt: new Date(),
            })
            .where(eq(schema.backgroundJobs.id, jobId))
        }
      } finally {
        this.running.delete(job.type)
      }
    })()

    this.running.set(job.type, runPromise)
    await runPromise
  }
}

export const backgroundJobService = new BackgroundJobService()
