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
  list: (token: string, range?: DateRange) =>
    apiRequest<{ entries: WorkoutEntry[]; summary: WorkoutSummary }>(
      `/workouts${buildDateRangeQuery(range)}`,
      { method: 'GET', token },
    ),

  create: (token: string, payload: WorkoutEntryPayload) =>
    apiRequest<{ entry: WorkoutEntry }>('/workouts', {
      method: 'POST',
      token,
      body: payload,
    }),

  update: (token: string, id: string, payload: WorkoutEntryPayload) =>
    apiRequest<{ entry: WorkoutEntry }>(`/workouts/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    }),

  remove: (token: string, id: string) =>
    apiRequest<{ message: string }>(`/workouts/${id}`, {
      method: 'DELETE',
      token,
    }),
};
