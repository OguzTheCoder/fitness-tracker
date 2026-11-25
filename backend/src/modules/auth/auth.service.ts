import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';
import { signAccessToken, toPublicUser } from './auth.utils.js';

const BCRYPT_SALT_ROUNDS = 10;

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'Bu e-posta adresi zaten kayıtlı.');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
  });

  return {
    token: signAccessToken(user),
    user: toPublicUser(user),
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const isPasswordValid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;

  if (!user || !isPasswordValid) {
    throw new AppError(401, 'E-posta veya şifre hatalı.');
  }

  return {
    token: signAccessToken(user),
    user: toPublicUser(user),
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, 'Kullanıcı bulunamadı.');
  }

  return { user: toPublicUser(user) };
}
