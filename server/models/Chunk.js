const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    startSentence: {
      type: Number,
      default: 0,
    },
    endSentence: {
      type: Number,
      default: 0,
    },
    pageNumber: {
      type: Number,
      default: null,
    },
    endPageNumber: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Text index for keyword-based search leg of hybrid search
chunkSchema.index({ text: 'text' });

// Compound index for fast per-document lookups
chunkSchema.index({ documentId: 1, chunkIndex: 1 });

module.exports = mongoose.model('Chunk', chunkSchema);
