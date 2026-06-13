const { Router } = require('express');
const {
  chatWithDocument,
  chatWithSession,
  listConversations,
  listSessionConversations,
  getConversation,
  deleteConversation,
} = require('../controllers/chatController');
const requireAuth = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

// POST /api/chat/sessions/:sessionId  — Chat with all documents in a session
router.post('/sessions/:sessionId', chatWithSession);

// GET /api/chat/sessions/:sessionId/conversations  — List conversations for a session
router.get('/sessions/:sessionId/conversations', listSessionConversations);

// POST /api/chat/:documentId  — Chat with a document (SSE streaming)
router.post('/:documentId', chatWithDocument);

// GET /api/chat/:documentId/conversations  — List conversations for a document
router.get('/:documentId/conversations', listConversations);

// GET /api/chat/conversations/:conversationId  — Get conversation history
router.get('/conversations/:conversationId', getConversation);

// DELETE /api/chat/conversations/:conversationId  — Delete conversation
router.delete('/conversations/:conversationId', deleteConversation);

module.exports = router;
