import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { ensureCoreExercisesSeeded } from '../exercises/exercises.seed.js';
import { toFoodDto } from '../foods/foods.service.js';
import { ensureCoreFoodsSeeded } from '../foods/foods.seed.js';
import { parseMicronutrients, round1, serializeMicronutrients } from '../nutrition/nutrition.math.js';
import {
  DEFAULT_PROFILE_GOALS,
  DEFAULT_VISIBLE_MICRONUTRIENTS,
  parseVisibleMicronutrients,
} from '../profile/profile.constants.js';
import { toRecipeDto } from '../recipes/recipes.service.js';
import { SYNC_PULL_ENTITY_LIMIT, type SyncEntity } from './sync.constants.js';
import type { SyncMutation, SyncPullQuery, SyncPushBody } from './sync.schema.js';

export interface SyncMutationResult {
  clientMutationId: string;
  entity: SyncEntity;
  recordId: string;
  serverRecordId?: string;
  status: 'applied' | 'conflict_server_wins' | 'rejected';
  reason?: string;
}

function clientWinsLww(clientUpdatedAtIso: string, existingUpdatedAt: Date): boolean {
  return new Date(clientUpdatedAtIso).getTime() >= existingUpdatedAt.getTime();
}

function toIsoOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export async function pullSyncChanges(userId: string, query: SyncPullQuery) {
  const isFullSync = !query.since;
  const shouldIncludeCore = isFullSync || query.includeCore;

  if (shouldIncludeCore) {
    await Promise.all([ensureCoreFoodsSeeded(), ensureCoreExercisesSeeded()]);
  }

  const serverTime = new Date().toISOString();
  const sinceDate = query.since ? new Date(query.since) : null;
  const userDeltaWhere = sinceDate
    ? { userId, updatedAt: { gt: sinceDate } }
    : { userId, deletedAt: null };

  const [
    user,
    weights,
    calories,
    customFoods,
    recipes,
    nutritionLogs,
    customExercises,
    workoutTemplates,
    workouts,
    cardio,
    steps,
    coreFoods,
    coreExercises,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, updatedAt: true, profile: true },
    }),
    prisma.weightEntry.findMany({
      where: userDeltaWhere,
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
    }),
    prisma.calorieEntry.findMany({
      where: userDeltaWhere,
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
    }),
    prisma.food.findMany({
      where: { ...userDeltaWhere, isCore: false },
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
    }),
    prisma.recipe.findMany({
      where: userDeltaWhere,
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { food: true },
        },
      },
    }),
    prisma.nutritionLog.findMany({
      where: userDeltaWhere,
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
    }),
    prisma.exercise.findMany({
      where: { ...userDeltaWhere, isCore: false },
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
    }),
    prisma.workoutTemplate.findMany({
      where: userDeltaWhere,
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
      include: {
        exercises: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.workoutEntry.findMany({
      where: userDeltaWhere,
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
      include: {
        exercises: {
          orderBy: { sortOrder: 'asc' },
          include: { sets: { orderBy: { setNumber: 'asc' } } },
        },
      },
    }),
    prisma.cardioEntry.findMany({
      where: userDeltaWhere,
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
    }),
    prisma.stepEntry.findMany({
      where: userDeltaWhere,
      orderBy: { updatedAt: 'asc' },
      take: SYNC_PULL_ENTITY_LIMIT,
    }),
    shouldIncludeCore
      ? prisma.food.findMany({
          where: { isCore: true, deletedAt: null },
          orderBy: { name: 'asc' },
          take: SYNC_PULL_ENTITY_LIMIT,
        })
      : Promise.resolve(null),
    shouldIncludeCore
      ? prisma.exercise.findMany({
          where: { isCore: true, deletedAt: null },
          orderBy: [{ muscleGroup: 'asc' }, { name: 'asc' }],
          take: SYNC_PULL_ENTITY_LIMIT,
        })
      : Promise.resolve(null),
  ]);

  let profilePayload: {
    name: string;
    dailyCalorieGoal: number;
    proteinGoalG: number;
    carbsGoalG: number;
    fatGoalG: number;
    dailyStepGoal: number;
    visibleMicronutrients: string[];
    updatedAt: string;
  } | null = null;

  if (user) {
    const profileUpdated = user.profile?.updatedAt ?? user.updatedAt;
    const latestProfileTimestamp =
      user.updatedAt.getTime() > profileUpdated.getTime() ? user.updatedAt : profileUpdated;
    if (!sinceDate || latestProfileTimestamp.getTime() > sinceDate.getTime()) {
      profilePayload = {
        name: user.name,
        dailyCalorieGoal:
          user.profile?.dailyCalorieGoal ?? DEFAULT_PROFILE_GOALS.dailyCalorieGoal,
        proteinGoalG: user.profile?.proteinGoalG ?? DEFAULT_PROFILE_GOALS.proteinGoalG,
        carbsGoalG: user.profile?.carbsGoalG ?? DEFAULT_PROFILE_GOALS.carbsGoalG,
        fatGoalG: user.profile?.fatGoalG ?? DEFAULT_PROFILE_GOALS.fatGoalG,
        dailyStepGoal: user.profile?.dailyStepGoal ?? DEFAULT_PROFILE_GOALS.dailyStepGoal,
        visibleMicronutrients: user.profile
          ? parseVisibleMicronutrients(user.profile.visibleMicronutrients)
          : [...DEFAULT_VISIBLE_MICRONUTRIENTS],
        updatedAt: latestProfileTimestamp.toISOString(),
      };
    }
  }

  return {
    serverTime,
    isFullSync,
    profile: profilePayload,
    core: {
      ...(coreFoods ? { foods: coreFoods.map((f) => ({ ...toFoodDto(f), deletedAt: null })) } : {}),
      ...(coreExercises
        ? {
            exercises: coreExercises.map((e) => ({
              ...e,
              deletedAt: toIsoOrNull(e.deletedAt),
            })),
          }
        : {}),
    },
    changes: {
      weights: weights.map((w) => ({ ...w, deletedAt: toIsoOrNull(w.deletedAt) })),
      calories: calories.map((c) => ({ ...c, deletedAt: toIsoOrNull(c.deletedAt) })),
      foods: customFoods.map((f) => ({ ...toFoodDto(f), deletedAt: toIsoOrNull(f.deletedAt) })),
      recipes: recipes.map((r) => ({ ...toRecipeDto(r), deletedAt: toIsoOrNull(r.deletedAt) })),
      nutritionLogs: nutritionLogs.map((l) => ({
        id: l.id,
        date: l.date,
        mealLabel: l.mealLabel,
        sourceType: l.sourceType,
        foodId: l.foodId,
        recipeId: l.recipeId,
        entryName: l.entryName,
        quantityMode: l.quantityMode,
        servings: l.servings,
        grams: round1(l.grams),
        calories: round1(l.calories),
        proteinG: round1(l.proteinG),
        carbsG: round1(l.carbsG),
        fatG: round1(l.fatG),
        micronutrients: parseMicronutrients(l.micronutrients),
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        deletedAt: toIsoOrNull(l.deletedAt),
      })),
      exercises: customExercises.map((e) => ({ ...e, deletedAt: toIsoOrNull(e.deletedAt) })),
      workoutTemplates: workoutTemplates.map((t) => ({
        ...t,
        deletedAt: toIsoOrNull(t.deletedAt),
      })),
      workouts: workouts.map((w) => ({ ...w, deletedAt: toIsoOrNull(w.deletedAt) })),
      cardio: cardio.map((c) => ({ ...c, deletedAt: toIsoOrNull(c.deletedAt) })),
      steps: steps.map((s) => ({ ...s, deletedAt: toIsoOrNull(s.deletedAt) })),
    },
  };
}

