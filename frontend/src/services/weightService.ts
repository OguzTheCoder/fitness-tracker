import { apiRequest } from './api';
import { buildDateRangeQuery, type DateRange } from '../utils/date';

export interface WeightEntry {
  id: string;
  userId: string;
  date: string;
  weightKg: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeightEntryPayload {
  date: string;
  weightKg: number;
  note?: string | null;
}

export const weightService = {
  list: (range?: DateRange) =>
    apiRequest<{ entries: WeightEntry[] }>(`/weights${buildDateRangeQuery(range)}`, {
      method: 'GET',
    }),

  upsert: (payload: WeightEntryPayload) =>
    apiRequest<{ entry: WeightEntry; updated: boolean }>('/weights', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: WeightEntryPayload) =>
    apiRequest<{ entry: WeightEntry }>(`/weights/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/weights/${id}`, {
      method: 'DELETE',
    }),
};
