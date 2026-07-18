import { api } from './client';

export const seoApi = {
  capabilities: () => api.get('/seo/capabilities').then((r) => r.data.data),
  keywords: (payload) => api.post('/seo/keywords', payload).then((r) => r.data.data),
  content: (payload) => api.post('/seo/content', payload).then((r) => r.data.data),
};

export default seoApi;
