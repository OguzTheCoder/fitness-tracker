import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { updateProfileSchema } from './profile.schema.js';
import { getUserProfile, updateUserProfile } from './profile.service.js';

export const profileRouter = Router();

profileRouter.use(authenticate);

profileRouter.get('/', async (req, res) => {
  const result = await getUserProfile(req.authUser!.id);
  res.status(200).json(result);
});

profileRouter.put('/', async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  const result = await updateUserProfile(req.authUser!.id, input);
  res.status(200).json(result);
});

profileRouter.patch('/', async (req, res) => {
  const input = updateProfileSchema.parse(req.body);
  const result = await updateUserProfile(req.authUser!.id, input);
  res.status(200).json(result);
});
