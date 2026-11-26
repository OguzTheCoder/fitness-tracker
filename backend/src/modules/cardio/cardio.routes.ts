import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { cardioEntrySchema, cardioListQuerySchema } from './cardio.schema.js';
import {
  createCardioEntry,
  deleteCardioEntry,
  listCardioEntries,
  updateCardioEntry,
} from './cardio.service.js';

export const cardioRouter = Router();

cardioRouter.use(authenticate);

cardioRouter.get('/', async (req, res) => {
  const query = cardioListQuerySchema.parse(req.query);
  const result = await listCardioEntries(req.authUser!.id, query);
  res.status(200).json(result);
});

cardioRouter.post('/', async (req, res) => {
  const input = cardioEntrySchema.parse(req.body);
  const result = await createCardioEntry(req.authUser!.id, input);
  res.status(201).json(result);
});

cardioRouter.put('/:id', async (req, res) => {
  const input = cardioEntrySchema.parse(req.body);
  const result = await updateCardioEntry(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

cardioRouter.delete('/:id', async (req, res) => {
  const result = await deleteCardioEntry(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
