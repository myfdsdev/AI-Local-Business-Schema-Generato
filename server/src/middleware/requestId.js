import crypto from 'node:crypto';

/**
 * Tags each request with an id, echoed in the response header and stored on any
 * resulting system log. When a user reports "it failed", that id is what ties
 * their generic error message to the real stack trace.
 */
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

export default requestId;
