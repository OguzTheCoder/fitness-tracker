export const SYNC_PUSH_MAX_BODY = '1mb';
export const SYNC_MAX_MUTATIONS = 500;
export const SYNC_PULL_ENTITY_LIMIT = 2000;

export const SYNC_ENTITIES = [
  'profile',
  'weight',
  'calorie',
  'food',
  'recipe',
  'nutritionLog',
  'exercise',
  'workoutTemplate',
  'workout',
  'cardio',
  'step',
] as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[number];
export type SyncOperation = 'upsert' | 'delete';
