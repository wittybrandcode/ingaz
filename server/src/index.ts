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
import { eq, and, lte, sql } from 'drizzle-orm';
import { ROLES, CREDIT } from './constants.js';
import { getDb, schema } from './db/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import cookieParser from 'cookie-parser';
import { isBlacklisted, getCreditLevel, clearFrozenCache } from './middleware/auth.js';
import { notifyUser } from './notify.js';
import { runMigrations } from './migrate.js';
import { camelToSnake } from './lib/case-transform.js';

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
import { initSentry } from './sentry.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
})

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

if (!process.env.JWT_SECRET) {
  logger.fatal('JWT_SECRET غير معرف. حدد المتغير البيئي JWT_SECRET للإقلاع.');
  process.exit(1);
}

if (!process.env.ALLOWED_ORIGINS) {
  logger.warn('ALLOWED_ORIGINS غير معرف. سيتم استخدام http://localhost:5173 كقيمة افتراضية.')
}

try {
  const url = new URL(ALLOWED_ORIGINS[0])
  logger.info({ origin: url.origin }, 'CORS origin configured')
} catch {
  logger.fatal({ origin: ALLOWED_ORIGINS[0] }, 'ALLOWED_ORIGINS غير صالح')
  process.exit(1)
}

const app = express();
initSentry(app);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
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

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
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

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, 'User:', socket.data.user?.id);
  socket.on('join:user', (userId) => {
    if (socket.data.user?.id === userId) {
      socket.join(`user:${userId}`);
    }
  });
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 3001;
runMigrations().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

const CREDIT_RECOVERY_MS = 24 * 3600000;

const MS_6H = 6 * 3600000;
const MS_24H = 24 * 3600000;

