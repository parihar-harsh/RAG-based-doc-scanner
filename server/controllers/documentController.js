const Document = require('../models/Document');
const Session = require('../models/Session');
const Chunk = require('../models/Chunk');
const Conversation = require('../models/Conversation');
const { extractTextFromBuffer } = require('../services/parserService');
const {
  saveUploadedFile,
  readDocumentFile,
  deleteDocumentFile,
} = require('../services/fileStorageService');
const { semanticChunk } = require('../services/chunkerService');
const { embedBatch } = require('../services/embeddingService');
const { emitProgress } = require('../config/socket');
const { addDocumentProcessingJob, retryDocumentProcessingJob } = require('../queues/documentQueue');
const { isValidObjectId } = require('../utils/objectId');

const CHUNK_INSERT_BATCH_SIZE = parseInt(process.env.CHUNK_INSERT_BATCH_SIZE, 10) || 500;
const PROCESSING_STATUSES = ['uploaded', 'parsing', 'chunking', 'embedding'];
const PREVIEW_TEXT_LIMIT = 30000;

function normalizePreviewText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function addPageMetadata(chunks, pages = []) {
  if (!Array.isArray(pages) || pages.length === 0) return chunks;

  let combinedText = '';
  const ranges = pages.map((page) => {
    const pageText = normalizePreviewText(page.text);
    const start = combinedText.length;
    combinedText += `${combinedText ? ' ' : ''}${pageText}`;
    const end = combinedText.length;
    return { pageNumber: page.pageNumber, start, end };
  });

  let cursor = 0;
  return chunks.map((chunk) => {
    const normalizedChunk = normalizePreviewText(chunk.text);
    const searchText = normalizedChunk.slice(0, Math.min(normalizedChunk.length, 120));
    const start = searchText ? combinedText.indexOf(searchText, cursor) : -1;
    if (start < 0) return chunk;

    const end = start + normalizedChunk.length;
    cursor = start + searchText.length;
    const startPage = ranges.find((range) => start <= range.end && end >= range.start);
    const endPage = [...ranges].reverse().find((range) => start <= range.end && end >= range.start);

    return {
      ...chunk,
      pageNumber: startPage?.pageNumber || null,
      endPageNumber: endPage?.pageNumber || startPage?.pageNumber || null,
    };
  });
}

async function cleanupRejectedUpload(file) {
  if (!file?.path) return;
  await deleteDocumentFile({ storageType: 'local', filePath: file.path }).catch((err) =>
    console.warn('Could not clean up rejected upload:', err.message)
  );
}

/**
 * POST /api/documents/upload
 * Upload a document and trigger async processing.
 */
async function uploadDocument(req, res, next) {
  let storedFile = null;
  let createdSession = null;
  let createdDoc = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { originalname, mimetype, size } = req.file;
    if (!Number.isFinite(size) || size <= 0) {
      await cleanupRejectedUpload(req.file);
      return res.status(400).json({ success: false, error: 'Uploaded file is empty.' });
    }

    const requestedSessionId = typeof req.body.sessionId === 'string' && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : null;
    let session;

    if (requestedSessionId) {
      if (!isValidObjectId(requestedSessionId)) {
        await cleanupRejectedUpload(req.file);
        return res.status(400).json({ success: false, error: 'Invalid session ID.' });
      }

      session = await Session.findOne({ _id: requestedSessionId, userId: req.user.id });
      if (!session) {
        await cleanupRejectedUpload(req.file);
        return res.status(404).json({ success: false, error: 'Session not found.' });
      }
    }

    storedFile = await saveUploadedFile(req.file);

    if (!session) {
      session = await Session.create({
        userId: req.user.id,
        title: originalname,
      });
      createdSession = session;
    }

    createdDoc = await Document.create({
      userId: req.user.id,
      sessionId: session._id,
      originalName: originalname,
      fileName: storedFile.fileName,
      storageType: storedFile.storageType,
      storageKey: storedFile.storageKey,
      mimeType: mimetype,
      fileSize: size,
      filePath: storedFile.filePath,
      status: 'uploaded',
    });

    session.updatedAt = new Date();
    await session.save();

    await addDocumentProcessingJob({
      documentId: createdDoc._id.toString(),
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: {
        id: createdDoc._id,
        sessionId: session._id,
        originalName: createdDoc.originalName,
        status: createdDoc.status,
        fileSize: createdDoc.fileSize,
      },
    });
  } catch (err) {
    if (storedFile && !createdDoc) {
      await deleteDocumentFile(storedFile).catch((cleanupErr) =>
        console.warn('Could not clean up uploaded file after failed upload:', cleanupErr.message)
      );
    }

    if (createdDoc) {
      createdDoc.status = 'error';
      createdDoc.errorMessage = 'Document was uploaded but could not be queued for processing.';
      await createdDoc.save().catch((saveErr) =>
        console.warn('Could not mark failed upload document:', saveErr.message)
      );
    }

    if (createdSession && !createdDoc) {
      await Session.findByIdAndDelete(createdSession._id).catch((cleanupErr) =>
        console.warn('Could not clean up empty session after failed upload:', cleanupErr.message)
      );
    }

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
  if (!isValidObjectId(documentId)) {
    if (throwOnError) throw new Error('Invalid document ID.');
    return;
  }

  const doc = await Document.findById(documentId);
  if (!doc) return;

  try {
    await Chunk.deleteMany({ documentId: doc._id });

    // --- Stage 1: Parsing ---
    doc.status = 'parsing';
    doc.errorMessage = null;
    doc.totalChunks = 0;
    doc.totalTokens = 0;
    await doc.save();
    await notifyProgress(
      documentId,
      'parsing',
      { message: 'Extracting text from document...' },
      onProgress
    );

    const fileBuffer = await readDocumentFile(doc);
    const { text, pageCount, pages } = await extractTextFromBuffer(
      fileBuffer,
      doc.originalName || doc.fileName
    );

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

    const { chunks, stats: chunkingStats = {} } = await semanticChunk(text, {
      onProgress: (data) => notifyProgress(documentId, 'chunking', data, onProgress),
    });

    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error('No searchable text chunks could be created from the document.');
    }

    doc.metadata = {
      ...doc.metadata,
      sentenceCount: chunkingStats.sentenceCount || null,
      semanticUnitCount: chunkingStats.semanticUnitCount || null,
      breakpointCount: chunkingStats.breakpointCount || null,
    };
    await doc.save();

    await notifyProgress(
      documentId,
      'chunking',
      {
        message: `Created ${chunks.length} semantic chunks from ${chunkingStats.semanticUnitCount || 0} semantic units.`,
        chunkCount: chunks.length,
        semanticUnitCount: chunkingStats.semanticUnitCount,
      },
      onProgress
    );

    // --- Stage 3: Embedding ---
    doc.status = 'embedding';
    await doc.save();
    await notifyProgress(
      documentId,
      'embedding',
      { message: `Generating embeddings for ${chunks.length} chunks...`, chunkCount: chunks.length },
      onProgress
    );

    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedBatch(chunkTexts, {
      onProgress: ({ completed, total }) =>
        notifyProgress(
          documentId,
          'embedding',
          {
            message: `Embedded ${completed}/${total} chunks.`,
            embeddedChunks: completed,
            chunkCount: total,
          },
          onProgress
        ),
    });

    if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
      throw new Error('Embedding generation returned an unexpected number of vectors.');
    }

    // Save chunks to database
    const chunksWithPages = addPageMetadata(chunks, pages);
    const chunkDocs = chunksWithPages.map((chunk, i) => ({
      documentId: doc._id,
      chunkIndex: i,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[i],
      startSentence: chunk.startSentence,
      endSentence: chunk.endSentence,
      pageNumber: chunk.pageNumber || null,
      endPageNumber: chunk.endPageNumber || null,
    }));

    for (let i = 0; i < chunkDocs.length; i += CHUNK_INSERT_BATCH_SIZE) {
      const batch = chunkDocs.slice(i, i + CHUNK_INSERT_BATCH_SIZE);
      await Chunk.insertMany(batch, { ordered: false });
    }

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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID.' });
    }

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

