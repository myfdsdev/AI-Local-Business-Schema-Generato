import { api } from './client';

export const workspaceApi = {
  context: () => api.get('/workspace').then((r) => r.data.data),
  stats: () => api.get('/workspace/stats').then((r) => r.data.data),
  members: () => api.get('/workspace/members').then((r) => r.data.data.members),
  invite: (payload) => api.post('/workspace/invite', payload).then((r) => r.data.data),
  updateMember: (userId, role) =>
    api.patch(`/workspace/members/${userId}`, { role }).then((r) => r.data),
  removeMember: (userId) => api.delete(`/workspace/members/${userId}`).then((r) => r.data),
  joinInfo: (token) => api.get(`/workspace/join/${token}`).then((r) => r.data.data),
  acceptJoin: (token, payload) =>
    api.post(`/workspace/join/${token}`, payload).then((r) => r.data.data),
};

export default workspaceApi;
