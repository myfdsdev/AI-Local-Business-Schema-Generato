/**
 * Strips MongoDB operator injection from request input (spec section 23).
 *
 * Mongoose casts values by schema type, which stops most of this, but not
 * everywhere: an object reaching a query as `{ email: { $gt: "" } }` still
 * matches the first user in the collection. Keys starting with `$` and keys
 * containing `.` (which reach into nested paths) are dropped before any handler
 * sees them.
 *
 * Written here rather than pulled from a package because the well-known
 * middleware for this mutates `req.query`, which is a getter-only property on
 * current Express versions.
 */

const MAX_DEPTH = 12;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function scrub(value, depth, report) {
  if (depth > MAX_DEPTH) return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, depth + 1, report));
  }

  if (!isPlainObject(value)) return value;

  const cleaned = {};
  for (const [key, item] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      report.push(key);
      continue;
    }
    cleaned[key] = scrub(item, depth + 1, report);
  }
  return cleaned;
}

export function sanitizeRequest(req, _res, next) {
  const removed = [];

  if (req.body && typeof req.body === 'object') {
    req.body = scrub(req.body, 0, removed);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = scrub(req.params, 0, removed);
  }

  // req.query may be a getter-only accessor; mutate its contents in place.
  if (req.query && typeof req.query === 'object') {
    const cleanedQuery = scrub(req.query, 0, removed);
    for (const key of Object.keys(req.query)) {
      if (!(key in cleanedQuery)) delete req.query[key];
    }
    Object.assign(req.query, cleanedQuery);
  }

  if (removed.length > 0) req.sanitizedKeys = removed;

  return next();
}

/**
 * Neutralizes HTML-significant characters in strings that will be echoed back.
 *
 * This is defense in depth only. The real protection is that React escapes text
 * on render and this API never serves user content as HTML; values are stored
 * as the user typed them so that, for example, a business name containing "&"
 * round-trips correctly.
 */
export function escapeHtmlEntities(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default sanitizeRequest;
