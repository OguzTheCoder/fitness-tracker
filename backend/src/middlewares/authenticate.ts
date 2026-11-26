import type { Request, RequestHandler } from 'express';
import { prisma } from '../config/prisma.js';
import { getActiveAppPin, syncPersonalOwnerPin } from '../modules/access/access.service.js';
import { verifyAccessToken, type AuthUser } from '../modules/auth/auth.utils.js';
import { extractRequestToken } from '../modules/auth/session.utils.js';
import { AppError } from './errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

async function resolveAuthenticatedUser(req: Request): Promise<AuthUser> {
  const token = extractRequestToken(req);
  if (!token) {
    throw new AppError(401, 'Oturum doğrulaması gerekli.');
  }

  const decoded = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      tokenVersion: true,
      isPersonalOwner: true,
      pinFingerprint: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'Geçersiz veya iptal edilmiş oturum.');
  }

  const { user: syncedUser } = await syncPersonalOwnerPin(user, getActiveAppPin(req));

  if (syncedUser.tokenVersion !== decoded.tokenVersion) {
    throw new AppError(401, 'Geçersiz veya iptal edilmiş oturum.');
  }

  return {
    id: syncedUser.id,
    email: syncedUser.email,
    tokenVersion: syncedUser.tokenVersion,
  };
}

export async function tryAuthenticateRequest(req: Request): Promise<AuthUser | null> {
  try {
    return await resolveAuthenticatedUser(req);
  } catch {
    return null;
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  req.authUser = await resolveAuthenticatedUser(req);
  next();
};
