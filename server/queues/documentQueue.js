const { Queue, QueueEvents } = require('bullmq');
const IORedis = require('ioredis');
const { emitProgress } = require('../config/socket');

const QUEUE_NAME = 'document-processing';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function createRedisConnection() {
  const connection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  connection.on('error', (err) => {
    console.error(`Redis connection error (${REDIS_URL}):`, err.message);
  });

  return connection;
}

const queueConnection = createRedisConnection();
const eventsConnection = createRedisConnection();

const documentQueue = new Queue(QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: parseInt(process.env.DOCUMENT_JOB_ATTEMPTS, 10) || 5,
    backoff: {
      type: 'exponential',
      delay: parseInt(process.env.DOCUMENT_JOB_BACKOFF_MS, 10) || 15000,
    },
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 500,
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 1000,
    },
  },
});

const documentQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: eventsConnection,
});

async function addDocumentProcessingJob({ documentId, userId }) {
  return documentQueue.add(
    'process-document',
    { documentId, userId },
    {
      jobId: `process-document-${documentId}`,
    }
  );
}

async function retryDocumentProcessingJob({ documentId, userId }) {
  const jobId = `process-document-${documentId}`;
  const existingJob = await documentQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'active') {
      throw new Error('Document is already being processed.');
    }
    await existingJob.remove();
  }

  return addDocumentProcessingJob({ documentId, userId });
}

function startDocumentQueueEventRelay() {
  documentQueueEvents.on('progress', ({ data }) => {
    if (!data?.documentId || !data?.phase) return;
    emitProgress(data.documentId, data.phase, data);
  });

  documentQueueEvents.on('failed', ({ failedReason, jobId }) => {
    const documentId = String(jobId || '').replace('process-document-', '');
    if (!documentId) return;
    emitProgress(documentId, 'error', { message: failedReason || 'Document processing failed.' });
  });
}

async function closeDocumentQueueResources() {
  await Promise.allSettled([
    documentQueue.close(),
    documentQueueEvents.close(),
    queueConnection.quit(),
    eventsConnection.quit(),
  ]);
}

module.exports = {
  QUEUE_NAME,
  REDIS_URL,
  createRedisConnection,
  documentQueue,
  addDocumentProcessingJob,
  retryDocumentProcessingJob,
  startDocumentQueueEventRelay,
  closeDocumentQueueResources,
};
