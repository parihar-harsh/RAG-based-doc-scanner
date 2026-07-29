const mongoose = require('mongoose');
const Chunk = require('../models/Chunk');
const { cosineSimilarity } = require('./embeddingService');

const TOP_K = parseInt(process.env.RAG_TOP_K, 10) || 8;
const CANDIDATE_MULTIPLIER = parseInt(process.env.RAG_CANDIDATE_MULTIPLIER, 10) || 2;
const MAX_SEARCH_CANDIDATES = parseInt(process.env.RAG_MAX_SEARCH_CANDIDATES, 10) || 50;
const ENABLE_ATLAS_VECTOR_SEARCH = process.env.ENABLE_ATLAS_VECTOR_SEARCH === 'true';
const ATLAS_VECTOR_SEARCH_INDEX = process.env.ATLAS_VECTOR_SEARCH_INDEX || 'chunk_embedding_vector_index';
const ATLAS_VECTOR_NUM_CANDIDATES_MULTIPLIER =
  parseInt(process.env.ATLAS_VECTOR_NUM_CANDIDATES_MULTIPLIER, 10) || 20;
const ATLAS_VECTOR_MAX_NUM_CANDIDATES =
  parseInt(process.env.ATLAS_VECTOR_MAX_NUM_CANDIDATES, 10) || 10000;

function normalizePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLimit(value, fallback = TOP_K) {
  return normalizePositiveInt(value, fallback);
}

function getCandidateLimit(topK) {
  const multiplier = normalizePositiveInt(CANDIDATE_MULTIPLIER, 2);
  const maxCandidates = normalizePositiveInt(MAX_SEARCH_CANDIDATES, Math.max(topK * multiplier, topK));
  return Math.max(topK, Math.min(topK * multiplier, maxCandidates));
}

function getAtlasNumCandidates(limit) {
  const normalizedLimit = normalizeLimit(limit);
  const multiplier = normalizePositiveInt(ATLAS_VECTOR_NUM_CANDIDATES_MULTIPLIER, 20);
  const maxCandidates = normalizePositiveInt(
    ATLAS_VECTOR_MAX_NUM_CANDIDATES,
    Math.max(normalizedLimit * multiplier, normalizedLimit)
  );

  return Math.max(normalizedLimit, Math.min(normalizedLimit * multiplier, maxCandidates));
}

function isValidEmbedding(vector) {
  return Array.isArray(vector) && vector.length > 0 && vector.every(Number.isFinite);
}

/**
 * Vector search: compute cosine similarity between the query embedding
 * and all chunk embeddings for a given document.
 *
 * @param {string} documentId
 * @param {number[]} queryEmbedding
 * @param {number} [limit=TOP_K]
 * @returns {Promise<{ chunk: object, score: number }[]>}
 */
function documentCriteria(documentIds) {
  return Array.isArray(documentIds)
    ? { documentId: { $in: documentIds } }
    : { documentId: documentIds };
}

function toObjectId(value) {
  if (value instanceof mongoose.Types.ObjectId) return value;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : value;
}

function atlasDocumentFilter(documentIds) {
  if (Array.isArray(documentIds)) {
    const ids = documentIds.map(toObjectId);
    return { documentId: { $in: ids } };
  }

  return { documentId: toObjectId(documentIds) };
}

