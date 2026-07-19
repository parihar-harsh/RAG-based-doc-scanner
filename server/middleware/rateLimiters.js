const rateLimit = require('express-rate-limit');

function intEnv(name, fallback) {
  const parsed = parseInt(process.env[name], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: message },
  });
}

const apiLimiter = createLimiter({
  windowMs: intEnv('API_RATE_LIMIT_WINDOW_MS', 60 * 1000),
  max: intEnv('API_RATE_LIMIT_MAX', 60),
  message: 'Too many requests, please try again later.',
});

const authLimiter = createLimiter({
  windowMs: intEnv('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: intEnv('AUTH_RATE_LIMIT_MAX', 20),
  message: 'Too many authentication attempts, please try again later.',
});

const uploadLimiter = createLimiter({
  windowMs: intEnv('UPLOAD_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: intEnv('UPLOAD_RATE_LIMIT_MAX', 10),
  message: 'Too many uploads, please try again later.',
});

const chatLimiter = createLimiter({
  windowMs: intEnv('CHAT_RATE_LIMIT_WINDOW_MS', 60 * 1000),
  max: intEnv('CHAT_RATE_LIMIT_MAX', 20),
  message: 'Too many chat requests, please slow down.',
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  chatLimiter,
};
