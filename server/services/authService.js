const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.AUTH_TOKEN_SECRET || process.env.GEMINI_API_KEY || 'dev-jwt-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'talk-to-my-doc',
      audience: 'talk-to-my-doc-client',
    }
  );
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token');
  }

  return jwt.verify(token, JWT_SECRET, {
    issuer: 'talk-to-my-doc',
    audience: 'talk-to-my-doc-client',
  });
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
