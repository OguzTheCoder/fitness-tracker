import {
  localStore,
  offlineFirstRead,
  offlineFirstWrite,
  removeById,
  upsertById,
} from '../offline/localStore';
import { buildDateRangeQuery, type DateRange } from '../utils/date';
import { apiRequest } from './api';

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
    offlineFirstRead(
      () =>
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
      (res, data) => {
        for (const e of res.exercises) {
          if (e.isCore) data.coreExercises = upsertById(data.coreExercises, e);
          else data.exercises = upsertById(data.exercises, e);
        }
      },
      (data) => localStore.exercises.list(data, params),
    ),

  create: (payload: ExercisePayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ exercise: ExerciseItem }>('/exercises', {
          method: 'POST',
          body: payload,
        }),
      (res, data) => {
        data.exercises = upsertById(data.exercises, res.exercise);
      },
      (userId, data) => localStore.exercises.create(userId, data, payload),
    ),

  update: (id: string, payload: ExercisePayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ exercise: ExerciseItem }>(`/exercises/${id}`, {
          method: 'PUT',
          body: payload,
        }),
      (res, data) => {
        data.exercises = upsertById(data.exercises, res.exercise);
      },
      (userId, data) => localStore.exercises.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ message: string }>(`/exercises/${id}`, {
          method: 'DELETE',
        }),
      (_res, data) => {
        data.exercises = removeById(data.exercises, id);
      },
      (userId, data) => localStore.exercises.remove(userId, data, id),
    ),
};

export const workoutTemplateService = {
  list: (params?: { q?: string; limit?: number; offset?: number }) =>
    offlineFirstRead(
      () =>
        apiRequest<{ templates: WorkoutTemplate[]; total: number }>(
          `/workout-templates${buildQuery({
            q: params?.q,
            limit: params?.limit,
            offset: params?.offset,
          })}`,
          { method: 'GET' },
        ),
      (res, data) => {
        if (!params?.q && !params?.offset) {
          data.workoutTemplates = res.templates;
        } else {
          for (const t of res.templates) data.workoutTemplates = upsertById(data.workoutTemplates, t);
        }
      },
      (data) => localStore.workoutTemplates.list(data, params),
    ),

  create: (payload: WorkoutTemplatePayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ template: WorkoutTemplate }>('/workout-templates', {
          method: 'POST',
          body: payload,
        }),
      (res, data) => {
        data.workoutTemplates = upsertById(data.workoutTemplates, res.template);
      },
      (userId, data) => localStore.workoutTemplates.create(userId, data, payload),
    ),

  update: (id: string, payload: WorkoutTemplatePayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ template: WorkoutTemplate }>(`/workout-templates/${id}`, {
          method: 'PUT',
          body: payload,
        }),
      (res, data) => {
        data.workoutTemplates = upsertById(data.workoutTemplates, res.template);
      },
      (userId, data) => localStore.workoutTemplates.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ message: string }>(`/workout-templates/${id}`, {
          method: 'DELETE',
        }),
      (_res, data) => {
        data.workoutTemplates = removeById(data.workoutTemplates, id);
      },
      (userId, data) => localStore.workoutTemplates.remove(userId, data, id),
    ),
};

