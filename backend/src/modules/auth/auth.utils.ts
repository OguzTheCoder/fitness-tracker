import type { User } from '@prisma/client';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../middlewares/errorHandler.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export function signAccessToken(user: Pick<User, 'id' | 'email'>): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign({ email: user.email }, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      throw new AppError(401, 'Geçersiz oturum belirteci.');
    }
    return { id: payload.sub, email: payload.email };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'Geçersiz veya süresi dolmuş oturum.');
  }
}
