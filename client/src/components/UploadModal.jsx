import { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadDocument } from '../services/api';
import { useDoc } from '../context/DocContext';
import toast from 'react-hot-toast';
import { FileText, UploadCloud, X } from 'lucide-react';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const ACCEPTED_EXTENSIONS = new Set(['pdf', 'docx', 'txt']);

function getFileExtension(fileName = '') {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

function isAcceptedFile(file) {
  return ACCEPTED_MIME_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.has(getFileExtension(file.name));
}

function getRejectionMessage(rejection) {
  const firstError = rejection?.errors?.[0];
  if (firstError?.code === 'file-too-large') return 'File too large. Maximum size is 20MB.';
  if (firstError?.code === 'file-invalid-type') return 'Unsupported file type. Upload PDF, DOCX, or TXT.';
  if (firstError?.message) return firstError.message;
  return 'File could not be uploaded.';
}

export default function UploadModal({ isOpen, onClose }) {
  const { selectedDoc, fetchDocuments, selectDocument } = useDoc();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles, fileRejections) => {
    if (fileRejections.length > 0) {
      toast.error(getRejectionMessage(fileRejections[0]));
      return;
    }

    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    if (!isAcceptedFile(file)) {
      toast.error('Unsupported file type. Upload PDF, DOCX, or TXT.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
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
    maxSize: MAX_FILE_SIZE,
    disabled: uploading,
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={uploading ? undefined : onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Add a document</h2>
            <p>PDF, DOCX, or TXT up to 20 MB</p>
          </div>
          <button className="modal-close" onClick={onClose} disabled={uploading} title="Close">
            <X size={18} />
          </button>
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
                {isDragActive ? <UploadCloud size={30} /> : <FileText size={30} />}
              </div>
              <p className="modal-drop-title">
                {isDragActive ? 'Drop to upload' : 'Drag a file here'}
              </p>
              <p className="modal-drop-browse">or click to browse your files</p>
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
