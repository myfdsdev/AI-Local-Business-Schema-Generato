import { api } from './client';

export const assistantApi = {
  capabilities: () => api.get('/assistant/capabilities').then((r) => r.data.data),
  chat: (messages) => api.post('/assistant/chat', { messages }).then((r) => r.data.data),
};

export default assistantApi;
