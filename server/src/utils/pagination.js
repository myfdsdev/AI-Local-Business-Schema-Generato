const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.limit, 10) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, requested));

  return { page, limit, skip: (page - 1) * limit };
}

export function buildPageMeta({ page, limit, total }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Whitelists sort input so a query string cannot reach arbitrary fields.
 */
export function parseSort(query = {}, allowedFields = [], fallback = '-createdAt') {
  const raw = typeof query.sort === 'string' ? query.sort : fallback;
  const descending = raw.startsWith('-');
  const field = descending ? raw.slice(1) : raw;

  if (!allowedFields.includes(field)) return fallback;
  return raw;
}
