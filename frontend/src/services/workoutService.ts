import { apiRequest } from './api';
import { buildDateRangeQuery, type DateRange } from '../utils/date';

export interface WorkoutEntry {
  id: string;
  userId: string;
  date: string;
  name: string;
  durationMinutes: number;
  note: string | null;
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
}

export const workoutService = {
  list: (range?: DateRange) =>
    apiRequest<{ entries: WorkoutEntry[]; summary: WorkoutSummary }>(
      `/workouts${buildDateRangeQuery(range)}`,
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
