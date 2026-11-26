import { apiRequest } from './api';
import { buildDateRangeQuery, type DateRange } from '../utils/date';

export interface ExerciseItem {
  id: string;
  userId: string | null;
  isCore: boolean;
  coreKey: string | null;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  isBodyweight: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExercisePayload {
  name: string;
  muscleGroup: string;
  equipment?: string | null;
  isBodyweight?: boolean;
  notes?: string | null;
}

export interface WorkoutTemplateExercise {
  id: string;
  templateId: string;
  exerciseId: string | null;
  exerciseName: string;
  muscleGroup: string | null;
  defaultSets: number;
  defaultReps: number;
  defaultWeightKg: number | null;
  sortOrder: number;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  exercises: WorkoutTemplateExercise[];
}

export interface WorkoutTemplatePayload {
  name: string;
  description?: string | null;
  exercises: {
    exerciseId?: string | null;
    exerciseName?: string | null;
    muscleGroup?: string | null;
    defaultSets: number;
    defaultReps: number;
    defaultWeightKg?: number | null;
  }[];
}

export interface WorkoutSetItem {
  id?: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
}

export interface WorkoutExerciseItem {
  id?: string;
  exerciseId: string | null;
  exerciseName: string;
  muscleGroup: string | null;
  sortOrder?: number;
  note?: string | null;
  sets: WorkoutSetItem[];
}

export interface WorkoutEntry {
  id: string;
  userId: string;
  templateId?: string | null;
  date: string;
  name: string;
  durationMinutes: number;
  note: string | null;
  exercises?: WorkoutExerciseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutSummary {
  totalCount: number;
  totalDurationMinutes: number;
}

export interface WorkoutEntryPayload {
  date: string;
  name: string;
  durationMinutes: number;
  note?: string | null;
  templateId?: string | null;
  exercises?: {
    exerciseId?: string | null;
    exerciseName?: string | null;
    muscleGroup?: string | null;
    note?: string | null;
    sets: { reps: number; weightKg?: number | null }[];
  }[];
}

export interface PreviousExercisePerformance {
  workoutId: string;
  date: string;
  workoutName: string;
  exerciseId: string | null;
  exerciseName: string;
  sets: { setNumber: number; reps: number; weightKg: number | null }[];
}

export interface PreviousPerformanceResponse {
  byExerciseId: Record<string, PreviousExercisePerformance>;
  byExerciseName: Record<string, PreviousExercisePerformance>;
}

export interface CardioEntry {
  id: string;
  userId: string;
  date: string;
  cardioType: string;
  durationMinutes: number;
  distanceKm: number | null;
  caloriesBurned: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CardioSummary {
  totalCount: number;
  totalDurationMinutes: number;
  totalDistanceKm: number;
  totalCaloriesBurned: number;
}

export interface CardioEntryPayload {
  date: string;
  cardioType: string;
  durationMinutes: number;
  distanceKm?: number | null;
  caloriesBurned?: number | null;
  note?: string | null;
}

export interface StepEntry {
  id: string;
  userId: string;
  date: string;
  steps: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StepSummary {
  dailyStepGoal: number;
  todayDate: string;
  todaySteps: number;
  todayProgressPercent: number;
  totalSteps: number;
  averageDailySteps: number;
  daysLogged: number;
  goalMetDays: number;
}

export interface StepEntryPayload {
  date: string;
  steps: number;
  note?: string | null;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const exerciseService = {
  list: (params?: {
    q?: string;
    muscleGroup?: string;
    scope?: 'all' | 'core' | 'custom';
    limit?: number;
    offset?: number;
  }) =>
    apiRequest<{ exercises: ExerciseItem[]; total: number; muscleGroups: string[] }>(
      `/exercises${buildQuery({
        q: params?.q,
        muscleGroup: params?.muscleGroup,
        scope: params?.scope,
        limit: params?.limit,
        offset: params?.offset,
      })}`,
      { method: 'GET' },
    ),

  create: (payload: ExercisePayload) =>
    apiRequest<{ exercise: ExerciseItem }>('/exercises', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: ExercisePayload) =>
    apiRequest<{ exercise: ExerciseItem }>(`/exercises/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/exercises/${id}`, {
      method: 'DELETE',
    }),
};

export const workoutTemplateService = {
  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    apiRequest<{ templates: WorkoutTemplate[]; total: number }>(
      `/workout-templates${buildQuery({
        q: params?.q,
        limit: params?.limit,
        offset: params?.offset,
      })}`,
      { method: 'GET' },
    ),

  create: (payload: WorkoutTemplatePayload) =>
    apiRequest<{ template: WorkoutTemplate }>('/workout-templates', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: WorkoutTemplatePayload) =>
    apiRequest<{ template: WorkoutTemplate }>(`/workout-templates/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/workout-templates/${id}`, {
      method: 'DELETE',
    }),
};

export const workoutService = {
  list: (range?: DateRange) =>
    apiRequest<{ entries: WorkoutEntry[]; summary: WorkoutSummary }>(
      `/workouts${buildDateRangeQuery(range)}`,
      { method: 'GET' },
    ),

  getPrevious: (params: {
    exerciseIds?: string[];
    exerciseNames?: string[];
    beforeDate?: string;
    excludeWorkoutId?: string;
  }) =>
    apiRequest<PreviousPerformanceResponse>(
      `/workouts/previous${buildQuery({
        exerciseIds: params.exerciseIds?.join(','),
        exerciseNames: params.exerciseNames?.join(','),
        beforeDate: params.beforeDate,
        excludeWorkoutId: params.excludeWorkoutId,
      })}`,
      { method: 'GET' },
    ),

  create: (payload: WorkoutEntryPayload) =>
    apiRequest<{ entry: WorkoutEntry }>('/workouts', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: WorkoutEntryPayload) =>
    apiRequest<{ entry: WorkoutEntry }>(`/workouts/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/workouts/${id}`, {
      method: 'DELETE',
    }),
};

export const cardioService = {
  list: (range?: DateRange & { cardioType?: string }) =>
    apiRequest<{
      entries: CardioEntry[];
      cardioTypes: string[];
      summary: CardioSummary;
    }>(
      `/cardio${buildQuery({
        from: range?.from,
        to: range?.to,
        cardioType: range?.cardioType,
      })}`,
      { method: 'GET' },
    ),

  create: (payload: CardioEntryPayload) =>
    apiRequest<{ entry: CardioEntry }>('/cardio', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: CardioEntryPayload) =>
    apiRequest<{ entry: CardioEntry }>(`/cardio/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/cardio/${id}`, {
      method: 'DELETE',
    }),
};

export const stepService = {
  list: (range?: DateRange) =>
    apiRequest<{ entries: StepEntry[]; summary: StepSummary }>(
      `/steps${buildDateRangeQuery(range)}`,
      { method: 'GET' },
    ),

  upsert: (payload: StepEntryPayload) =>
    apiRequest<{ entry: StepEntry; updated: boolean }>('/steps', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: StepEntryPayload) =>
    apiRequest<{ entry: StepEntry }>(`/steps/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/steps/${id}`, {
      method: 'DELETE',
    }),
};
