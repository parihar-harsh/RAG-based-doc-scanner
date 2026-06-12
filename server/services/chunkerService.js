const { embedBatch, cosineSimilarity } = require('./embeddingService');

const THRESHOLD_K = parseFloat(process.env.SEMANTIC_CHUNK_THRESHOLD_K) || 1.0;
const MAX_CHUNK_TOKENS = 800;
const MIN_CHUNK_TOKENS = 50;

/**
 * Rough token count — approximated as word count × 1.3.
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

/**
 * Split text into sentences using regex.
 * Splits at sentence-ending punctuation (.!?) followed by whitespace and an
 * uppercase letter, quote, or parenthesis — preserving abbreviations and decimals.
 * Also splits on double newlines (paragraph breaks).
 *
 * This is more precise than LangChain's RecursiveCharacterTextSplitter for
 * semantic chunking because it cuts at actual sentence boundaries rather than
 * arbitrary character counts.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const raw = normalized.split(/(?<=[.!?])\s+(?=[A-Z"'"(])|(?<=\n\n)/);
  return raw.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Compute mean and standard deviation of an array of numbers.
 * @param {number[]} values
 * @returns {{ mean: number, stddev: number }}
 */
function meanStddev(values) {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

/**
 * Perform secondary splitting on a chunk that exceeds MAX_CHUNK_TOKENS.
 * Splits at sentence boundaries to produce sub-chunks under the token limit.
 * @param {string[]} sentences
 * @returns {string[][]} array of sentence groups
 */
function secondarySplit(sentences) {
  const groups = [];
  let current = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence);
    if (currentTokens + sentTokens > MAX_CHUNK_TOKENS && current.length > 0) {
      groups.push([...current]);
      current = [];
      currentTokens = 0;
    }
    current.push(sentence);
    currentTokens += sentTokens;
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

/**
 * Merge a small chunk with its neighbor.
 * Returns the merged groups after combining small chunks with their nearest neighbor.
 * @param {string[][]} groups
 * @returns {string[][]}
 */
function mergeSmallChunks(groups) {
  if (groups.length <= 1) return groups;

  const merged = [];
  let i = 0;

  while (i < groups.length) {
    const text = groups[i].join(' ');
    const tokens = estimateTokens(text);

    if (tokens < MIN_CHUNK_TOKENS && merged.length > 0) {
      // Merge with previous group
      merged[merged.length - 1] = [...merged[merged.length - 1], ...groups[i]];
    } else if (tokens < MIN_CHUNK_TOKENS && i + 1 < groups.length) {
      // Merge with next group
      groups[i + 1] = [...groups[i], ...groups[i + 1]];
    } else {
      merged.push([...groups[i]]);
    }

    i++;
  }

  return merged;
}

/**
 * Semantic chunking algorithm using LangChain.js.
 *
 * 1. Split text into sentences using LangChain's RecursiveCharacterTextSplitter
 * 2. Embed every sentence via LangChain's GoogleGenerativeAIEmbeddings (batched)
 * 3. Compute cosine similarity between adjacent sentence embeddings
 * 4. threshold = mean - (k * stddev)
 * 5. Breakpoints at indices where similarity < threshold
 * 6. Group sentences between breakpoints into chunks
 * 7. Secondary split chunks > 800 tokens; merge chunks < 50 tokens
 *
 * @param {string} text - Full document text
 * @returns {Promise<{ chunks: { text: string, tokenCount: number, startSentence: number, endSentence: number }[] }>}
 */
async function semanticChunk(text) {
  // Step 1: Split into sentences using LangChain
  const sentences = splitSentences(text);

  if (sentences.length === 0) {
    return { chunks: [] };
  }

  // If very few sentences, return as a single chunk
  if (sentences.length <= 3) {
    const chunkText = sentences.join(' ');
    return {
      chunks: [
        {
          text: chunkText,
          tokenCount: estimateTokens(chunkText),
          startSentence: 0,
          endSentence: sentences.length - 1,
        },
      ],
    };
  }

  // Step 2: Embed all sentences using LangChain's GoogleGenerativeAIEmbeddings
  const embeddingVectors = await embedBatch(sentences);

  // Step 3: Compute cosine similarities between adjacent sentences
  const similarities = [];
  for (let i = 0; i < embeddingVectors.length - 1; i++) {
    similarities.push(cosineSimilarity(embeddingVectors[i], embeddingVectors[i + 1]));
  }

  // Step 4: Compute threshold
  const { mean, stddev } = meanStddev(similarities);
  const threshold = mean - THRESHOLD_K * stddev;

  // Step 5: Find breakpoints — indices where similarity drops below threshold
  const breakpoints = [];
  for (let i = 0; i < similarities.length; i++) {
    if (similarities[i] < threshold) {
      breakpoints.push(i + 1); // breakpoint is between sentence i and i+1
    }
  }

  // Step 6: Group sentences between breakpoints
  let groups = [];
  let start = 0;
  for (const bp of breakpoints) {
    groups.push(sentences.slice(start, bp));
    start = bp;
  }
  groups.push(sentences.slice(start)); // last group

  // Step 7: Secondary split for chunks that are too large
  const splitGroups = [];
  for (const group of groups) {
    const groupText = group.join(' ');
    if (estimateTokens(groupText) > MAX_CHUNK_TOKENS) {
      splitGroups.push(...secondarySplit(group));
    } else {
      splitGroups.push(group);
    }
  }

  // Step 8: Merge small chunks
  const finalGroups = mergeSmallChunks(splitGroups);

  // Build chunk objects with sentence tracking
  let runningIdx = 0;
  const chunks = [];

  for (const group of finalGroups) {
    const chunkText = group.join(' ');
    const startSentence = runningIdx;
    const endSentence = runningIdx + group.length - 1;
    runningIdx += group.length;

    chunks.push({
      text: chunkText,
      tokenCount: estimateTokens(chunkText),
      startSentence,
      endSentence,
    });
  }

  return { chunks };
}

module.exports = { semanticChunk, splitSentences, estimateTokens };
