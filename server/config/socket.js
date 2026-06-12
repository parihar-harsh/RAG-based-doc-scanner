const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.io and attach it to the HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join-document', (documentId) => {
      socket.join(`doc-${documentId}`);
      console.log(`Socket ${socket.id} joined room doc-${documentId}`);
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
    io.emit('processing:complete', payload);
  } else if (stage === 'error') {
    io.emit('processing:error', { ...payload, error: data.message });
  } else {
    io.emit('processing:progress', payload);
  }
}

module.exports = { initSocket, getIO, emitProgress };
