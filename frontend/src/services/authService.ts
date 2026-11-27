import { apiRequest } from './api';

export type AccessMode = 'local' | 'pin';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
}

export interface AccessStatusResponse {
  mode: AccessMode;
  isConfigured: boolean;
  isAuthenticated: boolean;
  user: User | null;
}

export interface AccessSessionResponse {
  mode: AccessMode;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SetupAccessPayload {
  name: string;
  pin?: string;
}

export const authService = {
  getAccessStatus: () => apiRequest<AccessStatusResponse>('/access/status', { method: 'GET' }),

  setupAccess: (payload: SetupAccessPayload) =>
    apiRequest<AccessSessionResponse>('/access/setup', { method: 'POST', body: payload }),

  unlockWithPin: (pin: string) =>
    apiRequest<AccessSessionResponse>('/access/unlock', { method: 'POST', body: { pin } }),

  resumeLocalSession: () =>
    apiRequest<AccessSessionResponse>('/access/local-session', { method: 'POST' }),

  register: (payload: RegisterPayload) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: LoginPayload) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: payload }),

  me: () => apiRequest<{ user: User }>('/auth/me', { method: 'GET' }),

  logout: () => apiRequest<{ message: string }>('/auth/logout', { method: 'POST' }),

  logoutAll: () => apiRequest<{ message: string }>('/auth/logout-all', { method: 'POST' }),

  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    }),

  resetPassword: (token: string, password: string) =>
    apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: { token, password },
    }),
};
