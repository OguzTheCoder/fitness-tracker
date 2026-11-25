import { apiRequest } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
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

export const authService = {
  register: (payload: RegisterPayload) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: payload }),

  login: (payload: LoginPayload) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: payload }),

  me: (token: string) =>
    apiRequest<{ user: User }>('/auth/me', { method: 'GET', token }),

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
