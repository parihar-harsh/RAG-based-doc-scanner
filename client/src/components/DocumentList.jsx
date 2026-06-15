import { useDoc } from '../context/DocContext';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';

export default function DocumentList({ onNewSession, onUploadClick }) {
  const { documents, selectedDoc, selectDocument, removeDocument } = useDoc();
  const { user, logout } = useAuth();
  const { getDocumentStatus } = useSocket();

  const handleDelete = async (e, docId) => {
    e.stopPropagation();
    if (confirm('Delete this session and all of its documents?')) {
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
            <button className="sidebar-empty-btn" onClick={onUploadClick}>
              Start with upload
            </button>
          </div>
        ) : (
          documents.map((session, index) => {
            const isSelected = selectedDoc?._id === session._id;
            const sessionDocuments = session.documents || [];
            const statuses = sessionDocuments.map((doc) => {
              const socketStatus = getDocumentStatus(doc._id);
              return socketStatus?.status || doc.status;
            });
            const isReady = statuses.length > 0 && statuses.every((status) => status === 'ready');
            const isError = statuses.some((status) => status === 'error') || session.status === 'error';

            return (
              <div
                key={session._id}
                className={`sidebar-item ${isSelected ? 'sidebar-item--active' : ''}`}
                onClick={() => selectDocument(session._id)}
              >
                <div className="sidebar-item-row">
                  <span className="sidebar-item-icon">💬</span>
                  <span className="sidebar-item-name">
                    {session.title || `Session ${documents.length - index}`}
                  </span>
                  {isReady && <span className="status-dot status-dot--ready" />}
                  {isError && <span className="status-dot status-dot--error" />}
                  {!isReady && !isError && <span className="status-dot status-dot--processing" />}
                  <span
                    className="sidebar-item-delete"
                    onClick={(e) => handleDelete(e, session._id)}
                    title="Delete"
                  >
                    ×
                  </span>
                </div>
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
