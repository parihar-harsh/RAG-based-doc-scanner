const Chunk = require('../models/Chunk');
const { embedText, cosineSimilarity } = require('./embeddingService');

const TOP_K = 8;

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

async function vectorSearch(documentId, queryEmbedding, limit = TOP_K) {
  const chunks = await Chunk.find(documentCriteria(documentId)).lean();

  const scored = chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
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
  try {
    const results = await Chunk.find(
      {
        ...documentCriteria(documentId),
        $text: { $search: query },
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
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

  for (const list of rankedLists) {
    list.forEach((item, rank) => {
      const id = item.chunk._id.toString();
      if (!scoreMap.has(id)) {
        scoreMap.set(id, { chunk: item.chunk, score: 0 });
      }
      scoreMap.get(id).score += 1 / (k + rank + 1); // rank is 0-indexed, so +1
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
  const topK = options.topK || TOP_K;
  const enableHybrid = options.enableHybrid !== undefined ? options.enableHybrid : true;

  // Always do vector search
  const vectorResults = await vectorSearch(documentId, queryEmbedding, topK);

  if (!enableHybrid) {
    return vectorResults.slice(0, topK);
  }

  // Also do text search
  const textResults = await textSearch(documentId, query, topK);

  // Merge with RRF
  const merged = reciprocalRankFusion([vectorResults, textResults]);
  return merged.slice(0, topK);
}

module.exports = { hybridSearch, vectorSearch, textSearch, reciprocalRankFusion };
