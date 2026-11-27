import type { AccessMode, User } from '../services/authService';
import type { CalorieEntry } from '../services/calorieService';
import type { FoodItem, NutritionLog, Recipe } from '../services/nutritionService';
import type { MicronutrientMeta, UserProfile } from '../services/profileService';
import type { WeightEntry } from '../services/weightService';
import type {
  CardioEntry,
  ExerciseItem,
  StepEntry,
  WorkoutEntry,
  WorkoutTemplate,
} from '../services/workoutService';

export type SyncEntity =
  | 'profile'
  | 'weight'
  | 'calorie'
  | 'food'
  | 'recipe'
  | 'nutritionLog'
  | 'exercise'
  | 'workoutTemplate'
  | 'workout'
  | 'cardio'
  | 'step';

export type SyncOperation = 'upsert' | 'delete';

export interface QueuedMutation {
  clientMutationId: string;
  userId: string;
  entity: SyncEntity;
  operation: SyncOperation;
  recordId: string;
  clientUpdatedAt: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface UserLocalData {
  userId: string;
  lastSyncedAt: string | null;
  profile: UserProfile | null;
  availableMicronutrients: MicronutrientMeta[];
  coreFoods: FoodItem[];
  coreExercises: ExerciseItem[];
  weights: WeightEntry[];
  calories: CalorieEntry[];
  foods: FoodItem[];
  recipes: Recipe[];
  nutritionLogs: NutritionLog[];
  exercises: ExerciseItem[];
  workoutTemplates: WorkoutTemplate[];
  workouts: WorkoutEntry[];
  cardio: CardioEntry[];
  steps: StepEntry[];
}

/**
 * Non-sensitive display metadata only — NEVER stores tokens, cookies, passwords, or PINs (G-005).
 */
export interface CachedSessionMeta {
  user: User;
  accessMode: AccessMode;
  isConfigured: boolean;
  updatedAt: string;
}

export type SyncDeletedItem<T> = T & { deletedAt: string | null };

export interface SyncPullResponse {
  serverTime: string;
  isFullSync: boolean;
  profile: {
    name: string;
    dailyCalorieGoal: number;
    proteinGoalG: number;
    carbsGoalG: number;
    fatGoalG: number;
    dailyStepGoal: number;
    visibleMicronutrients: string[];
    updatedAt: string;
  } | null;
  core: {
    foods?: SyncDeletedItem<FoodItem>[];
    exercises?: SyncDeletedItem<ExerciseItem>[];
  };
  changes: {
    weights: SyncDeletedItem<WeightEntry>[];
    calories: SyncDeletedItem<CalorieEntry>[];
    foods: SyncDeletedItem<FoodItem>[];
    recipes: SyncDeletedItem<Recipe>[];
    nutritionLogs: SyncDeletedItem<NutritionLog>[];
    exercises: SyncDeletedItem<ExerciseItem>[];
    workoutTemplates: SyncDeletedItem<WorkoutTemplate>[];
    workouts: SyncDeletedItem<WorkoutEntry>[];
    cardio: SyncDeletedItem<CardioEntry>[];
    steps: SyncDeletedItem<StepEntry>[];
  };
}

export interface SyncMutationResult {
  clientMutationId: string;
  entity: SyncEntity;
  recordId: string;
  serverRecordId?: string;
  status: 'applied' | 'conflict_server_wins' | 'rejected';
  reason?: string;
}

export interface SyncPushResponse {
  serverTime: string;
  results: SyncMutationResult[];
  pull?: SyncPullResponse;
}