async function checkDeadlines() {
  const db = getDb()
  const now = Date.now();
  const in6h = now + MS_6H;
  const in24h = now + MS_24H;

  const pendingReminders = await db
    .select()
    .from(schema.deadlineReminders)
    .where(eq(schema.deadlineReminders.sent, 0))
  const sentMap: Record<string, any> = {};
  for (const r of pendingReminders) {
    if (!sentMap[r.subtaskId]) sentMap[r.subtaskId] = {};
    sentMap[r.subtaskId][r.reminderType] = true;
  }

  const subtasksWithDeadlines = await db
    .select({
      id: schema.subtasks.id,
      title: schema.subtasks.title,
      deadline: schema.subtasks.deadline,
      assignedTo: schema.subtasks.assignedTo,
      status: schema.subtasks.status,
      taskTitle: schema.tasks.title,
      projectTitle: schema.projects.title,
      userName: schema.users.name,
    })
    .from(schema.subtasks)
    .innerJoin(schema.tasks, eq(schema.subtasks.taskId, schema.tasks.id))
    .innerJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
    .leftJoin(schema.users, eq(schema.subtasks.assignedTo, schema.users.id))
    .where(
      and(
        sql`${schema.subtasks.deadline} IS NOT NULL`,
        sql`${schema.subtasks.status} NOT IN ('approved', 'rejected')`,
      )
    )

  for (const s of subtasksWithDeadlines) {
    const dl = new Date(s.deadline).getTime();
    const reminderKey = (type: string) => `${s.id}:${type}`;

    if (dl > now && dl <= in24h && !sentMap[s.id]?.['24h'] && s.assignedTo) {
      try {
        await db.insert(schema.deadlineReminders).values({
          subtaskId: s.id,
          reminderType: '24h',
        })
      } catch {}
      notifyUser({
        userId: s.assignedTo,
        type: 'deadline_approaching_24h',
        title: '⏰ تبقى أقل من 24 ساعة على الموعد النهائي',
        message: `مهمة "${s.title}" في "${s.taskTitle}" - ${new Date(s.deadline).toLocaleDateString('ar-SA')}`,
        relatedType: 'subtask',
        relatedId: s.id,
        io
      });
      await db.update(schema.deadlineReminders).set({ sent: 1 })
        .where(
          and(
            eq(schema.deadlineReminders.subtaskId, s.id),
            eq(schema.deadlineReminders.reminderType, '24h'),
          )
        )
    }

    if (dl > now && dl <= in6h && !sentMap[s.id]?.['6h'] && s.assignedTo) {
      try {
        await db.insert(schema.deadlineReminders).values({
          subtaskId: s.id,
          reminderType: '6h',
        })
      } catch {}
      notifyUser({
        userId: s.assignedTo,
        type: 'deadline_approaching_6h',
        title: '🔴 تبقى أقل من 6 ساعات على الموعد النهائي!',
        message: `مهمة "${s.title}" في "${s.taskTitle}" - ${new Date(s.deadline).toLocaleDateString('ar-SA')}`,
        relatedType: 'subtask',
        relatedId: s.id,
        io
      });
      await db.update(schema.deadlineReminders).set({ sent: 1 })
        .where(
          and(
            eq(schema.deadlineReminders.subtaskId, s.id),
            eq(schema.deadlineReminders.reminderType, '6h'),
          )
        )
    }

    if (dl < now - 60000 && !sentMap[s.id]?.['overdue'] && s.assignedTo) {
      try {
        await db.insert(schema.deadlineReminders).values({
          subtaskId: s.id,
          reminderType: 'overdue',
        })
      } catch {}
      notifyUser({
        userId: s.assignedTo,
        type: 'deadline_overdue',
        title: '⛔ تم تجاوز الموعد النهائي!',
        message: `مهمة "${s.title}" في "${s.taskTitle}" - كان الموعد ${new Date(s.deadline).toLocaleDateString('ar-SA')}`,
        relatedType: 'subtask',
        relatedId: s.id,
        io
      });
      const managers = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(sql`${schema.users.roleId} IN (${ROLES.ADMIN}, ${ROLES.DEPUTY})`)
      for (const m of managers) {
        if (m.id !== s.assignedTo) {
          notifyUser({
            userId: m.id,
            type: 'deadline_overdue',
            title: `⛔ ${s.userName || 'موظف'} تجاوز الموعد النهائي`,
            message: `مهمة "${s.title}" في "${s.taskTitle}"`,
            relatedType: 'subtask',
            relatedId: s.id,
            io
          });
        }
      }
      await db.update(schema.deadlineReminders).set({ sent: 1 })
        .where(
          and(
            eq(schema.deadlineReminders.subtaskId, s.id),
            eq(schema.deadlineReminders.reminderType, 'overdue'),
          )
        )
    }
  }
}

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

    notifyUser({
      userId: u.id,
      type: 'daily_summary',
      title: 'تمت استعادة نقطة ✓',
      message: `تمت استعادة نقطة واحدة لرصيدك. رصيدك الحالي: ${newScore}/10`,
      relatedType: undefined,
      relatedId: undefined,
      io
    });

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

    notifyUser({
      userId: w.userId,
      type: 'warning_ignored',
      title: `تم خصم ${w.pointsDeducted} نقاط`,
      message: `تجاوزت مهلة الرد على الإنذار. رصيدك الحالي: ${newScore}/10`,
      relatedType: 'warning',
      relatedId: w.id,
      io
    });

    const level = await getCreditLevel(w.userId);
    if (level && (level as any).name === 'frozen' && !(level as any).canLogin) {
      await db.update(schema.users).set({
        frozenAt: new Date(),
        freezeReason: `وصل رصيدك إلى ${newScore} نقاط بعد تجاهل الإنذار`,
      }).where(eq(schema.users.id, w.userId))
      clearFrozenCache(w.userId);
      notifyUser({
        userId: w.userId,
        type: 'account_frozen',
        title: 'تم تجميد حسابك ❄️',
        message: `وصل رصيد نقاطك إلى ${newScore}/10. تم تجميد حسابك تلقائياً.`,
        relatedType: undefined,
        relatedId: undefined,
        io
      });
    }
  }
}

const INTERVAL_1MIN = 60000;

function safeInterval(fn: () => Promise<void>, ms: number) {
  setInterval(() => { fn().catch(e => console.error('Background job error:', e)); }, ms);
  fn().catch(e => console.error('Background job initial run error:', e));
}

safeInterval(checkDeadlines, INTERVAL_1MIN);
safeInterval(checkExpiredWarnings, INTERVAL_1MIN);
safeInterval(autoRecoverCredit, INTERVAL_1MIN);
