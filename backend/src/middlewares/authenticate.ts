import type { RequestHandler } from 'express';
import { prisma } from '../config/prisma.js';
import { verifyAccessToken, type AuthUser } from '../modules/auth/auth.utils.js';
import { AppError } from './errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Oturum doğrulaması gerekli.');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError(401, 'Oturum doğrulaması gerekli.');
  }

  const decoded = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true, tokenVersion: true },
  });

  if (!user || user.tokenVersion !== decoded.tokenVersion) {
    throw new AppError(401, 'Geçersiz veya iptal edilmiş oturum.');
  }

  req.authUser = {
    id: user.id,
    email: user.email,
    tokenVersion: user.tokenVersion,
  };
  next();
};
