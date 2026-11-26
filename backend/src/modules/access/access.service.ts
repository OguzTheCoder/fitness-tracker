import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { Request } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { signAccessToken, toPublicUser } from '../auth/auth.utils.js';
import { getPersistentSessionExpiresIn } from '../auth/session.utils.js';
import {
  DEFAULT_PROFILE_GOALS,
  DEFAULT_VISIBLE_MICRONUTRIENTS,
} from '../profile/profile.constants.js';
import type { SetupAccessInput, UnlockAccessInput } from './access.schema.js';

export type AccessMode = 'local' | 'pin';

const PERSONAL_OWNER_EMAIL = 'personal@local.fitness';
const BCRYPT_SALT_ROUNDS = 10;

export function getActiveAppPin(req: Request): string | undefined {
  const override = req.app.locals.appPin as string | null | undefined;
  if (override === null) return undefined;
  if (typeof override === 'string') {
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return env.APP_PIN;
}

export function getAccessMode(activePin: string | undefined): AccessMode {
  return activePin ? 'pin' : 'local';
}

export function computePinFingerprint(pin: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(`pin:${pin}`).digest('hex');
}

export function verifyPinConstantTime(candidate: string, expected: string): boolean {
  const candidateDigest = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`verify:${candidate}`)
    .digest();
  const expectedDigest = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`verify:${expected}`)
    .digest();
  return crypto.timingSafeEqual(candidateDigest, expectedDigest);
}

/**
 * Ensures that if APP_PIN changed in the environment, the personal owner's
 * tokenVersion is incremented immediately so all previously issued cookies/JWTs
 * are invalidated (G-002).
 */
export async function syncPersonalOwnerPin<
  T extends Pick<User, 'id' | 'isPersonalOwner' | 'pinFingerprint' | 'tokenVersion'>,
>(user: T, activePin: string | undefined): Promise<{ user: T; rotated: boolean }> {
  if (!activePin || !user.isPersonalOwner) {
    return { user, rotated: false };
  }

  const expectedFingerprint = computePinFingerprint(activePin);
  if (user.pinFingerprint === expectedFingerprint) {
    return { user, rotated: false };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      pinFingerprint: expectedFingerprint,
      tokenVersion: { increment: 1 },
    },
    select: {
      tokenVersion: true,
      pinFingerprint: true,
    },
  });

  return {
    user: {
      ...user,
      tokenVersion: updated.tokenVersion,
      pinFingerprint: updated.pinFingerprint,
    },
    rotated: true,
  };
}

export async function getPersonalOwner() {
  return prisma.user.findFirst({
    where: { isPersonalOwner: true },
  });
}

export async function getAccessStatus(
  activePin: string | undefined,
  authenticatedUserId: string | null,
) {
  const mode = getAccessMode(activePin);
  const owner = await getPersonalOwner();
  let sessionInvalidated = false;

  if (owner) {
    const syncResult = await syncPersonalOwnerPin(owner, activePin);
    if (syncResult.rotated && authenticatedUserId === owner.id) {
      sessionInvalidated = true;
    }
  }

  const activeUser =
    authenticatedUserId && !sessionInvalidated
      ? await prisma.user.findUnique({ where: { id: authenticatedUserId } })
      : null;

  return {
    mode,
    isConfigured: Boolean(owner),
    isAuthenticated: Boolean(activeUser),
    user: activeUser ? toPublicUser(activeUser) : null,
  };
}

export async function setupPersonalAccess(
  input: SetupAccessInput,
  activePin: string | undefined,
) {
  const mode = getAccessMode(activePin);
  if (activePin) {
    const candidate = input.pin ?? '';
    if (!verifyPinConstantTime(candidate, activePin)) {
      throw new AppError(401, 'PIN hatalı.');
    }
  }

  const existingOwner = await getPersonalOwner();
  if (existingOwner) {
    throw new AppError(409, 'Kişisel profil zaten kurulmuş.');
  }

  const randomPasswordHash = await bcrypt.hash(
    crypto.randomBytes(32).toString('hex'),
    BCRYPT_SALT_ROUNDS,
  );
  const pinFingerprint = activePin ? computePinFingerprint(activePin) : null;

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: PERSONAL_OWNER_EMAIL,
        passwordHash: randomPasswordHash,
        isPersonalOwner: true,
        pinFingerprint,
      },
    });

    await tx.userProfile.create({
      data: {
        userId: created.id,
        ...DEFAULT_PROFILE_GOALS,
        visibleMicronutrients: JSON.stringify(DEFAULT_VISIBLE_MICRONUTRIENTS),
      },
    });

    return created;
  });

  const token = signAccessToken(user, getPersistentSessionExpiresIn());
  return {
    token,
    mode,
    user: toPublicUser(user),
  };
}

export async function unlockPersonalAccess(
  input: UnlockAccessInput,
  activePin: string | undefined,
) {
  if (!activePin) {
    throw new AppError(400, 'PIN kilidi bu ortamda aktif değil.');
  }

  const isPinValid = verifyPinConstantTime(input.pin, activePin);
  if (!isPinValid) {
    throw new AppError(401, 'PIN hatalı.');
  }

  const owner = await getPersonalOwner();
  if (!owner) {
    throw new AppError(409, 'Önce kişisel profilinizi oluşturmalısınız.');
  }

  const { user: syncedOwner } = await syncPersonalOwnerPin(owner, activePin);
  const token = signAccessToken(syncedOwner, getPersistentSessionExpiresIn());

  return {
    token,
    mode: 'pin' as const,
    user: toPublicUser(syncedOwner),
  };
}

export async function resumeLocalPersonalSession(activePin: string | undefined) {
  if (activePin) {
    throw new AppError(403, 'PIN kilidi aktifken doğrudan yerel oturum açılamaz.');
  }

  const owner = await getPersonalOwner();
  if (!owner) {
    throw new AppError(404, 'Kişisel profil henüz kurulmamış.');
  }

  const token = signAccessToken(owner, getPersistentSessionExpiresIn());
  return {
    token,
    mode: 'local' as const,
    user: toPublicUser(owner),
  };
}
