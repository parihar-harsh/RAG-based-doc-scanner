const fs = require('fs/promises');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');

function getUploadStorageType() {
  const configured = (process.env.UPLOAD_STORAGE || '').toLowerCase();
  if (configured === 'gridfs' || configured === 'local') return configured;
  return process.env.NODE_ENV === 'production' ? 'gridfs' : 'local';
}

function getBucket() {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB is not connected.');
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function saveUploadedFile(file) {
  const storageType = getUploadStorageType();

  if (storageType === 'local') {
    return {
      storageType,
      storageKey: null,
      fileName: file.filename,
      filePath: file.path,
    };
  }

  const bucket = getBucket();
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${file.originalname}`;

  const gridFileId = await new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: file.mimetype,
      metadata: {
        originalName: file.originalname,
      },
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.end(file.buffer);
  });

  return {
    storageType,
    storageKey: gridFileId.toString(),
    fileName,
    filePath: null,
  };
}

async function readDocumentFile(doc) {
  if (doc.storageType === 'gridfs') {
    if (!doc.storageKey) throw new Error('Document file is missing from storage.');
    const stream = getBucket().openDownloadStream(new ObjectId(doc.storageKey));
    return streamToBuffer(stream);
  }

  if (!doc.filePath) throw new Error('Document file path is missing.');
  return fs.readFile(doc.filePath);
}

async function deleteDocumentFile(doc) {
  if (doc.storageType === 'gridfs') {
    if (!doc.storageKey) return;

    try {
      await getBucket().delete(new ObjectId(doc.storageKey));
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        console.warn('Could not delete GridFS file:', err.message);
      }
    }
    return;
  }

  if (!doc.filePath) return;

  try {
    await fs.unlink(doc.filePath);
  } catch (err) {
    console.warn('Could not delete file from disk:', err.message);
  }
}

module.exports = {
  getUploadStorageType,
  saveUploadedFile,
  readDocumentFile,
  deleteDocumentFile,
};