async function getDocumentPreview(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID.' });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id })
      .select('originalName mimeType fileSize status metadata totalChunks')
      .lean();

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const chunks = await Chunk.find({ documentId: doc._id })
      .sort({ chunkIndex: 1 })
      .select('text pageNumber endPageNumber')
      .lean();

    let excerpt = '';
    for (const chunk of chunks) {
      if (excerpt.length >= PREVIEW_TEXT_LIMIT) break;
      excerpt += `${excerpt ? '\n\n' : ''}${chunk.text}`;
    }

    res.json({
      success: true,
      data: {
        ...doc,
        excerpt: excerpt.slice(0, PREVIEW_TEXT_LIMIT),
        truncated: excerpt.length >= PREVIEW_TEXT_LIMIT || chunks.length < doc.totalChunks,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getDocumentFile(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID.' });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id });
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    const buffer = await readDocumentFile(doc);
    const safeName = doc.originalName.replace(/[\r\n"]/g, '_');
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Length': buffer.length,
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function hasChatAfterDocumentUpload(doc, userId) {
  const scope = doc.sessionId
    ? [{ sessionId: doc.sessionId }, { documentId: doc._id }]
    : [{ documentId: doc._id }];

  const exactMessageMatch = await Conversation.exists({
    userId,
    $or: scope,
    messages: {
      $elemMatch: {
        createdAt: { $gte: doc.createdAt },
      },
    },
  });

  if (exactMessageMatch) return true;

  const fallbackConversationMatch = await Conversation.exists({
    userId,
    $or: scope,
    updatedAt: { $gte: doc.createdAt },
    'messages.0': { $exists: true },
  });

  return Boolean(fallbackConversationMatch);
}

/**
 * POST /api/documents/:id/retry
 * Retry processing for a failed or ready document.
 */
async function retryDocument(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID.' });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id });

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    if (PROCESSING_STATUSES.includes(doc.status)) {
      return res.status(409).json({ success: false, error: 'Document is already being processed.' });
    }

    await Chunk.deleteMany({ documentId: doc._id });

    doc.status = 'uploaded';
    doc.errorMessage = null;
    doc.totalChunks = 0;
    doc.totalTokens = 0;
    doc.metadata = {
      ...(doc.metadata || {}),
      sentenceCount: null,
      semanticUnitCount: null,
      breakpointCount: null,
    };
    await doc.save();

    await retryDocumentProcessingJob({
      documentId: doc._id.toString(),
      userId: req.user.id,
    });

    emitProgress(doc._id.toString(), 'uploaded', { message: 'Document queued for retry.' });

    res.json({
      success: true,
      data: {
        id: doc._id,
        sessionId: doc.sessionId,
        status: doc.status,
        originalName: doc.originalName,
      },
    });
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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID.' });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.user.id });

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    if (await hasChatAfterDocumentUpload(doc, req.user.id)) {
      return res.status(409).json({
        success: false,
        error: 'This document cannot be deleted after chat has started in this session.',
      });
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

    await deleteDocumentFile(doc);

    await Document.findByIdAndDelete(doc._id);

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadDocument,
  processDocument,
  listDocuments,
  getDocument,
  getDocumentPreview,
  getDocumentFile,
  retryDocument,
  deleteDocument,
};
