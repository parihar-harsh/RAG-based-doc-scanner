const { Router } = require('express');
const { signup, login, me, logout } = require('../controllers/authController');
const requireAuth = require('../middleware/auth');

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/signin', login);
router.get('/me', requireAuth, me);
router.post('/logout', requireAuth, logout);

module.exports = router;
