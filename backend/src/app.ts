import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { caloriesRouter } from './modules/calories/calories.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';
import { weightsRouter } from './modules/weights/weights.routes.js';
import { workoutsRouter } from './modules/workouts/workouts.routes.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

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
