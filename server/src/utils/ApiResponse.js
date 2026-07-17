/**
 * Single success envelope for every endpoint (spec section 26).
 */
export function sendSuccess(res, { status = 200, message = 'OK', data = {}, meta } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function sendCreated(res, { message, data }) {
  return sendSuccess(res, { status: 201, message, data });
}

export default sendSuccess;
