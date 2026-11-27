import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import { env, parseCorsOrigins } from './config/env.js';
import { prisma } from './config/prisma.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { createRateLimiters, type RateLimitConfig } from './middlewares/rateLimit.js';
import { accessRouter } from './modules/access/access.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { BACKUP_IMPORT_MAX_BODY } from './modules/backup/backup.constants.js';
import { backupRouter } from './modules/backup/backup.routes.js';
import { caloriesRouter } from './modules/calories/calories.routes.js';
import { cardioRouter } from './modules/cardio/cardio.routes.js';
import { exercisesRouter } from './modules/exercises/exercises.routes.js';
import { foodsRouter } from './modules/foods/foods.routes.js';
import { nutritionRouter } from './modules/nutrition/nutrition.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { recipesRouter } from './modules/recipes/recipes.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';
import { stepsRouter } from './modules/steps/steps.routes.js';
import { SYNC_PUSH_MAX_BODY } from './modules/sync/sync.constants.js';
import { syncRouter } from './modules/sync/sync.routes.js';
import { weightsRouter } from './modules/weights/weights.routes.js';
import { workoutsRouter } from './modules/workouts/workouts.routes.js';
import { workoutTemplatesRouter } from './modules/workoutTemplates/workoutTemplates.routes.js';

export const APP_VERSION = '2.0.1';

export interface CreateAppOptions {
  rateLimit?: Partial<RateLimitConfig>;
  appPin?: string | null;
  nodeEnv?: 'development' | 'test' | 'production';
  allowPublicAuth?: boolean;
  cookieSecure?: boolean;
  backupImportLimit?: string;
  syncPushLimit?: string;
  trustProxy?: number;
  corsOrigins?: string[];
  serveFrontend?: boolean;
  frontendDistDir?: string;
}

const AUTH_WRITE_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/access/setup',
  '/api/access/unlock',
  '/api/access/local-session',
];

const PIN_ACCESS_PATHS = ['/api/access/setup', '/api/access/unlock'];

export function createApp(options?: CreateAppOptions) {
  const app = express();
  const {
    apiLimiter,
    authWriteLimiters,
    pinGlobalLimiter,
    barcodeLimiter,
    backupLimiter,
    syncLimiter,
  } = createRateLimiters(options?.rateLimit);

  const trustProxy = options?.trustProxy ?? env.TRUST_PROXY;
  if (trustProxy > 0) {
    app.set('trust proxy', trustProxy);
  }

  if (options?.appPin !== undefined) {
    app.locals.appPin = options.appPin;
  }
  if (options?.nodeEnv !== undefined) {
    app.locals.nodeEnv = options.nodeEnv;
  }
  if (options?.allowPublicAuth !== undefined) {
    app.locals.allowPublicAuth = options.allowPublicAuth;
  }
  if (options?.cookieSecure !== undefined) {
    app.locals.cookieSecure = options.cookieSecure;
  }

  const allowedOrigins = new Set(options?.corsOrigins ?? parseCorsOrigins(env.CORS_ORIGIN));

  app.disable('x-powered-by');
  app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin.replace(/\/$/, ''))) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(cookieParser());

  app.use('/api/backup', backupLimiter);
  app.post(
    '/api/backup/import',
    express.json({ limit: options?.backupImportLimit ?? BACKUP_IMPORT_MAX_BODY }),
  );

  app.use('/api/sync', syncLimiter);
  app.post('/api/sync', express.json({ limit: options?.syncPushLimit ?? SYNC_PUSH_MAX_BODY }));

  app.use(express.json({ limit: '16kb' }));

  app.use('/api', apiLimiter);
  app.post(AUTH_WRITE_PATHS, ...authWriteLimiters);
  app.post(PIN_ACCESS_PATHS, pinGlobalLimiter);
  app.use('/api/foods/barcode', barcodeLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'fitness-tracker-backend' });
  });

  app.get('/api/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        service: 'fitness-tracker-backend',
        version: APP_VERSION,
        database: 'up',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'degraded',
        service: 'fitness-tracker-backend',
        version: APP_VERSION,
        database: 'down',
        error: 'Veritabanı bağlantısı kurulamadı.',
      });
    }
  });

  app.use('/api/access', accessRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/backup', backupRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/foods', foodsRouter);
  app.use('/api/recipes', recipesRouter);
  app.use('/api/nutrition', nutritionRouter);
  app.use('/api/weights', weightsRouter);
  app.use('/api/calories', caloriesRouter);
  app.use('/api/exercises', exercisesRouter);
  app.use('/api/workout-templates', workoutTemplatesRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/cardio', cardioRouter);
  app.use('/api/steps', stepsRouter);
  app.use('/api/stats', statsRouter);

  const shouldServeFrontend = options?.serveFrontend ?? env.SERVE_FRONTEND === 'true';
  if (shouldServeFrontend) {
    const defaultDist = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../frontend/dist',
    );
    const distDir = path.resolve(options?.frontendDistDir ?? env.FRONTEND_DIST_DIR ?? defaultDist);
    const indexHtml = path.join(distDir, 'index.html');

    if (fs.existsSync(indexHtml)) {
      app.use(
        express.static(distDir, {
          setHeaders(res, filePath) {
            if (
              filePath.endsWith('sw.js') ||
              filePath.endsWith('manifest.webmanifest') ||
              filePath.endsWith('index.html')
            ) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        }),
      );
      app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexHtml);
      });
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
