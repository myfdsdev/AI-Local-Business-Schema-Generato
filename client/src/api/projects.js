import { api } from './client';

export const projectsApi = {
  list: (params) => api.get('/projects', { params }).then((r) => r.data),
  create: (payload) => api.post('/projects', payload).then((r) => r.data.data.project),
  get: (projectId) => api.get(`/projects/${projectId}`).then((r) => r.data.data),
  update: (projectId, payload) => api.put(`/projects/${projectId}`, payload).then((r) => r.data.data.project),
  remove: (projectId) => api.delete(`/projects/${projectId}`).then((r) => r.data),
  archive: (projectId) => api.post(`/projects/${projectId}/archive`).then((r) => r.data.data.project),
  restore: (projectId) => api.post(`/projects/${projectId}/restore`).then((r) => r.data.data.project),
};

export const dashboardApi = {
  overview: () => api.get('/dashboard').then((r) => r.data.data),
};

export const catalogApi = {
  plans: () => api.get('/catalog/plans').then((r) => r.data.data.plans),
  schemaTypes: (params) => api.get('/catalog/schema-types', { params }).then((r) => r.data.data.schemaTypes),
};

export default projectsApi;
