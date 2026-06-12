/**
 * Global error handler middleware.
 * Catches all errors thrown in route handlers / services.
 */
function errorHandler(err, _req, res, _next) {
  console.error('🔥 Error:', err);

  // Multer file-size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum size is 20 MB.',
    });
  }

  // Multer / validation errors thrown with a message
  if (err.message && err.message.startsWith('Unsupported file type')) {
    return res.status(415).json({
      success: false,
      error: err.message,
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: messages,
    });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format.',
    });
  }

  // Default
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
}

module.exports = errorHandler;
