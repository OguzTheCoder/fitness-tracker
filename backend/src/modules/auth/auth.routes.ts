import { Router, type RequestHandler } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { isPublicAuthAllowed } from '../access/access.service.js';
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
  revokeAllUserSessions,
} from './auth.service.js';
import {
  clearSessionCookie,
  getClassicSessionTtlMs,
  setSessionCookie,
} from './session.utils.js';

export const authRouter = Router();

const requirePublicAuth: RequestHandler = (req, _res, next) => {
  if (!isPublicAuthAllowed(req)) {
    throw new AppError(403, 'Kişisel erişim kilidi aktifken klasik kayıt ve giriş uçları kapalıdır.');
  }
  next();
};

authRouter.post('/register', requirePublicAuth, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  setSessionCookie(req, res, result.token, getClassicSessionTtlMs());
  res.status(201).json({ user: result.user });
});

authRouter.post('/login', requirePublicAuth, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  setSessionCookie(req, res, result.token, getClassicSessionTtlMs());
  res.status(200).json({ user: result.user });
});

authRouter.get('/me', authenticate, async (req, res) => {
  const result = await getCurrentUser(req.authUser!.id);
  res.status(200).json(result);
});

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.status(200).json({ message: 'Oturum kapatıldı.' });
});

authRouter.post('/logout-all', authenticate, async (req, res) => {
  const result = await revokeAllUserSessions(req.authUser!.id);
  clearSessionCookie(req, res);
  res.status(200).json(result);
});

authRouter.post('/forgot-password', requirePublicAuth, async (req, res) => {
  const input = forgotPasswordSchema.parse(req.body);
  const result = await requestPasswordReset(input);
  res.status(200).json(result);
});

authRouter.post('/reset-password', requirePublicAuth, async (req, res) => {
  const input = resetPasswordSchema.parse(req.body);
  const result = await resetPassword(input);
  res.status(200).json(result);
});
