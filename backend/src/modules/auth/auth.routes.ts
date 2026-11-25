import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schema.js';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from './auth.service.js';

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

authRouter.post('/forgot-password', async (req, res) => {
  const input = forgotPasswordSchema.parse(req.body);
  const result = await requestPasswordReset(input);
  res.status(200).json(result);
});

authRouter.post('/reset-password', async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  const result = await resetPassword(input);
  res.status(200).json(result);
});
