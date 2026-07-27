import { api } from './client';

export const locationsApi = {
  list: () => api.get('/locations').then((r) => r.data.data.locations),
  create: (payload) => api.post('/locations', payload).then((r) => r.data.data.location),
  update: (locationId, payload) =>
    api.patch(`/locations/${locationId}`, payload).then((r) => r.data.data.location),
  remove: (locationId) => api.delete(`/locations/${locationId}`).then((r) => r.data),
};

export default locationsApi;