export const workoutService = {
  list: (range?: DateRange) =>
    offlineFirstRead(
      () =>
        apiRequest<{ entries: WorkoutEntry[]; summary: WorkoutSummary }>(
          `/workouts${buildDateRangeQuery(range)}`,
          { method: 'GET' },
        ),
      (res, data) => {
        if (!range?.from && !range?.to) {
          data.workouts = res.entries;
        } else {
          for (const e of res.entries) data.workouts = upsertById(data.workouts, e);
        }
      },
      (data) => localStore.workouts.list(data, range),
    ),

  getPrevious: (params: {
    exerciseIds?: string[];
    exerciseNames?: string[];
    beforeDate?: string;
    excludeWorkoutId?: string;
  }) =>
    offlineFirstRead(
      () =>
        apiRequest<PreviousPerformanceResponse>(
          `/workouts/previous${buildQuery({
            exerciseIds: params.exerciseIds?.join(','),
            exerciseNames: params.exerciseNames?.join(','),
            beforeDate: params.beforeDate,
            excludeWorkoutId: params.excludeWorkoutId,
          })}`,
          { method: 'GET' },
        ),
      () => {},
      (data) => localStore.workouts.getPrevious(data, params),
    ),

  create: (payload: WorkoutEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: WorkoutEntry }>('/workouts', {
          method: 'POST',
          body: payload,
        }),
      (res, data) => {
        data.workouts = upsertById(data.workouts, res.entry);
      },
      (userId, data) => localStore.workouts.create(userId, data, payload),
    ),

  update: (id: string, payload: WorkoutEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: WorkoutEntry }>(`/workouts/${id}`, {
          method: 'PUT',
          body: payload,
        }),
      (res, data) => {
        data.workouts = upsertById(data.workouts, res.entry);
      },
      (userId, data) => localStore.workouts.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ message: string }>(`/workouts/${id}`, {
          method: 'DELETE',
        }),
      (_res, data) => {
        data.workouts = removeById(data.workouts, id);
      },
      (userId, data) => localStore.workouts.remove(userId, data, id),
    ),
};

export const cardioService = {
  list: (range?: DateRange & { cardioType?: string }) =>
    offlineFirstRead(
      () =>
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
      (res, data) => {
        if (!range?.from && !range?.to && !range?.cardioType) {
          data.cardio = res.entries;
        } else {
          for (const c of res.entries) data.cardio = upsertById(data.cardio, c);
        }
      },
      (data) => localStore.cardio.list(data, range),
    ),

  create: (payload: CardioEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: CardioEntry }>('/cardio', {
          method: 'POST',
          body: payload,
        }),
      (res, data) => {
        data.cardio = upsertById(data.cardio, res.entry);
      },
      (userId, data) => localStore.cardio.create(userId, data, payload),
    ),

  update: (id: string, payload: CardioEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: CardioEntry }>(`/cardio/${id}`, {
          method: 'PUT',
          body: payload,
        }),
      (res, data) => {
        data.cardio = upsertById(data.cardio, res.entry);
      },
      (userId, data) => localStore.cardio.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ message: string }>(`/cardio/${id}`, {
          method: 'DELETE',
        }),
      (_res, data) => {
        data.cardio = removeById(data.cardio, id);
      },
      (userId, data) => localStore.cardio.remove(userId, data, id),
    ),
};

export const stepService = {
  list: (range?: DateRange) =>
    offlineFirstRead(
      () =>
        apiRequest<{ entries: StepEntry[]; summary: StepSummary }>(
          `/steps${buildDateRangeQuery(range)}`,
          { method: 'GET' },
        ),
      (res, data) => {
        if (!range?.from && !range?.to) {
          data.steps = res.entries;
        } else {
          for (const s of res.entries) data.steps = upsertById(data.steps, s);
        }
      },
      (data) => localStore.steps.list(data, range),
    ),

  upsert: (payload: StepEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: StepEntry; updated: boolean }>('/steps', {
          method: 'POST',
          body: payload,
        }),
      (res, data) => {
        data.steps = upsertById(data.steps, res.entry);
      },
      (userId, data) => localStore.steps.upsert(userId, data, payload),
    ),

  update: (id: string, payload: StepEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: StepEntry }>(`/steps/${id}`, {
          method: 'PUT',
          body: payload,
        }),
      (res, data) => {
        data.steps = upsertById(data.steps, res.entry);
      },
      (userId, data) => localStore.steps.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ message: string }>(`/steps/${id}`, {
          method: 'DELETE',
        }),
      (_res, data) => {
        data.steps = removeById(data.steps, id);
      },
      (userId, data) => localStore.steps.remove(userId, data, id),
    ),
};
