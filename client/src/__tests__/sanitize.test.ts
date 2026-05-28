import { describe, it, expect } from 'vitest'
import { sanitizeHTML } from '../lib/sanitize'

describe('sanitizeHTML', () => {
  it('allows safe tags', () => {
    expect(sanitizeHTML('<b>نص</b>')).toBe('<b>نص</b>')
    expect(sanitizeHTML('<i>مائل</i>')).toBe('<i>مائل</i>')
    expect(sanitizeHTML('<a href="https://example.com">رابط</a>')).toContain('https://example.com')
  })

  it('strips dangerous tags', () => {
    expect(sanitizeHTML('<script>alert(1)</script>')).not.toContain('<script>')
    expect(sanitizeHTML('<iframe src="evil.com"></iframe>')).not.toContain('<iframe>')
  })

  it('blocks javascript: URIs', () => {
    const result = sanitizeHTML('<a href="javascript:alert(1)">نص</a>')
    expect(result).not.toContain('javascript')
  })

  it('allows safe URIs', () => {
    const result = sanitizeHTML('<a href="https://safe.com">رابط</a>')
    expect(result).toContain('https://safe.com')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeHTML('')).toBe('')
  })

  it('strips data attributes', () => {
    const result = sanitizeHTML('<span data-xss="evil">نص</span>')
    expect(result).not.toContain('data-xss')
  })
})
