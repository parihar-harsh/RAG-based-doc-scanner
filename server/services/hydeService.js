const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const HYDE_MODEL = process.env.GEMINI_HYDE_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

/**
 * Generate a Hypothetical Document Embedding (HyDE) answer.
 *
 * Given a user's question, generate a hypothetical passage that would
 * answer the question. This hypothetical answer is then embedded and
 * used for retrieval instead of the original question — improving
 * semantic match with actual document passages.
 *
 * @param {string} question - The user's original question
 * @param {string} [documentContext] - Brief description of the document for context
 * @returns {Promise<string>} hypothetical answer text
 */
async function generateHypotheticalAnswer(question, documentContext = '') {
  const model = genAI.getGenerativeModel({ model: HYDE_MODEL });

  const prompt = `You are a document expert. Given the following question, write a short, factual passage (2-4 sentences) that would directly answer this question as if it were extracted from a real document.${
    documentContext ? `\n\nDocument context: ${documentContext}` : ''
  }

Question: ${question}

Write ONLY the hypothetical passage, nothing else. Do not preface with "The passage says" or similar. Just write the content as if it came from the document.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  return text.trim();
}

module.exports = { generateHypotheticalAnswer };
