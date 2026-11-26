import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import {
  workoutTemplateBodySchema,
  workoutTemplateListQuerySchema,
} from './workoutTemplates.schema.js';
import {
  createWorkoutTemplate,
  deleteWorkoutTemplate,
  getWorkoutTemplate,
  listWorkoutTemplates,
  updateWorkoutTemplate,
} from './workoutTemplates.service.js';

export const workoutTemplatesRouter = Router();

workoutTemplatesRouter.use(authenticate);

workoutTemplatesRouter.get('/', async (req, res) => {
  const query = workoutTemplateListQuerySchema.parse(req.query);
  const result = await listWorkoutTemplates(req.authUser!.id, query);
  res.status(200).json(result);
});

workoutTemplatesRouter.get('/:id', async (req, res) => {
  const result = await getWorkoutTemplate(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});

workoutTemplatesRouter.post('/', async (req, res) => {
  const input = workoutTemplateBodySchema.parse(req.body);
  const result = await createWorkoutTemplate(req.authUser!.id, input);
  res.status(201).json(result);
});

workoutTemplatesRouter.put('/:id', async (req, res) => {
  const input = workoutTemplateBodySchema.parse(req.body);
  const result = await updateWorkoutTemplate(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

workoutTemplatesRouter.delete('/:id', async (req, res) => {
  const result = await deleteWorkoutTemplate(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
