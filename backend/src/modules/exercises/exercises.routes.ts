import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { exerciseBodySchema, exerciseListQuerySchema } from './exercises.schema.js';
import {
  createCustomExercise,
  deleteCustomExercise,
  listExercises,
  updateCustomExercise,
} from './exercises.service.js';

export const exercisesRouter = Router();

exercisesRouter.use(authenticate);

exercisesRouter.get('/', async (req, res) => {
  const query = exerciseListQuerySchema.parse(req.query);
  const result = await listExercises(req.authUser!.id, query);
  res.status(200).json(result);
});

exercisesRouter.post('/', async (req, res) => {
  const input = exerciseBodySchema.parse(req.body);
  const result = await createCustomExercise(req.authUser!.id, input);
  res.status(201).json(result);
});

exercisesRouter.put('/:id', async (req, res) => {
  const input = exerciseBodySchema.parse(req.body);
  const result = await updateCustomExercise(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

exercisesRouter.delete('/:id', async (req, res) => {
  const result = await deleteCustomExercise(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
