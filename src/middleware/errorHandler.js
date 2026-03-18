import logger from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} — ${err.message}`, {
    body:   req.body,
    user:   req.user?.id ?? 'unauthenticated',
    stack:  err.stack,
  });

  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error.' });
}