import { apiRequest } from './api';
import { buildDateRangeQuery, type DateRange } from '../utils/date';

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
    apiRequest<{ entries: CalorieEntry[]; dailyTotals: DailyCalorieTotal[] }>(
      `/calories${buildDateRangeQuery(range)}`,
      { method: 'GET' },
    ),

  create: (payload: CalorieEntryPayload) =>
    apiRequest<{ entry: CalorieEntry }>('/calories', {
      method: 'POST',
      body: payload,
    }),

  update: (id: string, payload: CalorieEntryPayload) =>
    apiRequest<{ entry: CalorieEntry }>(`/calories/${id}`, {
      method: 'PUT',
      body: payload,
    }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/calories/${id}`, {
      method: 'DELETE',
    }),
};
