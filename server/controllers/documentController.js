const fs = require('fs/promises');
const Document = require('../models/Document');
const Session = require('../models/Session');
const Chunk = require('../models/Chunk');
const Conversation = require('../models/Conversation');
const { extractText } = require('../services/parserService');
const { semanticChunk } = require('../services/chunkerService');
const { embedBatch } = require('../services/embeddingService');
const { emitProgress } = require('../config/socket');
const { addDocumentProcessingJob } = require('../queues/documentQueue');

/**
 * POST /api/documents/upload
 * Upload a document and trigger async processing.
 */
async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { originalname, filename, mimetype, size, path: filePath } = req.file;
    const requestedSessionId = req.body.sessionId || null;
    let session;

    if (requestedSessionId) {
      session = await Session.findOne({ _id: requestedSessionId, userId: req.user.id });
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found.' });
      }
    } else {
      session = await Session.create({
        userId: req.user.id,
        title: originalname,
      });
    }

    const doc = await Document.create({
      userId: req.user.id,
      sessionId: session._id,
      originalName: originalname,
      fileName: filename,
      mimeType: mimetype,
      fileSize: size,
      filePath,
      status: 'uploaded',
    });

    session.updatedAt = new Date();
    await session.save();

    await addDocumentProcessingJob({
      documentId: doc._id.toString(),
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: {
        id: doc._id,
        sessionId: session._id,
        originalName: doc.originalName,
        status: doc.status,
        fileSize: doc.fileSize,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function notifyProgress(documentId, phase, data, onProgress) {
  if (onProgress) {
    await onProgress(phase, data);
  } else {
    emitProgress(documentId, phase, data);
  }
}

/**
 * Background document processing pipeline:
 * 1. Parse text from file
 * 2. Semantic chunking
 * 3. Embed chunks
 */
async function processDocument(documentId, options = {}) {
  const { onProgress = null, throwOnError = false } = options;
  const doc = await Document.findById(documentId);
  if (!doc) return;

  try {
    // --- Stage 1: Parsing ---
    doc.status = 'parsing';
    await doc.save();
    await notifyProgress(
      documentId,
      'parsing',
      { message: 'Extracting text from document...' },
      onProgress
    );

    const { text, pageCount } = await extractText(doc.filePath);

    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the document.');
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    doc.metadata = {
      pageCount: pageCount || null,
      wordCount,
      extractedTextLength: text.length,
    };
    await doc.save();

    await notifyProgress(
      documentId,
      'parsing',
      {
        message: `Extracted ${wordCount} words.`,
        wordCount,
      },
      onProgress
    );

    // --- Stage 2: Semantic Chunking ---
    doc.status = 'chunking';
    await doc.save();
    await notifyProgress(
      documentId,
      'chunking',
      { message: 'Creating semantic chunks...' },
      onProgress
    );

    const { chunks } = await semanticChunk(text);

    await notifyProgress(
      documentId,
      'chunking',
      {
        message: `Created ${chunks.length} semantic chunks.`,
        chunkCount: chunks.length,
      },
      onProgress
    );

    // --- Stage 3: Embedding ---
    doc.status = 'embedding';
    await doc.save();
    await notifyProgress(
      documentId,
      'embedding',
      { message: 'Generating embeddings for chunks...' },
      onProgress
    );

    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedBatch(chunkTexts);

    // Save chunks to database
    const chunkDocs = chunks.map((chunk, i) => ({
      documentId: doc._id,
      chunkIndex: i,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[i],
      startSentence: chunk.startSentence,
      endSentence: chunk.endSentence,
    }));

    await Chunk.insertMany(chunkDocs);

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    doc.totalChunks = chunks.length;
    doc.totalTokens = totalTokens;
    await doc.save();

    await notifyProgress(
      documentId,
      'embedding',
      {
        message: `Embedded ${chunks.length} chunks (${totalTokens} tokens).`,
        chunkCount: chunks.length,
        totalTokens,
      },
      onProgress
    );

    // --- Done ---
    doc.status = 'ready';
    await doc.save();
    await notifyProgress(
      documentId,
      'ready',
      {
        message: 'Document is ready for chat!',
      },
      onProgress
    );
  } catch (err) {
    console.error(`Processing error for doc ${documentId}:`, err);
    doc.status = 'error';
    doc.errorMessage = err.message;
    await doc.save();
    await notifyProgress(documentId, 'error', { message: err.message }, onProgress);
    if (throwOnError) throw err;
  }
}

/**
 * GET /api/documents
 * List all documents.
 */
async function listDocuments(req, res, next) {
  try {
    const docs = await Document.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select('-__v')
      .lean();

    res.json({
      success: true,
      data: docs,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documents/:id
 * Get a single document by ID.
 */
async function getDocument(req, res, next) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id })
      .select('-__v')
      .lean();

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/documents/:id
 * Delete a document and all its chunks.
 */
async function deleteDocument(req, res, next) {
  try {
    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id });

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    // Delete associated chunks
    await Chunk.deleteMany({ documentId: doc._id });

    const sessionDocumentCount = doc.sessionId
      ? await Document.countDocuments({ sessionId: doc.sessionId, userId: req.user.id })
      : 1;

    if (sessionDocumentCount <= 1) {
      await Conversation.deleteMany({
        userId: req.user.id,
        $or: [{ sessionId: doc.sessionId }, { documentId: doc._id }],
      });
      if (doc.sessionId) await Session.findOneAndDelete({ _id: doc.sessionId, userId: req.user.id });
    }

    // Delete the file from disk
    try {
      await fs.unlink(doc.filePath);
    } catch (fileErr) {
      console.warn('Could not delete file from disk:', fileErr.message);
    }

    await Document.findByIdAndDelete(doc._id);

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadDocument, processDocument, listDocuments, getDocument, deleteDocument };
