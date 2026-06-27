const { Router } = require('express');
const requireAuth = require('../middleware/auth');
const {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
} = require('../controllers/sessionController');

const router = Router();

router.use(requireAuth);

router.get('/', listSessions);
router.post('/', createSession);
router.get('/:id', getSession);
router.patch('/:id', updateSession);
router.delete('/:id', deleteSession);

module.exports = router;
