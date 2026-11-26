import type { User } from '@prisma/client';
import crypto from 'node:crypto';
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
  tokenVersion: number;
}

const JWT_ALGORITHM = 'HS256' as const;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export function signAccessToken(
  user: Pick<User, 'id' | 'email' | 'tokenVersion'>,
  expiresInOverride?: SignOptions['expiresIn'],
): string {
  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    subject: user.id,
    expiresIn: (expiresInOverride ?? env.JWT_EXPIRES_IN) as SignOptions['expiresIn'],
  };
  return jwt.sign({ email: user.email, tv: user.tokenVersion }, env.JWT_SECRET, options);
}

export function verifyAccessToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as JwtPayload;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.tv !== 'number' ||
      !Number.isInteger(payload.tv)
    ) {
      throw new AppError(401, 'Geçersiz oturum belirteci.');
    }
    return { id: payload.sub, email: payload.email, tokenVersion: payload.tv };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(401, 'Geçersiz veya süresi dolmuş oturum.');
  }
}

export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return { rawToken, tokenHash: hashResetToken(rawToken) };
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
