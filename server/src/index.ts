import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import pino from 'pino';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { eq, and, sql } from 'drizzle-orm';
import { CREDIT } from './constants.js';
import { getDb, schema } from './db/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import cookieParser from 'cookie-parser';
import { isBlacklisted, getCreditLevel, clearFrozenCache } from './middleware/auth.js';
import { NotificationService } from './services/NotificationService.js';
const notifService = new NotificationService(getDb())
import { runMigrations } from './migrate.js';
import { camelToSnake } from './lib/case-transform.js';
import { onlineUsers } from './lib/onlineUsers.js';
import { DeadlineService } from './services/DeadlineService.js';
import { BackgroundJobService } from './services/BackgroundJobService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import subtaskRoutes from './routes/subtasks.js';
import notificationRoutes from './routes/notifications.js';
import analyticsRoutes from './routes/analytics.js';
import uploadRoutes from './routes/upload.js';
import commentRoutes from './routes/comments.js';
import roleRoutes from './routes/roles.js';
import warningRoutes from './routes/warnings.js';
import healthRoutes from './routes/health.js';
import memberRoutes from './routes/members.js';
import { initSentry } from './sentry.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

const rawOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:5173'
const ALLOWED_ORIGINS = rawOrigins === '*' ? ['*'] : rawOrigins.split(',').map(s => s.trim())
const CORS_ORIGIN = ALLOWED_ORIGINS[0] === '*' ? true : ALLOWED_ORIGINS

if (!process.env.JWT_SECRET) {
  logger.fatal('JWT_SECRET غير معرف. حدد المتغير البيئي JWT_SECRET للإقلاع.');
  process.exit(1);
}

if (!process.env.ALLOWED_ORIGINS) {
  logger.warn('ALLOWED_ORIGINS غير معرف. سيتم استخدام http://localhost:5173 كقيمة افتراضية.')
} else if (ALLOWED_ORIGINS[0] !== '*') {
  try {
    const url = new URL(ALLOWED_ORIGINS[0])
    logger.info({ origin: url.origin }, 'CORS origin configured')
  } catch {
    logger.fatal({ origin: ALLOWED_ORIGINS[0] }, 'ALLOWED_ORIGINS غير صالح')
    process.exit(1)
  }
}

const app = express();
initSentry(app);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] }
});

app.set('io', io);

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64')
  next()
})

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${(res as any).locals.nonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}))

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requestId);

const pinoLogger = (req: any, res: any, next: any) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    if (res.statusCode >= 500) {
      logger.error({ reqId: req.id, method: req.method, url: req.url, status: res.statusCode, duration }, 'request')
    } else if (res.statusCode >= 400) {
      logger.warn({ reqId: req.id, method: req.method, url: req.url, status: res.statusCode, duration }, 'request')
    } else {
      logger.info({ reqId: req.id, method: req.method, url: req.url, status: res.statusCode, duration }, 'request')
    }
  })
  next()
}
app.use(pinoLogger)

app.use((req, res, next) => {
  const _success = (data: any, status = 200) => res.status(status).json({ success: true, data: camelToSnake(data) })
  res.success = _success;
  res.fail = (status, error) => res.status(status).json({ success: false, error });
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 5000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'طلبات كثيرة جداً. يرجى المحاولة لاحقاً.' }
});
app.use(limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'محاولات دخول كثيرة. يرجى المحاولة بعد 15 دقيقة.' }
});
const API_PREFIX = '/api/v1';

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const mountRoutes = (prefix: string) => {
  app.use(`${prefix}/auth/login`, authLimiter);
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/projects`, projectRoutes);
  app.use(`${prefix}/tasks`, taskRoutes);
  app.use(`${prefix}/subtasks`, subtaskRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/analytics`, analyticsRoutes);
  app.use(`${prefix}/uploads`, uploadRoutes);
  app.use(`${prefix}/comments`, commentRoutes);
  app.use(`${prefix}/roles`, roleRoutes);
  app.use(`${prefix}/warnings`, warningRoutes);
  app.use(`${prefix}/members`, memberRoutes);
};
mountRoutes('/api');
mountRoutes(API_PREFIX);

app.use('/api/health', healthRoutes);

app.use(errorHandler);

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers.cookie?.split('token=')[1]?.split(';')[0];
  if (!token) return next(new Error('No token'));
  if (await isBlacklisted(token)) return next(new Error('Token revoked'));
  try {
    socket.data.user = jwt.verify(token, process.env.JWT_SECRET!) as any;
    next();
  } catch { next(new Error('Invalid token')); }
});

// onlineUsers is imported from ./lib/onlineUsers.js

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'User:', socket.data.user?.id);
  const uid = socket.data.user?.id;
  if (uid) {
    onlineUsers.add(uid)
    socket.broadcast.emit('user:online', uid);
  }

  socket.on('join:user', (userId) => {
    if (socket.data.user?.id === userId) {
      socket.join(`user:${userId}`);
      socket.emit('online:list', Array.from(onlineUsers));
    }
  });

  socket.on('user:status', (online: boolean) => {
    if (uid) {
      if (online) {
        onlineUsers.add(uid);
        socket.broadcast.emit('user:online', uid);
      } else {
        onlineUsers.delete(uid);
        socket.broadcast.emit('user:offline', uid);
      }
    }
  });
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (uid) {
      onlineUsers.delete(uid)
      socket.broadcast.emit('user:offline', uid);
    }
  });
});

const PORT = process.env.PORT || 3001;

