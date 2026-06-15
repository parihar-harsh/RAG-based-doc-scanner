import { useState } from 'react';
import DocumentList from '../components/DocumentList';
import ChatWindow from '../components/ChatWindow';
import UploadModal from '../components/UploadModal';
import { useDoc } from '../context/DocContext';

export default function ChatPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { setSelectedDoc, setMessages, setConversationId } = useDoc();

  const handleNewSession = () => {
    setSelectedDoc(null);
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div className={`app-layout ${sidebarOpen ? '' : 'app-layout--sidebar-collapsed'}`}>
      <button
        className={`sidebar-toggle ${sidebarOpen ? 'sidebar-toggle--open' : 'sidebar-toggle--closed'}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <aside className={`app-sidebar ${sidebarOpen ? 'app-sidebar--open' : ''}`}>
        <DocumentList onNewSession={handleNewSession} onUploadClick={() => setShowUpload(true)} />
      </aside>

      {/* Main chat */}
      <main className="app-main">
        <ChatWindow onUploadClick={() => setShowUpload(true)} />
      </main>

      {/* Upload modal */}
      <UploadModal isOpen={showUpload} onClose={() => setShowUpload(false)} />
    </div>
  );
}
