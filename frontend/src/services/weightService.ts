import {
  localStore,
  offlineFirstRead,
  offlineFirstWrite,
  removeById,
  upsertById,
} from '../offline/localStore';
import { buildDateRangeQuery, type DateRange } from '../utils/date';
import { apiRequest } from './api';

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
    offlineFirstRead(
      () =>
        apiRequest<{ entries: WeightEntry[] }>(`/weights${buildDateRangeQuery(range)}`, {
          method: 'GET',
        }),
      (res, data) => {
        if (!range?.from && !range?.to) {
          data.weights = res.entries;
        } else {
          for (const e of res.entries) data.weights = upsertById(data.weights, e);
        }
      },
      (data) => localStore.weights.list(data, range),
    ),

  upsert: (payload: WeightEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: WeightEntry; updated: boolean }>('/weights', {
          method: 'POST',
          body: payload,
        }),
      (res, data) => {
        data.weights = upsertById(data.weights, res.entry);
      },
      (userId, data) => localStore.weights.upsert(userId, data, payload),
    ),

  update: (id: string, payload: WeightEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: WeightEntry }>(`/weights/${id}`, {
          method: 'PUT',
          body: payload,
        }),
      (res, data) => {
        data.weights = upsertById(data.weights, res.entry);
      },
      (userId, data) => localStore.weights.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ message: string }>(`/weights/${id}`, {
          method: 'DELETE',
        }),
      (_res, data) => {
        data.weights = removeById(data.weights, id);
      },
      (userId, data) => localStore.weights.remove(userId, data, id),
    ),
};
