const crypto = require('crypto');

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || process.env.GEMINI_API_KEY || 'dev-auth-secret';

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
}

function createToken(user) {
  const payload = JSON.stringify({
    sub: user._id.toString(),
    email: user.email,
    exp: Date.now() + TOKEN_TTL_MS,
  });
  const encodedPayload = base64url(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Invalid token');
  }

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(signature || '');
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw new Error('Invalid token');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Date.now()) {
    throw new Error('Token expired');
  }

  return payload;
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) {
      resolve(false);
      return;
    }

    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }

      const storedKey = Buffer.from(key, 'hex');
      const candidateKey = Buffer.from(derivedKey.toString('hex'), 'hex');
      resolve(
        storedKey.length === candidateKey.length &&
          crypto.timingSafeEqual(storedKey, candidateKey)
      );
    });
  });
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

module.exports = {
  createToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  publicUser,
};
