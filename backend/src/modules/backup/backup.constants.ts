export const BACKUP_SCHEMA_VERSION = 1 as const;
export const BACKUP_APP_NAME = 'fitness-tracker' as const;
export const BACKUP_APP_VERSION = '1.5.0' as const;
export const BACKUP_IMPORT_MAX_BODY = '5mb';

export const CSV_DATASETS = [
  'weights',
  'nutrition',
  'workouts',
  'cardio',
  'steps',
  'calories',
] as const;

export type CsvDataset = (typeof CSV_DATASETS)[number];

export const BACKUP_IMPORT_ARRAY_LIMITS = {
  weights: 5000,
  calories: 20000,
  customFoods: 2000,
  recipes: 1000,
  nutritionLogs: 20000,
  customExercises: 1000,
  workoutTemplates: 500,
  workouts: 10000,
  cardio: 10000,
  steps: 5000,
} as const;

export const BACKUP_DATASET_KEYS = [
  'weights',
  'calories',
  'customFoods',
  'recipes',
  'nutritionLogs',
  'customExercises',
  'workoutTemplates',
  'workouts',
  'cardio',
  'steps',
] as const;

export type BackupDatasetKey = (typeof BACKUP_DATASET_KEYS)[number];
