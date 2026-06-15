const REQUIRED_PRODUCTION_ENV = [
  'MONGODB_URI',
  'REDIS_URL',
  'GEMINI_API_KEY',
  'JWT_SECRET',
];

function validateRuntimeEnv() {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { validateRuntimeEnv };
