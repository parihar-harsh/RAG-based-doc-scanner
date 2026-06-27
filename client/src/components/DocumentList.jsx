import { useDoc } from '../context/DocContext';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { FileText, LogOut, MessageSquarePlus, MoreHorizontal, Upload } from 'lucide-react';

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
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark"><FileText size={17} /></span>
          <div>
            <strong>DocChat AI</strong>
            <span>Document workspace</span>
          </div>
        </div>
        <button className="sidebar-new-btn" onClick={onNewSession} title="New session">
          <MessageSquarePlus size={17} />
        </button>
      </div>

      <div className="sidebar-section-label">Recent sessions</div>
      <div className="sidebar-list">
        {documents.length === 0 ? (
          <div className="sidebar-empty">
            <p>No sessions yet</p>
            <button className="sidebar-empty-btn" onClick={onUploadClick}>
              <Upload size={15} />
              Upload document
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
                  <span className="sidebar-item-icon"><FileText size={15} /></span>
                  <span className="sidebar-item-name">
                    {session.title || `Session ${documents.length - index}`}
                  </span>
                  {isReady && <span className="status-dot status-dot--ready" />}
                  {isError && <span className="status-dot status-dot--error" />}
                  {!isReady && !isError && <span className="status-dot status-dot--processing" />}
                  <button
                    type="button"
                    className="sidebar-item-delete"
                    onClick={(e) => handleDelete(e, session._id)}
                    title="Delete session"
                  >
                    <MoreHorizontal size={16} />
                  </button>
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
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  );
}