async function applySingleMutation(
  tx: Prisma.TransactionClient,
  userId: string,
  mutation: SyncMutation,
  serverNow: Date,
): Promise<SyncMutationResult> {
  const base = {
    clientMutationId: mutation.clientMutationId,
    entity: mutation.entity,
    recordId: mutation.recordId,
  };

  if (mutation.entity === 'profile') {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { updatedAt: true, profile: { select: { updatedAt: true } } },
    });
    if (!user) {
      return { ...base, status: 'rejected', reason: 'user_not_found' };
    }
    const latest = user.profile
      ? new Date(Math.max(user.updatedAt.getTime(), user.profile.updatedAt.getTime()))
      : user.updatedAt;
    if (!clientWinsLww(mutation.clientUpdatedAt, latest)) {
      return { ...base, status: 'conflict_server_wins' };
    }

    const d = mutation.data;
    if (d.name) {
      await tx.user.update({
        where: { id: userId },
        data: { name: d.name, updatedAt: serverNow },
      });
    }
    const profileFields = {
      dailyCalorieGoal: d.dailyCalorieGoal,
      proteinGoalG: d.proteinGoalG,
      carbsGoalG: d.carbsGoalG,
      fatGoalG: d.fatGoalG,
      dailyStepGoal: d.dailyStepGoal,
      visibleMicronutrients: JSON.stringify(d.visibleMicronutrients),
      updatedAt: serverNow,
    };
    await tx.userProfile.upsert({
      where: { userId },
      create: { userId, ...profileFields },
      update: profileFields,
    });
    return { ...base, status: 'applied' };
  }

  // Soft-delete mutations
  if (mutation.operation === 'delete') {
    if (mutation.entity === 'food') {
      const existing = await tx.food.findUnique({ where: { id: mutation.recordId } });
      if (!existing) return { ...base, status: 'applied' };
      if (existing.isCore || existing.userId !== userId) {
        return { ...base, status: 'rejected', reason: 'forbidden_or_core' };
      }
      if (!clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
        return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
      }
      const inUse = await tx.recipeItem.count({
        where: { foodId: existing.id, recipe: { userId, deletedAt: null } },
      });
      if (inUse > 0) {
        return { ...base, status: 'rejected', reason: 'food_in_use_by_recipe' };
      }
      await tx.food.update({
        where: { id: existing.id },
        data: { deletedAt: serverNow, barcode: null, updatedAt: serverNow },
      });
      return { ...base, status: 'applied', serverRecordId: existing.id };
    }

    if (mutation.entity === 'exercise') {
      const existing = await tx.exercise.findUnique({ where: { id: mutation.recordId } });
      if (!existing) return { ...base, status: 'applied' };
      if (existing.isCore || existing.userId !== userId) {
        return { ...base, status: 'rejected', reason: 'forbidden_or_core' };
      }
      if (!clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
        return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
      }
      await tx.exercise.update({
        where: { id: existing.id },
        data: { deletedAt: serverNow, updatedAt: serverNow },
      });
      return { ...base, status: 'applied', serverRecordId: existing.id };
    }

    type SoftDeleteDelegate = {
      findUnique: (args: { where: { id: string } }) => Promise<{
        id: string;
        userId: string;
        updatedAt: Date;
      } | null>;
      update: (args: {
        where: { id: string };
        data: { deletedAt: Date; updatedAt: Date };
      }) => Promise<unknown>;
    };

    const delegates: Record<
      Exclude<SyncMutation['entity'], 'profile' | 'food' | 'exercise'>,
      SoftDeleteDelegate
    > = {
      weight: tx.weightEntry,
      calorie: tx.calorieEntry,
      recipe: tx.recipe,
      nutritionLog: tx.nutritionLog,
      workoutTemplate: tx.workoutTemplate,
      workout: tx.workoutEntry,
      cardio: tx.cardioEntry,
      step: tx.stepEntry,
    };

    const delegate = delegates[mutation.entity];
    const existing = await delegate.findUnique({ where: { id: mutation.recordId } });
    if (!existing) return { ...base, status: 'applied' };
    if (existing.userId !== userId) {
      return { ...base, status: 'rejected', reason: 'forbidden' };
    }
    if (!clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
      return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
    }
    await delegate.update({
      where: { id: existing.id },
      data: { deletedAt: serverNow, updatedAt: serverNow },
    });
    return { ...base, status: 'applied', serverRecordId: existing.id };
  }

  // Upsert mutations
  switch (mutation.entity) {
    case 'weight': {
      const byId = await tx.weightEntry.findUnique({ where: { id: mutation.recordId } });
      if (byId && byId.userId !== userId) {
        return { ...base, status: 'rejected', reason: 'forbidden' };
      }
      const byDate = await tx.weightEntry.findUnique({
        where: { userId_date: { userId, date: mutation.data.date } },
      });
      const target = byId ?? byDate;

      if (target) {
        if (!clientWinsLww(mutation.clientUpdatedAt, target.updatedAt)) {
          return { ...base, status: 'conflict_server_wins', serverRecordId: target.id };
        }
        if (byId && byDate && byDate.id !== byId.id) {
          if (!clientWinsLww(mutation.clientUpdatedAt, byDate.updatedAt)) {
            return { ...base, status: 'conflict_server_wins', serverRecordId: byDate.id };
          }
          await tx.weightEntry.update({
            where: { id: byDate.id },
            data: {
              weightKg: mutation.data.weightKg,
              note: mutation.data.note,
              deletedAt: null,
              updatedAt: serverNow,
            },
          });
          await tx.weightEntry.update({
            where: { id: byId.id },
            data: { deletedAt: serverNow, updatedAt: serverNow },
          });
          return { ...base, status: 'applied', serverRecordId: byDate.id };
        }

        await tx.weightEntry.update({
          where: { id: target.id },
          data: {
            date: mutation.data.date,
            weightKg: mutation.data.weightKg,
            note: mutation.data.note,
            deletedAt: null,
            updatedAt: serverNow,
          },
        });
        return { ...base, status: 'applied', serverRecordId: target.id };
      }

      const created = await tx.weightEntry.create({
        data: {
          id: mutation.recordId,
          userId,
          date: mutation.data.date,
          weightKg: mutation.data.weightKg,
          note: mutation.data.note,
          updatedAt: serverNow,
        },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'step': {
      const byId = await tx.stepEntry.findUnique({ where: { id: mutation.recordId } });
      if (byId && byId.userId !== userId) {
        return { ...base, status: 'rejected', reason: 'forbidden' };
      }
      const byDate = await tx.stepEntry.findUnique({
        where: { userId_date: { userId, date: mutation.data.date } },
      });
      const target = byId ?? byDate;

      if (target) {
        if (!clientWinsLww(mutation.clientUpdatedAt, target.updatedAt)) {
          return { ...base, status: 'conflict_server_wins', serverRecordId: target.id };
        }
        if (byId && byDate && byDate.id !== byId.id) {
          if (!clientWinsLww(mutation.clientUpdatedAt, byDate.updatedAt)) {
            return { ...base, status: 'conflict_server_wins', serverRecordId: byDate.id };
          }
          await tx.stepEntry.update({
            where: { id: byDate.id },
            data: {
              steps: mutation.data.steps,
              note: mutation.data.note,
              deletedAt: null,
              updatedAt: serverNow,
            },
          });
          await tx.stepEntry.update({
            where: { id: byId.id },
            data: { deletedAt: serverNow, updatedAt: serverNow },
          });
          return { ...base, status: 'applied', serverRecordId: byDate.id };
        }

        await tx.stepEntry.update({
          where: { id: target.id },
          data: {
            date: mutation.data.date,
            steps: mutation.data.steps,
            note: mutation.data.note,
            deletedAt: null,
            updatedAt: serverNow,
          },
        });
        return { ...base, status: 'applied', serverRecordId: target.id };
      }

      const created = await tx.stepEntry.create({
        data: {
          id: mutation.recordId,
          userId,
          date: mutation.data.date,
          steps: mutation.data.steps,
          note: mutation.data.note,
          updatedAt: serverNow,
        },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'calorie': {
      const existing = await tx.calorieEntry.findUnique({ where: { id: mutation.recordId } });
      if (existing) {
        if (existing.userId !== userId) {
          return { ...base, status: 'rejected', reason: 'forbidden' };
        }
        if (!clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
          return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
        }
        await tx.calorieEntry.update({
          where: { id: existing.id },
          data: {
            date: mutation.data.date,
            mealName: mutation.data.mealName,
            calories: mutation.data.calories,
            deletedAt: null,
            updatedAt: serverNow,
          },
        });
        return { ...base, status: 'applied', serverRecordId: existing.id };
      }
      const created = await tx.calorieEntry.create({
        data: {
          id: mutation.recordId,
          userId,
          date: mutation.data.date,
          mealName: mutation.data.mealName,
          calories: mutation.data.calories,
          updatedAt: serverNow,
        },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'cardio': {
      const existing = await tx.cardioEntry.findUnique({ where: { id: mutation.recordId } });
      const payload = {
        date: mutation.data.date,
        cardioType: mutation.data.cardioType,
        durationMinutes: mutation.data.durationMinutes,
        distanceKm: mutation.data.distanceKm !== null ? round1(mutation.data.distanceKm) : null,
        caloriesBurned: mutation.data.caloriesBurned,
        note: mutation.data.note,
        deletedAt: null,
        updatedAt: serverNow,
      };
      if (existing) {
        if (existing.userId !== userId) {
          return { ...base, status: 'rejected', reason: 'forbidden' };
        }
        if (!clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
          return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
        }
        await tx.cardioEntry.update({ where: { id: existing.id }, data: payload });
        return { ...base, status: 'applied', serverRecordId: existing.id };
      }
      const created = await tx.cardioEntry.create({
        data: { id: mutation.recordId, userId, ...payload },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'food': {
      const existing = await tx.food.findUnique({ where: { id: mutation.recordId } });
      if (existing && (existing.isCore || existing.userId !== userId)) {
        return { ...base, status: 'rejected', reason: 'forbidden_or_core' };
      }
      if (existing && !clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
        return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
      }

      if (mutation.data.barcode) {
        const barcodeOwner = await tx.food.findFirst({
          where: { userId, barcode: mutation.data.barcode, id: { not: mutation.recordId } },
          select: { id: true, deletedAt: true },
        });
        if (barcodeOwner && !barcodeOwner.deletedAt) {
          return { ...base, status: 'rejected', reason: 'barcode_conflict' };
        }
        if (barcodeOwner && barcodeOwner.deletedAt) {
          await tx.food.update({ where: { id: barcodeOwner.id }, data: { barcode: null } });
        }
      }

      const payload = {
        barcode: mutation.data.barcode,
        name: mutation.data.name,
        brand: mutation.data.brand,
        category: mutation.data.category,
        servingLabel:
          mutation.data.servingLabel ?? (mutation.data.servingGrams ? '1 porsiyon' : null),
        servingGrams: mutation.data.servingGrams,
        caloriesPer100g: round1(mutation.data.caloriesPer100g),
        proteinPer100g: round1(mutation.data.proteinPer100g),
        carbsPer100g: round1(mutation.data.carbsPer100g),
        fatPer100g: round1(mutation.data.fatPer100g),
        micronutrientsPer100g: serializeMicronutrients(mutation.data.micronutrientsPer100g),
        deletedAt: null,
        updatedAt: serverNow,
      };

      if (existing) {
        await tx.food.update({ where: { id: existing.id }, data: payload });
        return { ...base, status: 'applied', serverRecordId: existing.id };
      }

      const created = await tx.food.create({
        data: { id: mutation.recordId, userId, isCore: false, coreKey: null, ...payload },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'recipe': {
      const existing = await tx.recipe.findUnique({ where: { id: mutation.recordId } });
      if (existing && existing.userId !== userId) {
        return { ...base, status: 'rejected', reason: 'forbidden' };
      }
      if (existing && !clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
        return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
      }

      const uniqueFoodIds = Array.from(new Set(mutation.data.items.map((i) => i.foodId)));
      const accessibleFoods = await tx.food.findMany({
        where: { id: { in: uniqueFoodIds }, deletedAt: null, OR: [{ isCore: true }, { userId }] },
        select: { id: true },
      });
      if (accessibleFoods.length !== uniqueFoodIds.length) {
        return { ...base, status: 'rejected', reason: 'invalid_food_reference' };
      }

      const itemsCreate = mutation.data.items.map((item, idx) => ({
        foodId: item.foodId,
        grams: round1(item.grams),
        sortOrder: item.sortOrder ?? idx,
      }));

      if (existing) {
        await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } });
        await tx.recipe.update({
          where: { id: existing.id },
          data: {
            name: mutation.data.name,
            description: mutation.data.description,
            servingsCount: mutation.data.servingsCount,
            cookedWeightG: mutation.data.cookedWeightG,
            deletedAt: null,
            updatedAt: serverNow,
            items: { create: itemsCreate },
          },
        });
        return { ...base, status: 'applied', serverRecordId: existing.id };
      }

      const created = await tx.recipe.create({
        data: {
          id: mutation.recordId,
          userId,
          name: mutation.data.name,
          description: mutation.data.description,
          servingsCount: mutation.data.servingsCount,
          cookedWeightG: mutation.data.cookedWeightG,
          updatedAt: serverNow,
          items: { create: itemsCreate },
        },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'nutritionLog': {
      const existing = await tx.nutritionLog.findUnique({ where: { id: mutation.recordId } });
      if (existing && existing.userId !== userId) {
        return { ...base, status: 'rejected', reason: 'forbidden' };
      }
      if (existing && !clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
        return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
      }

      let safeFoodId: string | null = null;
      if (mutation.data.foodId) {
        const food = await tx.food.findFirst({
          where: { id: mutation.data.foodId, OR: [{ isCore: true }, { userId }] },
          select: { id: true },
        });
        safeFoodId = food?.id ?? null;
      }
      let safeRecipeId: string | null = null;
      if (mutation.data.recipeId) {
        const recipe = await tx.recipe.findFirst({
          where: { id: mutation.data.recipeId, userId },
          select: { id: true },
        });
        safeRecipeId = recipe?.id ?? null;
      }

      const payload = {
        date: mutation.data.date,
        mealLabel: mutation.data.mealLabel,
        sourceType: mutation.data.sourceType,
        foodId: safeFoodId,
        recipeId: safeRecipeId,
        entryName: mutation.data.entryName,
        quantityMode: mutation.data.quantityMode,
        servings: mutation.data.servings,
        grams: round1(mutation.data.grams),
        calories: round1(mutation.data.calories),
        proteinG: round1(mutation.data.proteinG),
        carbsG: round1(mutation.data.carbsG),
        fatG: round1(mutation.data.fatG),
        micronutrients: serializeMicronutrients(mutation.data.micronutrients),
        deletedAt: null,
        updatedAt: serverNow,
      };

      if (existing) {
        await tx.nutritionLog.update({ where: { id: existing.id }, data: payload });
        return { ...base, status: 'applied', serverRecordId: existing.id };
      }

      const created = await tx.nutritionLog.create({
        data: { id: mutation.recordId, userId, ...payload },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'exercise': {
      const existing = await tx.exercise.findUnique({ where: { id: mutation.recordId } });
      if (existing && (existing.isCore || existing.userId !== userId)) {
        return { ...base, status: 'rejected', reason: 'forbidden_or_core' };
      }
      if (existing && !clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
        return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
      }

      const payload = {
        name: mutation.data.name,
        muscleGroup: mutation.data.muscleGroup,
        equipment: mutation.data.equipment,
        isBodyweight: mutation.data.isBodyweight,
        notes: mutation.data.notes,
        deletedAt: null,
        updatedAt: serverNow,
      };

      if (existing) {
        await tx.exercise.update({ where: { id: existing.id }, data: payload });
        return { ...base, status: 'applied', serverRecordId: existing.id };
      }

      const created = await tx.exercise.create({
        data: { id: mutation.recordId, userId, isCore: false, coreKey: null, ...payload },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'workoutTemplate': {
      const existing = await tx.workoutTemplate.findUnique({ where: { id: mutation.recordId } });
      if (existing && existing.userId !== userId) {
        return { ...base, status: 'rejected', reason: 'forbidden' };
      }
      if (existing && !clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
        return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
      }

      const exerciseIds = Array.from(
        new Set(
          mutation.data.exercises
            .map((e) => e.exerciseId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const validExerciseIds = new Set<string>();
      if (exerciseIds.length > 0) {
        const found = await tx.exercise.findMany({
          where: { id: { in: exerciseIds }, OR: [{ isCore: true }, { userId }] },
          select: { id: true },
        });
        for (const f of found) validExerciseIds.add(f.id);
      }

      const exercisesCreate = mutation.data.exercises.map((ex, idx) => ({
        exerciseId: ex.exerciseId && validExerciseIds.has(ex.exerciseId) ? ex.exerciseId : null,
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        defaultSets: ex.defaultSets,
        defaultReps: ex.defaultReps,
        defaultWeightKg: ex.defaultWeightKg,
        sortOrder: ex.sortOrder ?? idx,
      }));

      if (existing) {
        await tx.workoutTemplateExercise.deleteMany({ where: { templateId: existing.id } });
        await tx.workoutTemplate.update({
          where: { id: existing.id },
          data: {
            name: mutation.data.name,
            description: mutation.data.description,
            deletedAt: null,
            updatedAt: serverNow,
            exercises: { create: exercisesCreate },
          },
        });
        return { ...base, status: 'applied', serverRecordId: existing.id };
      }

      const created = await tx.workoutTemplate.create({
        data: {
          id: mutation.recordId,
          userId,
          name: mutation.data.name,
          description: mutation.data.description,
          updatedAt: serverNow,
          exercises: { create: exercisesCreate },
        },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }

    case 'workout': {
      const existing = await tx.workoutEntry.findUnique({ where: { id: mutation.recordId } });
      if (existing && existing.userId !== userId) {
        return { ...base, status: 'rejected', reason: 'forbidden' };
      }
      if (existing && !clientWinsLww(mutation.clientUpdatedAt, existing.updatedAt)) {
        return { ...base, status: 'conflict_server_wins', serverRecordId: existing.id };
      }

      let safeTemplateId: string | null = null;
      if (mutation.data.templateId) {
        const tpl = await tx.workoutTemplate.findFirst({
          where: { id: mutation.data.templateId, userId },
          select: { id: true },
        });
        safeTemplateId = tpl?.id ?? null;
      }

      const exerciseIds = Array.from(
        new Set(
          mutation.data.exercises
            .map((e) => e.exerciseId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const validExerciseIds = new Set<string>();
      if (exerciseIds.length > 0) {
        const found = await tx.exercise.findMany({
          where: { id: { in: exerciseIds }, OR: [{ isCore: true }, { userId }] },
          select: { id: true },
        });
        for (const f of found) validExerciseIds.add(f.id);
      }

      const exercisesCreate = mutation.data.exercises.map((ex, idx) => ({
        exerciseId: ex.exerciseId && validExerciseIds.has(ex.exerciseId) ? ex.exerciseId : null,
        exerciseName: ex.exerciseName,
        muscleGroup: ex.muscleGroup,
        sortOrder: ex.sortOrder ?? idx,
        note: ex.note,
        sets: {
          create: ex.sets.map((s, sIdx) => ({
            setNumber: s.setNumber ?? sIdx + 1,
            reps: s.reps,
            weightKg: s.weightKg,
          })),
        },
      }));

      if (existing) {
        await tx.workoutExercise.deleteMany({ where: { workoutId: existing.id } });
        await tx.workoutEntry.update({
          where: { id: existing.id },
          data: {
            templateId: safeTemplateId,
            date: mutation.data.date,
            name: mutation.data.name,
            durationMinutes: mutation.data.durationMinutes,
            note: mutation.data.note,
            deletedAt: null,
            updatedAt: serverNow,
            exercises: { create: exercisesCreate },
          },
        });
        return { ...base, status: 'applied', serverRecordId: existing.id };
      }

      const created = await tx.workoutEntry.create({
        data: {
          id: mutation.recordId,
          userId,
          templateId: safeTemplateId,
          date: mutation.data.date,
          name: mutation.data.name,
          durationMinutes: mutation.data.durationMinutes,
          note: mutation.data.note,
          updatedAt: serverNow,
          exercises: exercisesCreate.length > 0 ? { create: exercisesCreate } : undefined,
        },
      });
      return { ...base, status: 'applied', serverRecordId: created.id };
    }
  }
}

export async function pushSyncMutations(userId: string, input: SyncPushBody) {
  await Promise.all([ensureCoreFoodsSeeded(), ensureCoreExercisesSeeded()]);

  const serverNow = new Date();
  const results = await prisma.$transaction(
    async (tx) => {
      const outcomes: SyncMutationResult[] = [];
      for (const mutation of input.mutations) {
        outcomes.push(await applySingleMutation(tx, userId, mutation, serverNow));
      }
      return outcomes;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  const pull =
    input.since !== undefined
      ? await pullSyncChanges(userId, { since: input.since, includeCore: false })
      : undefined;

  return {
    serverTime: pull?.serverTime ?? serverNow.toISOString(),
    results,
    ...(pull ? { pull } : {}),
  };
}
