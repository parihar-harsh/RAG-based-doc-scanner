const { chat } = require('../services/ragService');
const Conversation = require('../models/Conversation');
const { isValidObjectId } = require('../utils/objectId');

const MAX_QUESTION_LENGTH = parseInt(process.env.MAX_QUESTION_LENGTH, 10) || 4000;

function validateId(value, label, res) {
  if (!isValidObjectId(value)) {
    res.status(400).json({ success: false, error: `Invalid ${label}.` });
    return false;
  }
  return true;
}

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
  const { question, conversationId, documentIds } = req.body;

  let selectedDocumentIds = null;
  if (documentIds != null) {
    if (!Array.isArray(documentIds) || documentIds.length === 0 || documentIds.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Document scope must contain between 1 and 20 documents.',
      });
    }

    selectedDocumentIds = [...new Set(documentIds)];
    if (
      selectedDocumentIds.some(
        (id) => typeof id !== 'string' || !isValidObjectId(id.trim())
      )
    ) {
      return res.status(400).json({ success: false, error: 'Invalid document scope.' });
    }
  }

  return streamChatResponse({
    req,
    res,
    question,
    conversationId,
    chatParams: { sessionId, selectedDocumentIds },
  });
}

async function streamChatResponse({ req, res, question, conversationId, chatParams }) {
  const trimmedQuestion = typeof question === 'string' ? question.trim() : '';

  if (!trimmedQuestion) {
    return res.status(400).json({ success: false, error: 'Question is required.' });
  }

  if (trimmedQuestion.length > MAX_QUESTION_LENGTH) {
    return res.status(413).json({
      success: false,
      error: `Question is too long. Maximum length is ${MAX_QUESTION_LENGTH} characters.`,
    });
  }

  if (chatParams.documentId && !validateId(chatParams.documentId, 'document ID', res)) return;
  if (chatParams.sessionId && !validateId(chatParams.sessionId, 'session ID', res)) return;

  let normalizedConversationId = null;
  if (conversationId != null && conversationId !== '') {
    if (typeof conversationId !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid conversation ID.' });
    }

    normalizedConversationId = conversationId.trim();
    if (normalizedConversationId && !validateId(normalizedConversationId, 'conversation ID', res)) return;
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
      conversationId: normalizedConversationId || null,
      question: trimmedQuestion,
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
    if (!validateId(documentId, 'document ID', res)) return;

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
    if (!validateId(sessionId, 'session ID', res)) return;

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
    if (!validateId(req.params.conversationId, 'conversation ID', res)) return;

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
    if (!validateId(req.params.conversationId, 'conversation ID', res)) return;

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
