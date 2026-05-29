import * as Sentry from '@sentry/node'
import type { Express } from 'express'
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

export function initSentry(app: Express) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    logger.warn('SENTRY_DSN غير معرف. سيتم تخطي تهيئة Sentry.')
    return
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  })

  Sentry.setupExpressErrorHandler(app)

  logger.info('Sentry initialized')
}

export { Sentry }
