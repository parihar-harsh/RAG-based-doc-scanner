const { EventEmitter } = require('events');

const progressBus = new EventEmitter();
progressBus.setMaxListeners(0);

function toStatus(phase) {
  if (phase === 'ready') return 'ready';
  if (phase === 'error') return 'error';
  return 'processing';
}

function emitProgress(documentId, phase, data = {}) {
  if (!documentId || !phase) return;

  const payload = {
    documentId: documentId.toString(),
    status: toStatus(phase),
    phase,
    timestamp: new Date().toISOString(),
    ...data,
  };

  progressBus.emit(`document:${payload.documentId}`, payload);
}

function subscribeDocumentProgress(documentId, listener) {
  const eventName = `document:${documentId.toString()}`;
  progressBus.on(eventName, listener);
  return () => progressBus.off(eventName, listener);
}

module.exports = {
  emitProgress,
  subscribeDocumentProgress,
};
