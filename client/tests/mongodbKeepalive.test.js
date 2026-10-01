import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MongoClient } from 'mongodb';
import handler from '../api/cron/mongodb-keepalive.js';

function setup(t) {
  const previous = { CRON_SECRET: process.env.CRON_SECRET, MONGODB_URI: process.env.MONGODB_URI };
  process.env.CRON_SECRET = 'test-secret-for-cron';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/keepalive-test';
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const clients = [];
  const connect = t.mock.method(MongoClient.prototype, 'connect', async function () {
    clients.push(this);
    return this;
  });
  const command = t.mock.fn(async () => ({ ok: 1 }));
  t.mock.method(MongoClient.prototype, 'db', () => ({ command }));
  const close = t.mock.method(MongoClient.prototype, 'close', async () => {});
  t.mock.method(console, 'info', () => {});
  const warn = t.mock.method(console, 'warn', () => {});
  const req = { method: 'GET', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } };
  const res = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
  return { req, res, connect, command, close, warn, clients };
}

test('rejects absent and incorrect authorization without connecting', async (t) => {
  const { req, res, connect } = setup(t);
  for (const authorization of [undefined, 'Bearer wrong', 'Bearer test-secret-for-crox', ['invalid']]) {
    req.headers.authorization = authorization;
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  }
  assert.equal(connect.mock.callCount(), 0);
});

test('fails closed when the cron secret is not configured', async (t) => {
  const { req, res, connect } = setup(t);
  delete process.env.CRON_SECRET;
  req.headers.authorization = 'Bearer undefined';
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(connect.mock.callCount(), 0);
});

test('rejects other HTTP methods', async (t) => {
  const { req, res, connect } = setup(t);
  req.method = 'POST';
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
  assert.equal(connect.mock.callCount(), 0);
});

test('reports missing database configuration without connecting', async (t) => {
  const { req, res, connect } = setup(t);
  delete process.env.MONGODB_URI;
  await handler(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(connect.mock.callCount(), 0);
});

test('pings through a fresh connection per invocation and closes it', async (t) => {
  const { req, res, connect, command, close, clients } = setup(t);
  await handler(req, res);
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.ok(Number.isFinite(Date.parse(res.body.timestamp)));
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(connect.mock.callCount(), 2);
  assert.equal(close.mock.callCount(), 2);
  assert.notEqual(clients[0], clients[1]);
  assert.deepEqual(command.mock.calls.map(call => call.arguments), [[{ ping: 1 }], [{ ping: 1 }]]);
});

test('retries a transient connection failure and closes both clients', async (t) => {
  const { req, res, connect, command, close } = setup(t);
  connect.mock.mockImplementationOnce(async () => { throw new Error('temporary failure'); });
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(connect.mock.callCount(), 2);
  assert.equal(command.mock.callCount(), 1);
  assert.equal(close.mock.callCount(), 2);
});

test('returns failure after two unsuccessful pings without exposing error details', async (t) => {
  const { req, res, connect, command, close, warn } = setup(t);
  command.mock.mockImplementation(async () => { throw new Error('private-db-details'); });
  await handler(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.equal(connect.mock.callCount(), 2);
  assert.equal(close.mock.callCount(), 2);
  assert.doesNotMatch(JSON.stringify([res.body, warn.mock.calls.map(call => call.arguments)]), /private-db-details/);
});

test('handles invalid connection strings without exposing credentials', async (t) => {
  const { req, res, connect } = setup(t);
  process.env.MONGODB_URI = 'invalid://private-db-details';
  await handler(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(connect.mock.callCount(), 0);
  assert.doesNotMatch(JSON.stringify(res.body), /private-db-details/);
});

test('daily schedule targets the function and SPA fallback excludes API routes', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.deepEqual(config.crons, [{ path: '/api/cron/mongodb-keepalive', schedule: '17 4 * * *' }]);
  const fallback = new RegExp(`^${config.rewrites[0].source}$`);
  assert.equal(fallback.test('/api/cron/mongodb-keepalive'), false);
  assert.equal(fallback.test('/api'), false);
  assert.equal(fallback.test('/'), true);
  assert.equal(fallback.test('/chat/example'), true);
  assert.equal(fallback.test('/apiary'), true);
});
