export const ROLES = Object.freeze({
  ADMIN: 1,
  DEPUTY: 2,
  EMPLOYEE: 3,
})

export const PAGINATION = Object.freeze({
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
});

export const CREDIT = Object.freeze({
  DEFAULT_SCORE: 10,
  MAX_SCORE: 10,
  MIN_SCORE: 0,
  RECOVERY_PERIOD_MS: 24 * 3600000,
  RECOVERY_AMOUNT: 1,
});

export const TOKEN = Object.freeze({
  EXPIRY: '7d',
});

export const WARNING_DEADLINE_HOURS = 48;

export const JWT_SECRET_REQUIRED = 'JWT_SECRET environment variable is required. Set it before starting the server.';
