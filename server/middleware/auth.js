const User = require('../models/User');
const { verifyToken, publicUser } = require('../services/authService');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('_id name email').lean();

    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    req.user = publicUser(user);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Authentication required.' });
  }
}

module.exports = requireAuth;
