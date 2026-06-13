const { GoogleGenerativeAI } = require('@google/generative-ai');

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2-flash-001';
const EMBEDDING_DIMENSIONS = parseInt(process.env.GEMINI_EMBEDDING_DIMENSIONS, 10) || null;
const EMBEDDING_TASK_TYPE = process.env.GEMINI_EMBEDDING_TASK_TYPE || 'RETRIEVAL_DOCUMENT';
const QUERY_EMBEDDING_TASK_TYPE = process.env.GEMINI_QUERY_EMBEDDING_TASK_TYPE || 'RETRIEVAL_QUERY';
const DEFAULT_BATCH_SIZE = parseInt(process.env.GEMINI_EMBEDDING_BATCH_SIZE, 10) || 100;
const MAX_RETRIES = parseInt(process.env.GEMINI_EMBEDDING_RETRIES, 10) || 4;
const RETRY_BASE_MS = parseInt(process.env.GEMINI_EMBEDDING_RETRY_BASE_MS, 10) || 1500;
const TRANSIENT_GEMINI_RE = /\b(429|500|502|503|504)\b|high demand|temporarily|unavailable|quota/i;

/** @type {GoogleGenerativeAI | null} */
let _genAI = null;

/**
 * Get raw Google GenAI singleton (for fast batch operations).
 */
function getGenAI() {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genAI;
}

function buildEmbeddingRequest(text, taskType = EMBEDDING_TASK_TYPE) {
  const request = {
    content: { role: 'user', parts: [{ text }] },
    taskType,
  };

  if (EMBEDDING_DIMENSIONS) {
    request.outputDimensionality = EMBEDDING_DIMENSIONS;
  }

  return request;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientGeminiError(err) {
  return TRANSIENT_GEMINI_RE.test(err?.message || '');
}

async function withEmbeddingRetry(operation) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES || !isTransientGeminiError(err)) {
        throw err;
      }

      const retryDelay = err?.errorDetails?.find?.((detail) => detail.retryDelay)?.retryDelay;
      const retryDelayMs = retryDelay
        ? parseInt(retryDelay, 10) * 1000
        : RETRY_BASE_MS * 2 ** (attempt - 1);

      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

/**
 * Embed a single query using Gemini's raw SDK.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
  const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await withEmbeddingRetry(() =>
    model.embedContent(buildEmbeddingRequest(text, QUERY_EMBEDDING_TASK_TYPE))
  );
  return result.embedding.values;
}

/**
 * Fast batch embedding using Gemini's batchEmbedContents API directly.
 * Sends up to 100 texts per API call instead of one-by-one.
 * This is ~50-100x faster than LangChain's embedDocuments for large batches.
 *
 * @param {string[]} texts
 * @param {object} [options]
 * @param {string} [options.taskType]
 * @param {number} [options.batchSize]
 * @param {(progress: { completed: number, total: number, batch: number, totalBatches: number }) => Promise<void>|void} [options.onProgress]
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts, options = {}) {
  if (texts.length === 0) return [];

  const taskType = options.taskType || EMBEDDING_TASK_TYPE;
  const batchSize = Math.min(Math.max(parseInt(options.batchSize, 10) || DEFAULT_BATCH_SIZE, 1), 100);
  const totalBatches = Math.ceil(texts.length / batchSize);
  const model = getGenAI().getGenerativeModel({ model: EMBEDDING_MODEL });
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const requests = batch.map((text) => buildEmbeddingRequest(text, taskType));

    const result = await withEmbeddingRetry(() => model.batchEmbedContents({ requests }));
    const vectors = result.embeddings.map((e) => e.values);
    allEmbeddings.push(...vectors);

    if (options.onProgress) {
      await options.onProgress({
        completed: allEmbeddings.length,
        total: texts.length,
        batch: Math.floor(i / batchSize) + 1,
        totalBatches,
      });
    }
  }

  return allEmbeddings;
}

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

module.exports = { embedText, embedBatch, cosineSimilarity };
