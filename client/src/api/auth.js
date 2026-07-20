import { api } from './client';

export const authApi = {
  register: (payload) => api.post('/auth/register', payload).then((r) => r.data.data),
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  refresh: () => api.post('/auth/refresh').then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data.user),
  updateProfile: (payload) => api.put('/auth/profile', payload).then((r) => r.data.data.user),
  completeOnboarding: (payload) => api.post('/auth/onboarding', payload).then((r) => r.data.data.user),
  deleteAccount: (password) => api.delete('/auth/account', { data: { password } }).then((r) => r.data),
};

export default authApi;
