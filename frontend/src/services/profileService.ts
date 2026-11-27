import { localStore, offlineFirstRead, offlineFirstWrite } from '../offline/localStore';
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
  get: () =>
    offlineFirstRead(
      () => apiRequest<ProfileResponse>('/profile', { method: 'GET' }),
      (res, data) => {
        data.profile = res.profile;
        if (res.availableMicronutrients?.length > 0) {
          data.availableMicronutrients = res.availableMicronutrients;
        }
      },
      (data) => localStore.profile.get(data),
    ),

  update: (payload: UpdateProfilePayload) =>
    offlineFirstWrite(
      () =>
        apiRequest<ProfileResponse>('/profile', {
          method: 'PUT',
          body: payload,
        }),
      (res, data) => {
        data.profile = res.profile;
        if (res.availableMicronutrients?.length > 0) {
          data.availableMicronutrients = res.availableMicronutrients;
        }
      },
      (userId, data) => localStore.profile.update(userId, data, payload),
    ),
};
