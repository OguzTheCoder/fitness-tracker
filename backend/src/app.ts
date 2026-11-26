import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
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
import { weightsRouter } from './modules/weights/weights.routes.js';
import { workoutsRouter } from './modules/workouts/workouts.routes.js';
import { workoutTemplatesRouter } from './modules/workoutTemplates/workoutTemplates.routes.js';

export interface CreateAppOptions {
  rateLimit?: Partial<RateLimitConfig>;
  appPin?: string | null;
  cookieSecure?: boolean;
  backupImportLimit?: string;
}

const AUTH_WRITE_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/access/setup',
  '/api/access/unlock',
];

export function createApp(options?: CreateAppOptions) {
  const app = express();
  const { apiLimiter, authWriteLimiters, barcodeLimiter, backupLimiter } = createRateLimiters(
    options?.rateLimit,
  );

  if (options?.appPin !== undefined) {
    app.locals.appPin = options.appPin;
  }
  if (options?.cookieSecure !== undefined) {
    app.locals.cookieSecure = options.cookieSecure;
  }

  app.disable('x-powered-by');
  app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(cookieParser());
  app.use('/api/backup', backupLimiter);
  app.post(
    '/api/backup/import',
    express.json({ limit: options?.backupImportLimit ?? BACKUP_IMPORT_MAX_BODY }),
  );
  app.use(express.json({ limit: '16kb' }));

  app.use('/api', apiLimiter);
  app.post(AUTH_WRITE_PATHS, ...authWriteLimiters);
  app.use('/api/foods/barcode', barcodeLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'fitness-tracker-backend' });
  });

  app.use('/api/access', accessRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/backup', backupRouter);
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
