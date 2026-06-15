const Session = require('../models/Session');
const Document = require('../models/Document');
const Chunk = require('../models/Chunk');
const Conversation = require('../models/Conversation');
const { deleteDocumentFile } = require('../services/fileStorageService');

function getSessionStatus(documents) {
  if (documents.length === 0) return 'empty';
  if (documents.some((doc) => doc.status === 'error')) return 'error';
  if (documents.every((doc) => doc.status === 'ready')) return 'ready';
  return 'processing';
}

function getSessionTitle(session, documents) {
  if (session.title && session.title !== 'New Session') return session.title;
  if (documents.length === 1) return documents[0].originalName;
  if (documents.length > 1) return `${documents[0].originalName} + ${documents.length - 1} more`;
  return session.title || 'New Session';
}

async function hydrateSession(session) {
  const documents = await Document.find({ userId: session.userId, sessionId: session._id })
    .sort({ createdAt: 1 })
    .select('-__v')
    .lean();

  return {
    ...session,
    title: getSessionTitle(session, documents),
    documents,
    status: getSessionStatus(documents),
    documentCount: documents.length,
    totalChunks: documents.reduce((sum, doc) => sum + (doc.totalChunks || 0), 0),
  };
}

async function ensureSessionsForLegacyDocuments(userId) {
  const legacyDocs = await Document.find({ userId, sessionId: null }).sort({ createdAt: 1 });

  for (const doc of legacyDocs) {
    const session = await Session.create({
      userId,
      title: doc.originalName,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });

    doc.sessionId = session._id;
    await doc.save();

    await Conversation.updateMany(
      { userId, documentId: doc._id, sessionId: null },
      { $set: { sessionId: session._id } }
    );
  }
}

async function listSessions(req, res, next) {
  try {
    await ensureSessionsForLegacyDocuments(req.user.id);

    const sessions = await Session.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean();
    const hydrated = await Promise.all(sessions.map(hydrateSession));

    res.json({ success: true, data: hydrated });
  } catch (err) {
    next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user.id }).lean();

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found.' });
    }

    res.json({ success: true, data: await hydrateSession(session) });
  } catch (err) {
    next(err);
  }
}

async function createSession(req, res, next) {
  try {
    const title = typeof req.body.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 120)
      : 'New Session';

    const session = await Session.create({
      userId: req.user.id,
      title,
    });

    res.status(201).json({ success: true, data: await hydrateSession(session.toObject()) });
  } catch (err) {
    next(err);
  }
}

async function deleteSession(req, res, next) {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user.id });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found.' });
    }

    const documents = await Document.find({ sessionId: session._id, userId: req.user.id });
    const documentIds = documents.map((doc) => doc._id);

    await Chunk.deleteMany({ documentId: { $in: documentIds } });
    await Conversation.deleteMany({ sessionId: session._id, userId: req.user.id });

    await Promise.allSettled(documents.map((doc) => deleteDocumentFile(doc)));

    await Document.deleteMany({ sessionId: session._id, userId: req.user.id });
    await Session.findByIdAndDelete(session._id);

    res.json({ success: true, message: 'Session deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSessions, getSession, createSession, deleteSession };
