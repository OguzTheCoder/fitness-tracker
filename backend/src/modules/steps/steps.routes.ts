import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { stepEntrySchema, stepListQuerySchema } from './steps.schema.js';
import {
  deleteStepEntry,
  listStepEntries,
  updateStepEntry,
  upsertStepEntry,
} from './steps.service.js';

export const stepsRouter = Router();

stepsRouter.use(authenticate);

stepsRouter.get('/', async (req, res) => {
  const range = stepListQuerySchema.parse(req.query);
  const result = await listStepEntries(req.authUser!.id, range);
  res.status(200).json(result);
});

stepsRouter.post('/', async (req, res) => {
  const input = stepEntrySchema.parse(req.body);
  const result = await upsertStepEntry(req.authUser!.id, input);
  res.status(result.updated ? 200 : 201).json(result);
});

stepsRouter.put('/:id', async (req, res) => {
  const input = stepEntrySchema.parse(req.body);
  const result = await updateStepEntry(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

stepsRouter.delete('/:id', async (req, res) => {
  const result = await deleteStepEntry(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
