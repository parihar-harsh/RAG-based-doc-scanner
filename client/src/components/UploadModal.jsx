import { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadDocument } from '../services/api';
import { useDoc } from '../context/DocContext';
import toast from 'react-hot-toast';

export default function UploadModal({ isOpen, onClose }) {
  const { selectedDoc, fetchDocuments, selectDocument } = useDoc();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 20MB.');
      return;
    }

    try {
      setUploading(true);
      setProgress(0);
      const result = await uploadDocument(
        file,
        (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
        selectedDoc?._id || null
      );
      toast.success(`"${file.name}" uploaded successfully!`);
      await fetchDocuments();
      if (result?.data?.sessionId) {
        await selectDocument(result.data.sessionId);
      }
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [fetchDocuments, onClose, selectDocument, selectedDoc?._id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload Document</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div
          {...getRootProps()}
          className={`modal-dropzone ${isDragActive ? 'modal-dropzone--active' : ''} ${uploading ? 'modal-dropzone--uploading' : ''}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="modal-uploading">
              <div className="modal-spinner" />
              <p>Uploading... {progress}%</p>
              <div className="modal-progress">
                <div className="modal-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="modal-drop-content">
              <div className="modal-drop-icon">
                {isDragActive ? '📥' : '📄'}
              </div>
              <p className="modal-drop-title">
                {isDragActive ? 'Drop it here!' : 'Drop file here or click to browse'}
              </p>
              <div className="modal-formats">
                <span>PDF</span>
                <span>DOCX</span>
                <span>TXT</span>
              </div>
              <p className="modal-drop-limit">Max 20MB</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
