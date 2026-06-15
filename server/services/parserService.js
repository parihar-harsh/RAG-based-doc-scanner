const fs = require('fs/promises');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text from a file based on its extension.
 * @param {string} filePath - Absolute path to the file.
 * @returns {Promise<{ text: string, pageCount?: number }>}
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  return extractTextFromBuffer(buffer, filePath);
}

async function extractTextFromBuffer(buffer, fileName) {
  const ext = path.extname(fileName).toLowerCase();

  switch (ext) {
    case '.pdf':
      return extractPDF(buffer);
    case '.docx':
      return extractDOCX(buffer);
    case '.txt':
      return extractTXT(buffer);
    default:
      throw new Error(`Unsupported file extension: ${ext}`);
  }
}

/**
 * Extract text from a PDF file.
 */
async function extractPDF(buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const data = await parser.getText();
    return {
      text: data.text || '',
      pageCount: data.total || 0,
    };
  } finally {
    await parser.destroy();
  }
}

/**
 * Extract text from a DOCX file.
 */
async function extractDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value || '',
  };
}

/**
 * Read text from a plain text file.
 */
async function extractTXT(buffer) {
  return { text: buffer.toString('utf-8') };
}

module.exports = { extractText, extractTextFromBuffer };
