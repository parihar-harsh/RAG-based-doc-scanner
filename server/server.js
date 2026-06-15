require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { validateRuntimeEnv } = require('./config/env');
const { initSocket } = require('./config/socket');
const { startDocumentQueueEventRelay } = require('./queues/documentQueue');

const PORT = process.env.PORT || 5000;

async function start() {
  validateRuntimeEnv();

  // Connect to MongoDB
  await connectDB();

  // Create HTTP server from Express app
  const server = http.createServer(app);

  // Attach Socket.io
  initSocket(server);
  startDocumentQueueEventRelay();

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Docs:   http://localhost:${PORT}/api/documents`);
    console.log(`   Chat:   http://localhost:${PORT}/api/chat/:docId`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
