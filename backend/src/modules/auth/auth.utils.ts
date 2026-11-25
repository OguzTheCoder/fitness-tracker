import type { User } from '@prisma/client';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
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
