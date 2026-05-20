export function camelToSnake<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (value instanceof Date) return value as T
  if (value instanceof RegExp) return value as T
  if (Array.isArray(value)) return value.map(camelToSnake) as T

  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    result[snakeKey] = camelToSnake(val)
  }
  return result as T
}
