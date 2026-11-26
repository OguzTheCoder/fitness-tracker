import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import {
  createNutritionLogSchema,
  nutritionLogListQuerySchema,
  updateNutritionLogSchema,
} from './nutrition.schema.js';
import {
  createNutritionLog,
  deleteNutritionLog,
  listNutritionLogs,
  updateNutritionLog,
} from './nutrition.service.js';

export const nutritionRouter = Router();

nutritionRouter.use(authenticate);

nutritionRouter.get('/logs', async (req, res) => {
  const query = nutritionLogListQuerySchema.parse(req.query);
  const result = await listNutritionLogs(req.authUser!.id, query);
  res.status(200).json(result);
});

nutritionRouter.post('/logs', async (req, res) => {
  const input = createNutritionLogSchema.parse(req.body);
  const result = await createNutritionLog(req.authUser!.id, input);
  res.status(201).json(result);
});

nutritionRouter.patch('/logs/:id', async (req, res) => {
  const input = updateNutritionLogSchema.parse(req.body);
  const result = await updateNutritionLog(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

nutritionRouter.delete('/logs/:id', async (req, res) => {
  const result = await deleteNutritionLog(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
