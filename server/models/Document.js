const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    storageType: {
      type: String,
      enum: ['local', 'gridfs'],
      default: 'local',
      index: true,
    },
    storageKey: {
      type: String,
      default: null,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    filePath: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['uploaded', 'parsing', 'chunking', 'embedding', 'ready', 'error'],
      default: 'uploaded',
    },
    errorMessage: {
      type: String,
      default: null,
    },
    totalChunks: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    suggestedQuestions: {
      type: [String],
      default: [],
    },
    metadata: {
      pageCount: Number,
      wordCount: Number,
      extractedTextLength: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Document', documentSchema);
