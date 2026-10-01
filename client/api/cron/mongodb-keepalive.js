import { timingSafeEqual } from 'node:crypto';
import { MongoClient } from 'mongodb';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization;
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  const received = Buffer.from(typeof authorization === 'string' ? authorization : '');
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  if (!process.env.MONGODB_URI) {
    return res.status(503).json({ success: false, error: 'Database check is not configured.' });
  }

  // Vercel does not retry failed cron invocations. Each attempt gets a fresh connection.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const client = new MongoClient(process.env.MONGODB_URI, {
        appName: 'doxchat-mongodb-keepalive',
        maxPoolSize: 1,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        socketTimeoutMS: 8000,
        timeoutMS: 10000,
      });
      try {
        await client.connect();
        await client.db().command({ ping: 1 });
      } finally {
        await client.close();
      }

      console.info('MongoDB keepalive succeeded.');
      return res.status(200).json({ success: true, timestamp: new Date().toISOString() });
    } catch {
      // Driver errors can include connection details; keep them out of logs and responses.
      console.warn(`MongoDB keepalive attempt ${attempt} failed.`);
    }
  }

  return res.status(503).json({
    success: false,
    error: 'Database check failed. Check Atlas cluster status, credentials, and network access.',
  });
}
