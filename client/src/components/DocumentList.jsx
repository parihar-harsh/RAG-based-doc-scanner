import { useEffect, useState } from 'react';
import { useDoc } from '../context/DocContext';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import {
  FileText,
  LogOut,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import RenameDialog from './RenameDialog';

export default function DocumentList({ onNewSession, onUploadClick, onSessionSelected }) {
  const { documents, selectedDoc, selectDocument, removeDocument, renameSession } = useDoc();
  const { user, logout } = useAuth();
  const { getDocumentStatus } = useSocket();
  const [query, setQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [sessionToRename, setSessionToRename] = useState(null);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const closeMenu = () => setOpenMenuId(null);
    window.document.addEventListener('click', closeMenu);
    return () => window.document.removeEventListener('click', closeMenu);
  }, [openMenuId]);

  const filteredSessions = documents.filter((session) =>
    (session.title || '').toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleDelete = async () => {
    if (!sessionToDelete) return;
    try {
      await removeDocument(sessionToDelete._id);
      toast.success('Session deleted.');
      setSessionToDelete(null);
    } catch {
      toast.error('Session could not be deleted.');
    }
  };

  const handleRename = async (title) => {
    if (!sessionToRename) return;
    try {
      await renameSession(sessionToRename._id, title);
      toast.success('Session renamed.');
      setSessionToRename(null);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Session could not be renamed.');
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark"><FileText size={17} /></span>
          <div>
            <strong>DoxChat AI</strong>
            <span>Document workspace</span>
          </div>
        </div>
        <button className="sidebar-new-btn" onClick={onNewSession} title="New session">
          <MessageSquarePlus size={17} />
        </button>
      </div>

      <div className="sidebar-section-label">Recent sessions</div>
      {documents.length > 0 && (
        <label className="sidebar-search">
          <Search size={14} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sessions"
            aria-label="Search sessions"
          />
        </label>
      )}
      <div className="sidebar-list">
        {documents.length === 0 ? (
          <div className="sidebar-empty">
            <p>No sessions yet</p>
            <button className="sidebar-empty-btn" onClick={onUploadClick}>
              <Upload size={15} />
              Upload document
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="sidebar-empty"><p>No matching sessions</p></div>
        ) : (
          filteredSessions.map((session, index) => {
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
                onClick={() => {
                  selectDocument(session._id);
                  onSessionSelected?.();
                }}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId((current) => current === session._id ? null : session._id);
                    }}
                    title="Session actions"
                    aria-haspopup="menu"
                    aria-expanded={openMenuId === session._id}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                {openMenuId === session._id && (
                  <div
                    className="session-menu"
                    role="menu"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSessionToRename(session);
                        setOpenMenuId(null);
                      }}
                    >
                      <Pencil size={14} /> Rename
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="is-danger"
                      onClick={() => {
                        setSessionToDelete(session);
                        setOpenMenuId(null);
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
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

      <RenameDialog
        session={sessionToRename}
        onSave={handleRename}
        onClose={() => setSessionToRename(null)}
      />
      <ConfirmDialog
        open={Boolean(sessionToDelete)}
        title="Delete this session?"
        description="All documents, conversations, and indexed content in this session will be permanently removed."
        confirmLabel="Delete session"
        danger
        onConfirm={handleDelete}
        onClose={() => setSessionToDelete(null)}
      />
    </div>
  );
}
