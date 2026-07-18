import { toApiError } from '@/api/client';

/**
 * Maps a failed API call back onto react-hook-form: field-level errors from the
 * server land on the matching input, and anything else becomes a form-level
 * error under the `root` key. Keeps server and client validation consistent.
 */
export function applyApiErrorToForm(error, form) {
  const parsed = toApiError(error);

  let matchedField = false;
  for (const item of parsed.errors ?? []) {
    if (item.field && form.getValues(item.field) !== undefined) {
      form.setError(item.field, { type: 'server', message: item.message });
      matchedField = true;
    }
  }

  if (!matchedField) {
    form.setError('root', { type: 'server', message: parsed.message });
  }

  return parsed;
}
