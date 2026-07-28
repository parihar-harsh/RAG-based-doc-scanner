const { Router } = require('express');
const upload = require('../middleware/upload');
const requireAuth = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiters');
const {
  uploadDocument,
  listDocuments,
  getDocument,
  getDocumentPreview,
  getDocumentFile,
  streamDocumentProgress,
  retryDocument,
  deleteDocument,
} = require('../controllers/documentController');

const router = Router();

router.use(requireAuth);

// POST /api/documents/upload  — Upload a document (PDF, DOCX, TXT)
router.post('/upload', uploadLimiter, upload.single('document'), uploadDocument);

// GET /api/documents  — List all documents
router.get('/', listDocuments);

router.get('/:id/preview', getDocumentPreview);
router.get('/:id/file', getDocumentFile);
router.get('/:id/progress', streamDocumentProgress);

// GET /api/documents/:id  — Get document details
router.get('/:id', getDocument);

// POST /api/documents/:id/retry  — Retry document processing
router.post('/:id/retry', retryDocument);

// DELETE /api/documents/:id  — Delete a document + chunks + conversations
router.delete('/:id', deleteDocument);

module.exports = router;
