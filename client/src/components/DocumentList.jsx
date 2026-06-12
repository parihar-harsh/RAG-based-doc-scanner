import { useDoc } from '../context/DocContext';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';

const PHASE_PROGRESS = {
  'uploading': 10,
  'parsing': 25,
  'chunking': 50,
  'embedding': 75,
  'ready': 100,
  'error': 100,
};

const PHASE_LABELS = {
  'uploading': 'Uploading...',
  'parsing': 'Parsing document...',
  'chunking': 'Semantic chunking...',
  'embedding': 'Generating embeddings...',
  'ready': 'Ready',
  'error': 'Failed',
};

function DocProgressBar({ phase, status }) {
  const currentPhase = phase || status;
  const percent = PHASE_PROGRESS[currentPhase] || 0;
  const label = PHASE_LABELS[currentPhase] || currentPhase;
  const isError = status === 'error' || currentPhase === 'error';
  const isReady = status === 'ready' || currentPhase === 'ready';

  if (isReady) return null;

  return (
    <div className="doc-progress">
      <div className="doc-progress-bar">
        <div
          className={`doc-progress-fill ${isError ? 'doc-progress-fill--error' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`doc-progress-label ${isError ? 'doc-progress-label--error' : ''}`}>
        {label}
      </span>
    </div>
  );
}

export default function DocumentList({ onNewSession }) {
  const { documents, selectedDoc, selectDocument, removeDocument } = useDoc();
  const { user, logout } = useAuth();
  const { getDocumentStatus } = useSocket();

  const handleDelete = async (e, docId) => {
    e.stopPropagation();
    if (confirm('Delete this session?')) {
      await removeDocument(docId);
      toast.success('Session deleted.');
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Sessions</span>
        <button className="sidebar-new-btn" onClick={onNewSession} title="New session">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      </div>

      <div className="sidebar-list">
        {documents.length === 0 ? (
          <div className="sidebar-empty">
            <p>No sessions yet</p>
            <button className="sidebar-empty-btn" onClick={onNewSession}>
              Start with upload
            </button>
          </div>
        ) : (
          documents.map((doc, index) => {
            const isSelected = selectedDoc?._id === doc._id;
            const socketStatus = getDocumentStatus(doc._id);
            const currentStatus = socketStatus?.status || doc.status;
            const currentPhase = socketStatus?.phase || currentStatus;
            const isReady = currentStatus === 'ready';
            const isError = currentStatus === 'error';

            return (
              <div
                key={doc._id}
                className={`sidebar-item ${isSelected ? 'sidebar-item--active' : ''}`}
                onClick={() => selectDocument(doc._id)}
              >
                <div className="sidebar-item-row">
                  <span className="sidebar-item-icon">💬</span>
                  <span className="sidebar-item-name">Session {documents.length - index}</span>
                  {isReady && <span className="status-dot status-dot--ready" />}
                  {isError && <span className="status-dot status-dot--error" />}
                  {!isReady && !isError && <span className="status-dot status-dot--processing" />}
                  <span
                    className="sidebar-item-delete"
                    onClick={(e) => handleDelete(e, doc._id)}
                    title="Delete"
                  >
                    ×
                  </span>
                </div>

                <DocProgressBar phase={currentPhase} status={currentStatus} />
              </div>
            );
          })
        )}
      </div>

      <div className="sidebar-user">
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">{user?.name}</span>
          <span className="sidebar-user-email">{user?.email}</span>
        </div>
        <button className="sidebar-logout" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}
