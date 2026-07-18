import { api } from './client';

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard').then((r) => r.data.data),
  listUsers: (params) => api.get('/admin/users', { params }).then((r) => r.data),
  listProjects: (params) => api.get('/admin/projects', { params }).then((r) => r.data),
  schemaTypes: () => api.get('/admin/schema-types').then((r) => r.data.data.schemaTypes),
};

export default adminApi;
