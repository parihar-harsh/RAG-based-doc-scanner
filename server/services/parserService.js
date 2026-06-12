const fs = require('fs/promises');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text from a file based on its extension.
 * @param {string} filePath - Absolute path to the file.
 * @returns {Promise<{ text: string, pageCount?: number }>}
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return extractPDF(filePath);
    case '.docx':
      return extractDOCX(filePath);
    case '.txt':
      return extractTXT(filePath);
    default:
      throw new Error(`Unsupported file extension: ${ext}`);
  }
}

/**
 * Extract text from a PDF file.
 */
async function extractPDF(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return {
    text: data.text || '',
    pageCount: data.numpages || 0,
  };
}

/**
 * Extract text from a DOCX file.
 */
async function extractDOCX(filePath) {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value || '',
  };
}

/**
 * Read text from a plain text file.
 */
async function extractTXT(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  return { text };
}

module.exports = { extractText };
