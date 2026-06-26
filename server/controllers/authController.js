const User = require('../models/User');
const {
  createToken,
  hashPassword,
  verifyPassword,
  publicUser,
} = require('../services/authService');
const { signupSchema, loginSchema, firstZodMessage } = require('../schemas/authSchemas');

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
    const validation = signupSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ success: false, error: firstZodMessage(validation) });
    }

    const { name, email, password } = validation.data;
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
    if (err?.code === 11000 && err?.keyPattern?.email) {
      return res.status(409).json({ success: false, error: 'An account already exists for this email.' });
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const validation = loginSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const { email, password } = validation.data;
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
