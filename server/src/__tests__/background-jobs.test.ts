import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BackgroundJobService } from '../services/BackgroundJobService.js'

let bgService: BackgroundJobService
let mockDb: any

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    backgroundJobs: {
      id: 'id', jobType: 'job_type', status: 'status',
      lastRunAt: 'last_run_at', nextRunAt: 'next_run_at',
      intervalMs: 'interval_ms', retryCount: 'retry_count',
      maxRetries: 'max_retries', lastError: 'last_error',
      createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  addActivityLog: vi.fn(),
  isProjectManager: vi.fn().mockReturnValue(false),
  getTaskAssignees: vi.fn().mockReturnValue([]),
  getSubtaskAssignees: vi.fn().mockReturnValue([]),
  getBulkSubtaskAssignees: vi.fn().mockReturnValue({}),
  getUserPermissions: vi.fn().mockResolvedValue([]),
  uploadsDir: '/test/uploads',
}))

vi.mock('../db/schema.js', () => ({
  backgroundJobs: {
    id: 'id', jobType: 'job_type', status: 'status',
    lastRunAt: 'last_run_at', nextRunAt: 'next_run_at',
    intervalMs: 'interval_ms', retryCount: 'retry_count',
    maxRetries: 'max_retries', lastError: 'last_error',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
}))

function createMockDb() {
  const rows: any[] = []

  const mockSelect: any = {
    _from: null,
    _where: null,
    _limit: null,

    from: vi.fn(function (t: any) {
      mockSelect._from = t
      return mockSelect
    }),

    where: vi.fn(function (c: any) {
      mockSelect._where = c
      return mockSelect
    }),

    limit: vi.fn(function (n: number) {
      mockSelect._limit = n
      return Promise.resolve(rows.splice(0))
    }),

    orderBy: vi.fn(function () {
      return mockSelect
    }),
  }

  return {
    data: rows,

    select: vi.fn(function () {
      mockSelect._from = null
      mockSelect._where = null
      mockSelect._limit = null
      return mockSelect
    }),

    insert: vi.fn(function () {
      return {
        values: vi.fn(function (vals: any) {
          rows.push(vals)
          return { returning: vi.fn(() => Promise.resolve([vals])), run: vi.fn(), execute: vi.fn() }
        }),
        run: vi.fn(),
      }
    }),

    update: vi.fn(function () {
      return {
        set: vi.fn(function (vals: any) {
          return {
            where: vi.fn(function () {
              if (rows.length > 0) {
                Object.assign(rows[0], vals)
              }
              return { run: vi.fn(), execute: vi.fn() }
            }),
            run: vi.fn(),
            execute: vi.fn(),
          }
        }),
        run: vi.fn(),
      }
    }),

    delete: vi.fn(function () {
      return { where: vi.fn(() => ({ run: vi.fn() })), run: vi.fn() }
    }),
  }
}

beforeEach(() => {
  mockDb = createMockDb()
  bgService = new BackgroundJobService()
  vi.useFakeTimers()
})

afterEach(() => {
  bgService.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('BackgroundJobService', () => {
  it('registers a job definition', () => {
    const execute = vi.fn()
    bgService.register({ type: 'testJob', intervalMs: 60000, execute })
    expect((bgService as any).jobs.has('testJob')).toBe(true)
  })

  it('does not start twice', async () => {
    const execute = vi.fn()
    bgService.register({ type: 'testJob', intervalMs: 60000, execute })

    await bgService.start()
    expect((bgService as any).started).toBe(true)

    await bgService.start()
    expect((bgService as any).started).toBe(true)
  })

  it('stop clears all timers and marks as stopped', async () => {
    const execute = vi.fn()
    bgService.register({ type: 'timerJob', intervalMs: 5000, execute })
    await bgService.start()

    expect((bgService as any).timers.size).toBe(1)

    bgService.stop()
    expect((bgService as any).timers.size).toBe(0)
    expect((bgService as any).started).toBe(false)
  })

  it('creates initial DB record on first start for new job', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    bgService.register({ type: 'newJob', intervalMs: 60000, execute })
    await bgService.start()

    expect(mockDb.select).toHaveBeenCalled()
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('inserts job record with correct fields', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    bgService.register({ type: 'validateJob', intervalMs: 30000, execute })

    // Simulate no existing record
    const originalSelect = mockDb.select
    mockDb.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    }))

    await bgService.start()

    mockDb.select = originalSelect
    expect(mockDb.insert).toHaveBeenCalled()
  })

  it('runs execute when job is in the past', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    // Simulate existing record with past nextRunAt
    mockDb.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => {
            const record = { id: 1, jobType: 'catchUpJob', status: 'idle', nextRunAt: new Date(Date.now() - 60000).toISOString(), intervalMs: 60000, retryCount: 0 }
            const updateResult = { status: 'idle', nextRunAt: new Date(Date.now() + 60000).toISOString(), retryCount: 0 }
            mockDb.update = vi.fn(() => ({
              set: vi.fn(() => ({
                where: vi.fn(() => Promise.resolve()),
                run: vi.fn(),
              })),
            }))
            return Promise.resolve([record])
          }),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    }))

    bgService.register({ type: 'catchUpJob', intervalMs: 60000, execute })
    await bgService.start()

    // The job was run because nextRunAt was in the past
    expect(execute).toHaveBeenCalled()
  })

  it('does not run job when nextRunAt is in the future', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    mockDb.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => {
            return Promise.resolve([{ id: 1, jobType: 'futureJob', status: 'idle', nextRunAt: new Date(Date.now() + 3600000).toISOString(), intervalMs: 60000, retryCount: 0 }])
          }),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    }))

    bgService.register({ type: 'futureJob', intervalMs: 60000, execute })
    await bgService.start()

    expect(execute).not.toHaveBeenCalled()
  })

  it('handles job execution failure by updating error', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('فشل مؤقت'))

    mockDb.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => {
            return Promise.resolve([{ id: 1, jobType: 'failingJob', status: 'idle', nextRunAt: new Date(Date.now() - 60000).toISOString(), intervalMs: 60000, retryCount: 0 }])
          }),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    }))

    let capturedSetValues: any = null
    mockDb.update = vi.fn(() => ({
      set: vi.fn((vals: any) => {
        capturedSetValues = vals
        return {
          where: vi.fn(() => Promise.resolve()),
          run: vi.fn(),
        }
      }),
    }))

    bgService.register({ type: 'failingJob', intervalMs: 60000, execute })
    await bgService.start()

    expect(execute).toHaveBeenCalled()
    expect(capturedSetValues).not.toBeNull()
    expect(capturedSetValues.lastError).toContain('فشل مؤقت')
  })

  it('registers multiple job types', () => {
    const exec1 = vi.fn()
    const exec2 = vi.fn()
    bgService.register({ type: 'jobA', intervalMs: 10000, execute: exec1 })
    bgService.register({ type: 'jobB', intervalMs: 20000, execute: exec2 })
    expect((bgService as any).jobs.size).toBe(2)
  })
})
