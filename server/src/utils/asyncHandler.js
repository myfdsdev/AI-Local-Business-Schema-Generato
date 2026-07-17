/**
 * Express 4 does not forward rejected promises to the error handler, so every
 * async route handler is wrapped in this.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
