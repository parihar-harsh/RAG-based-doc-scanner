require('dotenv').config();

const { Worker } = require('bullmq');
const connectDB = require('./config/db');
const { QUEUE_NAME, createRedisConnection } = require('./queues/documentQueue');
const { processDocument } = require('./controllers/documentController');

const WORKER_CONCURRENCY = parseInt(process.env.DOCUMENT_WORKER_CONCURRENCY, 10) || 1;

async function startWorker() {
  await connectDB();

  const connection = createRedisConnection();
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { documentId } = job.data;
      if (!documentId) throw new Error('Missing documentId in job payload.');

      await processDocument(documentId, {
        throwOnError: true,
        onProgress: async (phase, data = {}) => {
          await job.updateProgress({
            documentId,
            phase,
            ...data,
          });
        },
      });
    },
    {
      connection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Document job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Document job failed: ${job?.id}`, err.message);
  });

  console.log(`👷 Document worker running (concurrency=${WORKER_CONCURRENCY})`);

  async function shutdown() {
    console.log('Stopping document worker...');
    await worker.close();
    await connection.quit();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
