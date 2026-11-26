import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import {
  previousPerformanceQuerySchema,
  workoutEntrySchema,
  workoutListQuerySchema,
} from './workouts.schema.js';
import {
  createWorkoutEntry,
  deleteWorkoutEntry,
  getPreviousExercisePerformances,
  listWorkoutEntries,
  updateWorkoutEntry,
} from './workouts.service.js';

export const workoutsRouter = Router();

workoutsRouter.use(authenticate);

workoutsRouter.get('/previous', async (req, res) => {
  const query = previousPerformanceQuerySchema.parse(req.query);
  const result = await getPreviousExercisePerformances(req.authUser!.id, query);
  res.status(200).json(result);
});

workoutsRouter.get('/', async (req, res) => {
  const range = workoutListQuerySchema.parse(req.query);
  const result = await listWorkoutEntries(req.authUser!.id, range);
  res.status(200).json(result);
});

workoutsRouter.post('/', async (req, res) => {
  const input = workoutEntrySchema.parse(req.body);
  const result = await createWorkoutEntry(req.authUser!.id, input);
  res.status(201).json(result);
});

workoutsRouter.put('/:id', async (req, res) => {
  const input = workoutEntrySchema.parse(req.body);
  const result = await updateWorkoutEntry(req.authUser!.id, String(req.params.id), input);
  res.status(200).json(result);
});

workoutsRouter.delete('/:id', async (req, res) => {
  const result = await deleteWorkoutEntry(req.authUser!.id, String(req.params.id));
  res.status(200).json(result);
});
