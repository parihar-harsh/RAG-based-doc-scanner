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
    <div className="app-layout">
      {/* Mobile toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <aside className={`app-sidebar ${sidebarOpen ? 'app-sidebar--open' : ''}`}>
        <DocumentList onNewSession={handleNewSession} />
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
