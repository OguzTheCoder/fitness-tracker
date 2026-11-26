import type { User, UserProfile } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../middlewares/errorHandler.js';
import {
  DEFAULT_PROFILE_GOALS,
  DEFAULT_VISIBLE_MICRONUTRIENTS,
  MICRONUTRIENT_CATALOG,
  parseVisibleMicronutrients,
} from './profile.constants.js';
import type { UpdateProfileInput } from './profile.schema.js';

export interface ProfileDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  dailyCalorieGoal: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
  dailyStepGoal: number;
  visibleMicronutrients: string[];
  updatedAt: Date;
}

function toProfileDto(user: Pick<User, 'id' | 'name' | 'email'>, profile: UserProfile): ProfileDto {
  return {
    id: profile.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    dailyCalorieGoal: profile.dailyCalorieGoal,
    proteinGoalG: profile.proteinGoalG,
    carbsGoalG: profile.carbsGoalG,
    fatGoalG: profile.fatGoalG,
    dailyStepGoal: profile.dailyStepGoal,
    visibleMicronutrients: parseVisibleMicronutrients(profile.visibleMicronutrients),
    updatedAt: profile.updatedAt,
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    throw new AppError(401, 'Kullanıcı bulunamadı.');
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...DEFAULT_PROFILE_GOALS,
      visibleMicronutrients: JSON.stringify(DEFAULT_VISIBLE_MICRONUTRIENTS),
    },
  });

  return {
    profile: toProfileDto(user, profile),
    availableMicronutrients: MICRONUTRIENT_CATALOG,
  };
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput) {
  const result = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!existingUser) {
      throw new AppError(401, 'Kullanıcı bulunamadı.');
    }

    const user =
      input.name !== undefined
        ? await tx.user.update({
            where: { id: userId },
            data: { name: input.name },
            select: { id: true, name: true, email: true },
          })
        : existingUser;

    const profileData = {
      ...(input.dailyCalorieGoal !== undefined
        ? { dailyCalorieGoal: input.dailyCalorieGoal }
        : {}),
      ...(input.proteinGoalG !== undefined ? { proteinGoalG: input.proteinGoalG } : {}),
      ...(input.carbsGoalG !== undefined ? { carbsGoalG: input.carbsGoalG } : {}),
      ...(input.fatGoalG !== undefined ? { fatGoalG: input.fatGoalG } : {}),
      ...(input.dailyStepGoal !== undefined ? { dailyStepGoal: input.dailyStepGoal } : {}),
      ...(input.visibleMicronutrients !== undefined
        ? { visibleMicronutrients: JSON.stringify(input.visibleMicronutrients) }
        : {}),
    };

    const profile = await tx.userProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        ...DEFAULT_PROFILE_GOALS,
        visibleMicronutrients: JSON.stringify(DEFAULT_VISIBLE_MICRONUTRIENTS),
        ...profileData,
      },
    });

    return { user, profile };
  });

  return {
    profile: toProfileDto(result.user, result.profile),
    availableMicronutrients: MICRONUTRIENT_CATALOG,
  };
}
