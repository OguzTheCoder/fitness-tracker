import { apiRequest } from './api';

export type MicronutrientCategory = 'mineral' | 'vitamin';

export interface MicronutrientMeta {
  key: string;
  label: string;
  unit: 'mg' | 'µg';
  category: MicronutrientCategory;
}

export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  dailyCalorieGoal: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
  dailyStepGoal: number;
  visibleMicronutrients: string[];
  updatedAt: string;
}

export interface ProfileResponse {
  profile: UserProfile;
  availableMicronutrients: MicronutrientMeta[];
}

export interface UpdateProfilePayload {
  name?: string;
  dailyCalorieGoal?: number;
  proteinGoalG?: number;
  carbsGoalG?: number;
  fatGoalG?: number;
  dailyStepGoal?: number;
  visibleMicronutrients?: string[];
}

export const profileService = {
  get: () => apiRequest<ProfileResponse>('/profile', { method: 'GET' }),

  update: (payload: UpdateProfilePayload) =>
    apiRequest<ProfileResponse>('/profile', {
      method: 'PUT',
      body: payload,
    }),
};