const CREDIT_RECOVERY_MS = 24 * 3600000;

const deadlineService = new DeadlineService(getDb())
const bgService = new BackgroundJobService()

async function autoRecoverCredit() {
  const db = getDb()
  const now = new Date();
  const dayAgo = new Date(Date.now() - CREDIT_RECOVERY_MS);

  const eligible = await db
    .select({
      id: schema.users.id,
      creditScore: schema.users.creditScore,
      lastCreditRecovery: schema.users.lastCreditRecovery,
    })
    .from(schema.users)
    .where(
      and(
        sql`${schema.users.frozenAt} IS NULL`,
        sql`${schema.users.creditScore} < ${CREDIT.MAX_SCORE}`,
        sql`(${schema.users.lastCreditRecovery} IS NULL OR ${schema.users.lastCreditRecovery} < ${dayAgo})`,
      )
    )

  for (const u of eligible) {
    const newScore = Math.min(CREDIT.MAX_SCORE, u.creditScore + CREDIT.RECOVERY_AMOUNT);
    await db.update(schema.users).set({
      creditScore: newScore,
      lastCreditRecovery: now,
    }).where(eq(schema.users.id, u.id))

    const level = await getCreditLevel(u.id)

    notifService.create({
      userId: u.id,
      type: 'daily_summary',
      title: 'تمت استعادة نقطة ✓',
      message: `تمت استعادة نقطة واحدة لرصيدك. رصيدك الحالي: ${newScore}/10`,
      relatedType: undefined,
      relatedId: undefined,
    }, io);

    if (level && (level as any).name !== 'frozen') {
      await db.update(schema.users).set({
        frozenAt: null,
        freezeReason: null,
      }).where(eq(schema.users.id, u.id))
      const { clearFrozenCache } = await import('./middleware/auth.js')
      clearFrozenCache(u.id);
    }
  }
}

async function checkExpiredWarnings() {
  const db = getDb()
  const expired = await db
    .select({
      id: schema.warnings.id,
      userId: schema.warnings.userId,
      reason: schema.warnings.reason,
      status: schema.warnings.status,
      deadline: schema.warnings.deadline,
      pointsDeducted: schema.warnings.pointsDeducted,
      creditBefore: schema.warnings.creditBefore,
      creditAfter: schema.warnings.creditAfter,
      warningTypeName: schema.warnings.warningTypeName,
      userName: schema.users.name,
      userCreditScore: schema.users.creditScore,
    })
    .from(schema.warnings)
    .innerJoin(schema.users, eq(schema.warnings.userId, schema.users.id))
    .where(
      and(
        eq(schema.warnings.status, 'pending'),
        sql`${schema.warnings.deadline} < NOW()`,
      )
    )

  for (const w of expired) {
    await db.update(schema.warnings).set({ status: 'ignored' }).where(eq(schema.warnings.id, w.id))

    const newScore = Math.max(CREDIT.MIN_SCORE, (w.userCreditScore || CREDIT.DEFAULT_SCORE) - w.pointsDeducted);
    await db.update(schema.warnings).set({ creditAfter: newScore }).where(eq(schema.warnings.id, w.id))
    await db.update(schema.users).set({ creditScore: newScore }).where(eq(schema.users.id, w.userId))

    notifService.create({
      userId: w.userId,
      type: 'warning_ignored',
      title: `تم خصم ${w.pointsDeducted} نقاط`,
      message: `تجاوزت مهلة الرد على الإنذار. رصيدك الحالي: ${newScore}/10`,
      relatedType: 'warning',
      relatedId: w.id,
    }, io);

    const level = await getCreditLevel(w.userId);
    if (level && (level as any).name === 'frozen' && !(level as any).canLogin) {
      await db.update(schema.users).set({
        frozenAt: new Date(),
        freezeReason: `وصل رصيدك إلى ${newScore} نقاط بعد تجاهل الإنذار`,
      }).where(eq(schema.users.id, w.userId))
      clearFrozenCache(w.userId);
      notifService.create({
        userId: w.userId,
        type: 'account_frozen',
        title: 'تم تجميد حسابك ❄️',
        message: `وصل رصيد نقاطك إلى ${newScore}/10. تم تجميد حسابك تلقائياً.`,
        relatedType: undefined,
        relatedId: undefined,
      }, io);
    }
  }
}

async function sendDailySummaries() {
  const db = getDb()
  const activeUsers = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.status, 'active'))
  if (activeUsers.length > 0) {
    await notifService.createMany(
      activeUsers.map((u: any) => ({
        userId: u.id,
        type: 'daily_summary' as const,
        title: 'ملخصك اليومي متوفر',
        message: 'يمكنك الاطلاع على المهام المعلقة والمواعيد النهائية من لوحة التحكم',
      })),
    )
  }
}

const INTERVAL_1MIN = 60000;
const INTERVAL_10MIN = 600000;

bgService.register({ type: 'checkDeadlines', intervalMs: INTERVAL_1MIN, execute: () => deadlineService.checkDeadlines(io) });
bgService.register({ type: 'checkExpiredWarnings', intervalMs: INTERVAL_1MIN, execute: checkExpiredWarnings });
bgService.register({ type: 'autoRecoverCredit', intervalMs: INTERVAL_10MIN, execute: autoRecoverCredit });
bgService.register({ type: 'sendDailySummaries', intervalMs: 12 * 3600000, execute: sendDailySummaries });

runMigrations().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    bgService.start();
  });
});
