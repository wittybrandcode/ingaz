import * as Sentry from '@sentry/node'
import type { Express } from 'express'

export function initSentry(app: Express) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    console.warn('SENTRY_DSN غير معرف. سيتم تخطي تهيئة Sentry.')
    return
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  })

  Sentry.setupExpressErrorHandler(app)

  console.log('Sentry initialized')
}

export { Sentry }
