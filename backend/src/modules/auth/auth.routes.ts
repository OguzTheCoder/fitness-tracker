import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import { getCurrentUser, loginUser, registerUser } from './auth.service.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  res.status(201).json(result);
});

authRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  res.status(200).json(result);
});

authRouter.get('/me', authenticate, async (req, res) => {
  const result = await getCurrentUser(req.authUser!.id);
  res.status(200).json(result);
});
