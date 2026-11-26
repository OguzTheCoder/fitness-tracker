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
  list: (token: string, range?: DateRange) =>
    apiRequest<{ entries: CalorieEntry[]; dailyTotals: DailyCalorieTotal[] }>(
      `/calories${buildDateRangeQuery(range)}`,
      { method: 'GET', token },
    ),

  create: (token: string, payload: CalorieEntryPayload) =>
    apiRequest<{ entry: CalorieEntry }>('/calories', {
      method: 'POST',
      token,
      body: payload,
    }),

  update: (token: string, id: string, payload: CalorieEntryPayload) =>
    apiRequest<{ entry: CalorieEntry }>(`/calories/${id}`, {
      method: 'PUT',
      token,
      body: payload,
    }),

  remove: (token: string, id: string) =>
    apiRequest<{ message: string }>(`/calories/${id}`, {
      method: 'DELETE',
      token,
    }),
};
