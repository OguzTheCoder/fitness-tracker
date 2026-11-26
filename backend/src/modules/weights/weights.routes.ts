import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { weightEntrySchema, weightListQuerySchema } from './weights.schema.js';
import {
  deleteWeightEntry,
  listWeightEntries,
  updateWeightEntry,
  upsertWeightEntry,
} from './weights.service.js';

export const weightsRouter = Router();

weightsRouter.use(authenticate);

weightsRouter.get('/', async (req, res) => {
  const range = weightListQuerySchema.parse(req.query);
  const result = await listWeightEntries(req.authUser!.id, range);
  res.status(200).json(result);
});

weightsRouter.post('/', async (req, res) => {
  const input = weightEntrySchema.parse(req.body);
  const result = await upsertWeightEntry(req.authUser!.id, input);
  res.status(result.updated ? 200 : 201).json(result);
});

weightsRouter.put('/:id', async (req, res) => {
  const input = weightEntrySchema.parse(req.body);
  const result = await updateWeightEntry(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

weightsRouter.delete('/:id', async (req, res) => {
  const result = await deleteWeightEntry(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
