import {
  localStore,
  offlineFirstRead,
  offlineFirstWrite,
  removeById,
  upsertById,
} from '../offline/localStore';
import { buildDateRangeQuery, type DateRange } from '../utils/date';
import { apiRequest } from './api';

export interface CalorieEntry {
  id: string;
  userId: string;
  date: string;
  mealName: string;
  calories: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyCalorieTotal {
  date: string;
  totalCalories: number;
  count: number;
}

export interface CalorieEntryPayload {
  date: string;
  mealName: string;
  calories: number;
}

export const calorieService = {
  list: (range?: DateRange) =>
    offlineFirstRead(
      () =>
        apiRequest<{ entries: CalorieEntry[]; dailyTotals: DailyCalorieTotal[] }>(
          `/calories${buildDateRangeQuery(range)}`,
          { method: 'GET' },
        ),
      (res, data) => {
        if (!range?.from && !range?.to) {
          data.calories = res.entries;
        } else {
          for (const e of res.entries) data.calories = upsertById(data.calories, e);
        }
      },
      (data) => localStore.calories.list(data, range),
    ),

  create: (payload: CalorieEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: CalorieEntry }>('/calories', {
          method: 'POST',
          body: payload,
        }),
      (res, data) => {
        data.calories = upsertById(data.calories, res.entry);
      },
      (userId, data) => localStore.calories.create(userId, data, payload),
    ),

  update: (id: string, payload: CalorieEntryPayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ entry: CalorieEntry }>(`/calories/${id}`, {
          method: 'PUT',
          body: payload,
        }),
      (res, data) => {
        data.calories = upsertById(data.calories, res.entry);
      },
      (userId, data) => localStore.calories.update(userId, data, id, payload),
    ),

  remove: (id: string) =>
    offlineFirstWrite(
      () =>
        apiRequest<{ message: string }>(`/calories/${id}`, {
          method: 'DELETE',
        }),
      (_res, data) => {
        data.calories = removeById(data.calories, id);
      },
      (userId, data) => localStore.calories.remove(userId, data, id),
    ),
};
