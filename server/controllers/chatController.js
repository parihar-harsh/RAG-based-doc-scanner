const { chat } = require('../services/ragService');
const Conversation = require('../models/Conversation');

/**
 * POST /api/chat/:documentId
 * Chat with a document using SSE (Server-Sent Events) streaming.
 *
 * Body: { question: string, conversationId?: string }
 *
 * The response streams back as SSE events:
 *   event: chunk   → data: { text: "..." }
 *   event: done    → data: { conversationId, sourcesCount }
 *   event: error   → data: { error: "..." }
 */
async function chatWithDocument(req, res, next) {
  const { documentId } = req.params;
  const { question, conversationId } = req.body;
  return streamChatResponse({
    req,
    res,
    question,
    conversationId,
    chatParams: { documentId },
  });
}

async function chatWithSession(req, res, next) {
  const { sessionId } = req.params;
  const { question, conversationId } = req.body;
  return streamChatResponse({
    req,
    res,
    question,
    conversationId,
    chatParams: { sessionId },
  });
}

async function streamChatResponse({ req, res, question, conversationId, chatParams }) {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Question is required.' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Handle client disconnect
  let isClientConnected = true;
  req.on('close', () => {
    isClientConnected = false;
  });

  try {
    const result = await chat({
      userId: req.user.id,
      conversationId: conversationId || null,
      question: question.trim(),
      ...chatParams,
      onChunk(text) {
        if (isClientConnected) {
          res.write(`data: ${JSON.stringify({ type: 'token', content: text })}\n\n`);
        }
      },
    });

    if (isClientConnected) {
      // Send sources
      res.write(
        `data: ${JSON.stringify({
          type: 'sources',
          sources: result.sources || [],
        })}\n\n`
      );
      // Send done
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          conversationId: result.conversationId,
        })}\n\n`
      );
      res.end();
    }
  } catch (err) {
    console.error('Chat error:', err);
    if (isClientConnected) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
      res.end();
    }
  }
}

/**
 * GET /api/chat/:documentId/conversations
 * List all conversations for a document.
 */
async function listConversations(req, res, next) {
  try {
    const { documentId } = req.params;

    const conversations = await Conversation.find({ documentId, userId: req.user.id })
      .sort({ updatedAt: -1 })
      .select('_id title createdAt updatedAt')
      .lean();

    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
}

async function listSessionConversations(req, res, next) {
  try {
    const { sessionId } = req.params;

    const conversations = await Conversation.find({ sessionId, userId: req.user.id })
      .sort({ updatedAt: -1 })
      .select('_id title createdAt updatedAt')
      .lean();

    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/chat/conversations/:conversationId
 * Get full conversation history.
 */
async function getConversation(req, res, next) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      userId: req.user.id,
    })
      .select('-__v')
      .lean();

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/chat/conversations/:conversationId
 * Delete a conversation.
 */
async function deleteConversation(req, res, next) {
  try {
    const result = await Conversation.findOneAndDelete({
      _id: req.params.conversationId,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ success: false, error: 'Conversation not found.' });
    }

    res.json({ success: true, message: 'Conversation deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  chatWithDocument,
  chatWithSession,
  listConversations,
  listSessionConversations,
  getConversation,
  deleteConversation,
};
