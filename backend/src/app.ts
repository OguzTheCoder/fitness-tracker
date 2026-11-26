import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { createRateLimiters, type RateLimitConfig } from './middlewares/rateLimit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { caloriesRouter } from './modules/calories/calories.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';
import { weightsRouter } from './modules/weights/weights.routes.js';
import { workoutsRouter } from './modules/workouts/workouts.routes.js';

export interface CreateAppOptions {
  rateLimit?: Partial<RateLimitConfig>;
}

const AUTH_WRITE_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

export function createApp(options?: CreateAppOptions) {
  const app = express();
  const { apiLimiter, authWriteLimiters } = createRateLimiters(options?.rateLimit);

  app.disable('x-powered-by');
  app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '16kb' }));

  app.use('/api', apiLimiter);
  app.post(AUTH_WRITE_PATHS, ...authWriteLimiters);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'fitness-tracker-backend' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/weights', weightsRouter);
  app.use('/api/calories', caloriesRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/stats', statsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
