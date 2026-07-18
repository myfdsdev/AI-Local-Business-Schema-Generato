import { api } from './client';

export const schemaGenApi = {
  capabilities: () => api.get('/schema-generator/capabilities').then((r) => r.data.data),

  generate: ({ files = [], notes = '' }) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    if (notes) form.append('notes', notes);

    // Let the browser set the multipart boundary; overriding Content-Type here
    // would drop it and break the upload.
    return api
      .post('/schema-generator/generate', form, { headers: { 'Content-Type': undefined } })
      .then((r) => r.data.data);
  },
};

export default schemaGenApi;
