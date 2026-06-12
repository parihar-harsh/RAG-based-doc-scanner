const { GoogleGenerativeAI } = require('@google/generative-ai');
const { embedText } = require('./embeddingService');
const { hybridSearch } = require('./searchService');
const { generateHypotheticalAnswer } = require('./hydeService');
const Conversation = require('../models/Conversation');
const Document = require('../models/Document');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
const CHAT_MODELS = [
  CHAT_MODEL,
  ...(process.env.GEMINI_CHAT_FALLBACK_MODELS || 'gemini-2.5-flash')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
].filter((model, index, models) => models.indexOf(model) === index);
const MEMORY_LIMIT = parseInt(process.env.CONVERSATION_MEMORY_LIMIT, 10) || 10;
const ENABLE_HYDE = process.env.ENABLE_HYDE !== 'false'; // default true
const ENABLE_HYBRID = process.env.ENABLE_HYBRID_SEARCH !== 'false'; // default true

const SYSTEM_PROMPT = `You are a helpful, accurate document assistant. Your role is to answer questions based ONLY on the provided document context.

IMPORTANT RULES:
1. Answer ONLY from the provided context chunks. Do not use outside knowledge.
2. If the context does not contain enough information to answer the question, say: "I don't have enough information in the document to answer this question."
3. If you are unsure, say so rather than guessing.
4. Cite the relevant parts of the context when answering.
5. Be concise but thorough. Use bullet points or numbered lists when appropriate.
6. If the question is ambiguous, ask for clarification.
7. NEVER fabricate information, quotes, or references that are not in the provided context.
8. If you partially know the answer from the context, state what you know and clearly note what information is missing.`;

/**
 * Build the messages array for the Gemini chat.
 *
 * @param {object} params
 * @param {string} params.question - User question
 * @param {{ text: string, score: number }[]} params.contextChunks - Retrieved chunks
 * @param {{ role: string, content: string }[]} params.memory - Past conversation messages
 * @param {string} params.documentName - Name of the document
 * @returns {{ systemInstruction: string, contents: object[] }}
 */
function buildPrompt({ question, contextChunks, memory, documentName }) {
  const contextText = contextChunks
    .map((c, i) => `[Chunk ${i + 1}] (relevance: ${c.score.toFixed(3)})\n${c.chunk.text}`)
    .join('\n\n---\n\n');

  const systemInstruction = `${SYSTEM_PROMPT}\n\nDocument: "${documentName}"\n\n--- DOCUMENT CONTEXT ---\n${contextText}\n--- END CONTEXT ---`;

  // Build contents array with conversation history
  const contents = [];

  for (const msg of memory) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  // Add current question
  contents.push({
    role: 'user',
    parts: [{ text: question }],
  });

  return { systemInstruction, contents };
}

/**
 * Full RAG pipeline with streaming.
 *
 * 1. Load conversation memory
 * 2. Optionally run HyDE
 * 3. Embed query (or HyDE result)
 * 4. Run hybrid search
 * 5. Build prompt with system message + memory + context + question
 * 6. Stream Gemini response
 *
 * @param {object} params
 * @param {string} params.documentId
 * @param {string} params.userId
 * @param {string} params.conversationId
 * @param {string} params.question
 * @param {function} params.onChunk - callback called with each text chunk
 * @param {function} [params.onDone] - callback called when generation is complete
 * @returns {Promise<string>} full generated answer
 */
async function chat({ documentId, userId, conversationId, question, onChunk, onDone }) {
  // 1. Load document info
  const document = await Document.findOne({ _id: documentId, userId }).lean();
  if (!document) throw new Error('Document not found');
  if (document.status !== 'ready') throw new Error('Document is still being processed');

  // 2. Load or create conversation
  let conversation;
  if (conversationId) {
    conversation = await Conversation.findOne({ _id: conversationId, documentId, userId });
    if (!conversation) throw new Error('Conversation not found');
  } else {
    conversation = new Conversation({
      userId,
      documentId,
      title: question.slice(0, 80),
    });
    await conversation.save();
  }

  // 3. Load memory (last N messages)
  const memory = conversation.messages.slice(-MEMORY_LIMIT * 2); // *2 because each exchange = user+assistant

  // 4. Optionally run HyDE
  let textToEmbed = question;
  if (ENABLE_HYDE) {
    try {
      const hydeAnswer = await generateHypotheticalAnswer(question, document.originalName);
      textToEmbed = hydeAnswer;
    } catch (err) {
      console.warn('HyDE failed, using original question:', err.message);
      // Fall back to original question
    }
  }

  // 5. Embed query
  const queryEmbedding = await embedText(textToEmbed);

  // 6. Run hybrid search
  const searchResults = await hybridSearch(documentId, question, queryEmbedding, {
    enableHybrid: ENABLE_HYBRID,
  });

  // 7. Build prompt
  const { systemInstruction, contents } = buildPrompt({
    question,
    contextChunks: searchResults,
    memory,
    documentName: document.originalName,
  });

  // 8. Call Gemini with streaming
  let fullResponse = '';
  let lastGenerationError = null;

  for (const modelName of CHAT_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      const result = await model.generateContentStream({ contents });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          fullResponse += text;
          if (onChunk) onChunk(text);
        }
      }

      lastGenerationError = null;
      break;
    } catch (err) {
      lastGenerationError = err;

      if (fullResponse || modelName === CHAT_MODELS[CHAT_MODELS.length - 1]) {
        throw err;
      }

      console.warn(`Chat model ${modelName} failed, trying fallback:`, err.message);
    }
  }

  if (lastGenerationError) {
    throw lastGenerationError;
  }

  // 9. Save messages to conversation
  conversation.messages.push({ role: 'user', content: question });
  conversation.messages.push({ role: 'assistant', content: fullResponse });
  await conversation.save();

  if (onDone) onDone(fullResponse);

  return {
    answer: fullResponse,
    conversationId: conversation._id.toString(),
    sources: searchResults.map((r) => ({
      text: r.chunk.text.slice(0, 300),
      score: parseFloat(r.score.toFixed(3)),
      chunkIndex: r.chunk.chunkIndex,
    })),
  };
}

module.exports = { chat };
