import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { calorieEntrySchema, calorieListQuerySchema } from './calories.schema.js';
import {
  createCalorieEntry,
  deleteCalorieEntry,
  listCalorieEntries,
  updateCalorieEntry,
} from './calories.service.js';

export const caloriesRouter = Router();

caloriesRouter.use(authenticate);

caloriesRouter.get('/', async (req, res) => {
  const range = calorieListQuerySchema.parse(req.query);
  const result = await listCalorieEntries(req.authUser!.id, range);
  res.status(200).json(result);
});

caloriesRouter.post('/', async (req, res) => {
  const input = calorieEntrySchema.parse(req.body);
  const result = await createCalorieEntry(req.authUser!.id, input);
  res.status(201).json(result);
});

caloriesRouter.put('/:id', async (req, res) => {
  const input = calorieEntrySchema.parse(req.body);
  const result = await updateCalorieEntry(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

caloriesRouter.delete('/:id', async (req, res) => {
  const result = await deleteCalorieEntry(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
