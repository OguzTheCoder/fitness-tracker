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
  list: (token: string, range?: DateRange) =>
    apiRequest<{ entries: WeightEntry[] }>(`/weights${buildDateRangeQuery(range)}`, {
      method: 'GET',
      token,
    }),

  upsert: (token: string, payload: WeightEntryPayload) =>
    apiRequest<{ entry: WeightEntry; updated: boolean }>('/weights', {
      method: 'POST',
      token,
      body: payload,
    }),

  update: (token: string, id: string, payload: WeightEntryPayload) =>
    apiRequest<{ entry: WeightEntry }>(`/weights/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    }),

  remove: (token: string, id: string) =>
    apiRequest<{ message: string }>(`/weights/${id}`, {
      method: 'DELETE',
      token,
    }),
};
