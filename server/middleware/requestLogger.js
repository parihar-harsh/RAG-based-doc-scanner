const crypto = require('crypto');

function requestLogger(req, res, next) {
  const requestId = req.get('x-request-id') || crypto.randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const userId = req.user?.id ? ` user=${req.user.id}` : '';
    console.log(
      `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms${userId}`
    );
  });

  next();
}

module.exports = requestLogger;
