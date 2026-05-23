import { describe, it, expect } from 'vitest'
import { ROLES_VALUES, STATUS_LABELS } from '@shared/types'

describe('shared constants', () => {
  it('ROLES_VALUES should have correct values', () => {
    expect(ROLES_VALUES.ADMIN).toBe(1)
  })

  it('STATUS_LABELS should contain all statuses', () => {
    expect(STATUS_LABELS.open).toBe('مفتوحة')
    expect(STATUS_LABELS.completed).toBe('منفذة')
    expect(STATUS_LABELS.cancelled).toBe('ملغية')
    expect(STATUS_LABELS.deferred).toBe('مؤجلة')
  })
})