async function atlasVectorSearch(documentId, queryEmbedding, limit = TOP_K) {
  const normalizedLimit = normalizeLimit(limit);
  if (!isValidEmbedding(queryEmbedding)) return [];

  const results = await Chunk.aggregate([
    {
      $vectorSearch: {
        index: ATLAS_VECTOR_SEARCH_INDEX,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: getAtlasNumCandidates(normalizedLimit),
        limit: normalizedLimit,
        filter: atlasDocumentFilter(documentId),
      },
    },
    {
      $project: {
        documentId: 1,
        chunkIndex: 1,
        text: 1,
        tokenCount: 1,
        startSentence: 1,
        endSentence: 1,
        pageNumber: 1,
        endPageNumber: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ]);

  return results.map(({ score = 0, ...chunk }) => ({
    chunk,
    score,
  }));
}

async function appVectorSearch(documentId, queryEmbedding, limit = TOP_K) {
  const normalizedLimit = normalizeLimit(limit);
  if (!isValidEmbedding(queryEmbedding)) return [];

  const top = [];
  const cursor = Chunk.find(documentCriteria(documentId))
    .select('documentId chunkIndex text tokenCount embedding startSentence endSentence pageNumber endPageNumber')
    .lean()
    .cursor();

  for await (const chunk of cursor) {
    if (!isValidEmbedding(chunk.embedding) || chunk.embedding.length !== queryEmbedding.length) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (!Number.isFinite(score)) continue;

    const item = {
      chunk,
      score,
    };

    if (top.length < normalizedLimit) {
      top.push(item);
      top.sort((a, b) => a.score - b.score);
    } else if (item.score > top[0].score) {
      top[0] = item;
      top.sort((a, b) => a.score - b.score);
    }
  }

  return top.sort((a, b) => b.score - a.score);
}

async function vectorSearch(documentId, queryEmbedding, limit = TOP_K) {
  if (ENABLE_ATLAS_VECTOR_SEARCH) {
    try {
      return await atlasVectorSearch(documentId, queryEmbedding, limit);
    } catch (err) {
      console.warn('Atlas Vector Search failed, falling back to app-level vector scan:', err.message);
    }
  }

  return appVectorSearch(documentId, queryEmbedding, limit);
}

/**
 * Text search: use MongoDB $text index for keyword-based retrieval.
 *
 * @param {string} documentId
 * @param {string} query
 * @param {number} [limit=TOP_K]
 * @returns {Promise<{ chunk: object, score: number }[]>}
 */
async function textSearch(documentId, query, limit = TOP_K) {
  const normalizedLimit = normalizeLimit(limit);
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  if (!normalizedQuery) return [];

  try {
    const results = await Chunk.find(
      {
        ...documentCriteria(documentId),
        $text: { $search: normalizedQuery },
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(normalizedLimit)
      .lean();

    return results.map((chunk) => ({
      chunk,
      score: chunk.score || 0,
    }));
  } catch (err) {
    // If text index doesn't exist or query fails, return empty
    console.warn('Text search failed, falling back to empty:', err.message);
    return [];
  }
}

/**
 * Reciprocal Rank Fusion to merge results from multiple ranked lists.
 * RRF_score = sum(1 / (k + rank_i)) where k = 60.
 *
 * @param {Array<{ chunk: object, score: number }[]>} rankedLists
 * @param {number} [k=60]
 * @returns {{ chunk: object, score: number }[]}
 */
function reciprocalRankFusion(rankedLists, k = 60) {
  const scoreMap = new Map(); // chunkId -> { chunk, score }
  const rrfK = normalizePositiveInt(k, 60);

  for (const list of rankedLists) {
    if (!Array.isArray(list)) continue;
    const seenInList = new Set();

    list.forEach((item, rank) => {
      if (!item?.chunk?._id) return;

      const id = item.chunk._id.toString();
      if (seenInList.has(id)) return;
      seenInList.add(id);

      if (!scoreMap.has(id)) {
        scoreMap.set(id, { chunk: item.chunk, score: 0 });
      }
      scoreMap.get(id).score += 1 / (rrfK + rank + 1); // rank is 0-indexed, so +1
    });
  }

  const merged = Array.from(scoreMap.values());
  merged.sort((a, b) => b.score - a.score);
  return merged;
}

/**
 * Hybrid search combining vector + text search via RRF.
 *
 * @param {string} documentId
 * @param {string} query - Original query text (for text search)
 * @param {number[]} queryEmbedding - Query embedding (for vector search)
 * @param {object} [options]
 * @param {number} [options.topK=TOP_K]
 * @param {boolean} [options.enableHybrid=true]
 * @returns {Promise<{ chunk: object, score: number }[]>}
 */
async function hybridSearch(documentId, query, queryEmbedding, options = {}) {
  const topK = normalizeLimit(options.topK);
  const enableHybrid = options.enableHybrid !== undefined ? options.enableHybrid : true;
  const candidateK = getCandidateLimit(topK);

  // Always do vector search
  const vectorResults = await vectorSearch(documentId, queryEmbedding, candidateK);

  if (!enableHybrid) {
    return vectorResults.slice(0, topK);
  }

  // Also do text search
  const textResults = await textSearch(documentId, query, candidateK);

  // Merge with RRF
  const merged = reciprocalRankFusion([vectorResults, textResults]);
  return merged.slice(0, topK);
}

module.exports = {
  hybridSearch,
  vectorSearch,
  textSearch,
  reciprocalRankFusion,
  _private: {
    appVectorSearch,
    atlasDocumentFilter,
    atlasVectorSearch,
    getCandidateLimit,
    getAtlasNumCandidates,
    isValidEmbedding,
    normalizeLimit,
    toObjectId,
  },
};
