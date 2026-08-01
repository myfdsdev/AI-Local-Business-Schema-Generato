import { api } from './client';

export const accessApi = {
  /** Requests workspace access. `code` comes from the secret link's ?code=. */
  request: (payload) => api.post('/access/request', payload).then((r) => r.data.data),
  /** Redeems the emailed link; returns a session. */
  claim: (token) => api.post('/access/claim', { token }).then((r) => r.data.data),
};

export default accessApi;
