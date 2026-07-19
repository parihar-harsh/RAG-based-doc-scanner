const { Server } = require('socket.io');
const { getCorsOrigin } = require('./cors');
const { isValidObjectId } = require('../utils/objectId');
const { verifyToken } = require('../services/authService');
const Document = require('../models/Document');

let io = null;

/**
 * Initialize Socket.io and attach it to the HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: getCorsOrigin(),
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = verifyToken(token);
      socket.userId = payload.sub;
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join-document', async (documentId) => {
      if (!isValidObjectId(documentId)) return;

      try {
        const ownsDocument = await Document.exists({ _id: documentId, userId: socket.userId });
        if (!ownsDocument) return;

        socket.join(`doc-${documentId}`);
        console.log(`Socket ${socket.id} joined room doc-${documentId}`);
      } catch (err) {
        console.warn(`Socket ${socket.id} could not join doc-${documentId}:`, err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Get the Socket.io instance.
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocket first.');
  }
  return io;
}

/**
 * Emit a processing progress event for a specific document.
 * @param {string} documentId
 * @param {'parsing'|'chunking'|'embedding'|'ready'|'error'} stage
 * @param {object} [data]
 */
function emitProgress(documentId, stage, data = {}) {
  if (!io) return;

  const payload = {
    documentId,
    phase: stage,
    timestamp: new Date().toISOString(),
    ...data,
  };

  if (stage === 'ready') {
    io.to(`doc-${documentId}`).emit('processing:complete', payload);
  } else if (stage === 'error') {
    io.to(`doc-${documentId}`).emit('processing:error', { ...payload, error: data.message });
  } else {
    io.to(`doc-${documentId}`).emit('processing:progress', payload);
  }
}

module.exports = { initSocket, getIO, emitProgress };
