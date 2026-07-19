const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiters');
const requestLogger = require('./middleware/requestLogger');
const { getCorsOrigin } = require('./config/cors');
const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const sessionRoutes = require('./routes/sessionRoutes');

const app = express();
app.set('trust proxy', 1);

// --------------- Global Middleware ---------------

// CORS
app.use(
  cors({
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'RateLimit-Remaining', 'RateLimit-Reset'],
  })
);

app.use(requestLogger);
app.use('/api/', apiLimiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --------------- Routes ---------------

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);

// --------------- Production Client ---------------

const clientDistPath = path.join(__dirname, 'public');
const clientIndexPath = path.join(clientDistPath, 'index.html');
if (process.env.SERVE_CLIENT !== 'false' && fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(clientIndexPath);
  });
}

// --------------- Error Handling ---------------

// 404 handler for unknown routes
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
