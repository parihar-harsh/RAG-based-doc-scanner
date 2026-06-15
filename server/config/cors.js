function getCorsOrigin() {
  const configured = process.env.CLIENT_ORIGIN;
  if (!configured) return '*';

  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length <= 1) return origins[0] || '*';
  return origins;
}

module.exports = { getCorsOrigin };
