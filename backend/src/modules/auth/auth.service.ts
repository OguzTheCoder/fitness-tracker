import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { getMailProvider } from '../../config/mail.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { PERSONAL_OWNER_EMAIL } from '../access/access.constants.js';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schema.js';
import {
  generateResetToken,
  hashResetToken,
  signAccessToken,
  toPublicUser,
} from './auth.utils.js';

const BCRYPT_SALT_ROUNDS = 10;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'dummy-timing-equalizer-password-value',
  BCRYPT_SALT_ROUNDS,
);

export async function registerUser(input: RegisterInput) {
  if (input.email === PERSONAL_OWNER_EMAIL) {
    throw new AppError(403, 'Bu e-posta adresi sistem tarafından ayrılmıştır.');
  }

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
  const isReservedPersonalEmail = input.email === PERSONAL_OWNER_EMAIL;
  const user = isReservedPersonalEmail
    ? null
    : await prisma.user.findUnique({ where: { email: input.email } });
  const effectiveUser = user && !user.isPersonalOwner ? user : null;
  const isPasswordValid = await bcrypt.compare(
    input.password,
    effectiveUser ? effectiveUser.passwordHash : DUMMY_PASSWORD_HASH,
  );

  if (!effectiveUser || !isPasswordValid) {
    throw new AppError(401, 'E-posta veya şifre hatalı.');
  }

  return {
    token: signAccessToken(effectiveUser),
    user: toPublicUser(effectiveUser),
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, 'Kullanıcı bulunamadı.');
  }

  return { user: toPublicUser(user) };
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });

  return { message: 'Tüm cihazlardaki oturumlar sonlandırıldı.' };
}

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const genericResponse = {
    message: 'Eğer bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi.',
  };

  const { rawToken, tokenHash } = generateResetToken();
  if (input.email === PERSONAL_OWNER_EMAIL) {
    return genericResponse;
  }

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || user.isPersonalOwner) {
    return genericResponse;
  }

  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  const mailProvider = getMailProvider();

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${rawToken}`;
  await mailProvider.sendPasswordReset({
    to: user.email,
    resetToken: rawToken,
    resetUrl,
    expiresAt,
  });

  return genericResponse;
}

export async function resetPassword(input: ResetPasswordInput) {
  const tokenHash = hashResetToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { isPersonalOwner: true } },
    },
  });

  if (
    !record ||
    record.user.isPersonalOwner ||
    record.usedAt ||
    record.expiresAt.getTime() <= Date.now()
  ) {
    throw new AppError(400, 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.passwordResetToken.updateMany({
      where: {
        id: record.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (claimed.count !== 1) {
      throw new AppError(400, 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
    }

    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });
  });

  return { message: 'Şifreniz başarıyla güncellendi.' };
}
