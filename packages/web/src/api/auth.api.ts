import { api } from './client';
import type { User } from '@cyberguard/shared';

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/api/v1/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/api/v1/auth/login', data),

  logout: () =>
    api.post<{ message: string }>('/api/v1/auth/logout'),

  me: () =>
    api.get<{ user: User }>('/api/v1/auth/me'),

  refresh: () =>
    api.post<AuthResponse>('/api/v1/auth/refresh', undefined, { skipAuth: true }),

  createOrganization: (data: {
    name: string;
    country?: string;
    industry?: string;
    timezone?: string;
  }) => api.post<{ organization: any }>('/api/v1/organizations', data),
};
