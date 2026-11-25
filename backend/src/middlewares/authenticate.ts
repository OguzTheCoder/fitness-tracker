import type { RequestHandler } from 'express';
import { verifyAccessToken, type AuthUser } from '../modules/auth/auth.utils.js';
import { AppError } from './errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Oturum doğrulaması gerekli.');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError(401, 'Oturum doğrulaması gerekli.');
  }

  req.authUser = verifyAccessToken(token);
  next();
};
