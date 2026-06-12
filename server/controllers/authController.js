const User = require('../models/User');
const {
  createToken,
  hashPassword,
  verifyPassword,
  publicUser,
} = require('../services/authService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authResponse(user) {
  return {
    success: true,
    data: {
      user: publicUser(user),
      token: createToken(user),
    },
  };
}

async function signup(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    }

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'An account already exists for this email.' });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
    });

    res.status(201).json(authResponse(user));
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    res.json(authResponse(user));
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ success: true, data: { user: req.user } });
}

async function logout(_req, res) {
  res.json({ success: true, message: 'Logged out.' });
}

module.exports = { signup, login, me, logout };
