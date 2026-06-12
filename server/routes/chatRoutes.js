const { Router } = require('express');
const {
  chatWithDocument,
  listConversations,
  getConversation,
  deleteConversation,
} = require('../controllers/chatController');
const requireAuth = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

// POST /api/chat/:documentId  — Chat with a document (SSE streaming)
router.post('/:documentId', chatWithDocument);

// GET /api/chat/:documentId/conversations  — List conversations for a document
router.get('/:documentId/conversations', listConversations);

// GET /api/chat/conversations/:conversationId  — Get conversation history
router.get('/conversations/:conversationId', getConversation);

// DELETE /api/chat/conversations/:conversationId  — Delete conversation
router.delete('/conversations/:conversationId', deleteConversation);

module.exports = router;
