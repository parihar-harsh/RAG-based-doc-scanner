import { useState, useRef, useEffect } from 'react';
import { useDoc } from '../context/DocContext';
import useSSE from '../hooks/useSSE';
import MessageBubble from './MessageBubble';
import { Spinner } from './Loader';
import { getDocument } from '../services/api';

export default function ChatWindow({ onUploadClick }) {
  const {
    selectedDoc,
    messages,
    conversationId,
    setConversationId,
    setSelectedDoc,
    addMessage,
    updateLastMessage,
  } = useDoc();
  const { streamedText, sources, isStreaming, error, startStream, reset } = useSSE();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const canChat = selectedDoc?.status === 'ready';

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedText]);

  // Sync streamed text + sources
  useEffect(() => {
    if (streamedText && isStreaming) {
      updateLastMessage((msg) => ({ ...msg, content: streamedText, isStreaming: true }));
    }
  }, [streamedText, isStreaming, updateLastMessage]);

  // Sync sources when they arrive
  useEffect(() => {
    if (sources && sources.length > 0) {
      updateLastMessage((msg) => ({ ...msg, sources }));
    }
  }, [sources, updateLastMessage]);

  useEffect(() => {
    if (!isStreaming && streamedText) {
      updateLastMessage((msg) => ({ ...msg, isStreaming: false }));
      reset();
    }
  }, [isStreaming, streamedText, updateLastMessage, reset]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  useEffect(() => {
    if (!selectedDoc || selectedDoc.status === 'ready' || selectedDoc.status === 'error') return;

    let cancelled = false;
    const refreshDocument = async () => {
      try {
        const res = await getDocument(selectedDoc._id);
        if (!cancelled) setSelectedDoc(res.data);
      } catch (err) {
        console.error('Failed to refresh document status:', err);
      }
    };

    const intervalId = setInterval(refreshDocument, 1500);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedDoc?._id, selectedDoc?.status, setSelectedDoc]);

  const handleSend = async (question) => {
    const q = question || input.trim();
    if (!q || !canChat || isStreaming) return;

    setInput('');

    addMessage({ role: 'user', content: q });
    addMessage({ role: 'assistant', content: '', isStreaming: true, sources: [] });

    try {
      const result = await startStream(selectedDoc._id, q, conversationId);
      if (result?.conversationId) {
        setConversationId(result.conversationId);
      }
    } catch (err) {
      updateLastMessage((msg) => ({
        ...msg,
        content: `Error: ${err.message}`,
        isStreaming: false,
      }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      {selectedDoc && (
        <div className="chat-doc-header">
          <span className="chat-doc-name">{selectedDoc.originalName}</span>
          <span className="chat-doc-meta">
            {selectedDoc.status === 'ready' ? `${selectedDoc.totalChunks} chunks` : selectedDoc.status}
          </span>
        </div>
      )}

      {/* Messages area */}
      <div className="chat-messages">
        {!selectedDoc && messages.length === 0 && (
          <div className="chat-start">
            <div className="chat-start-icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M9 15h6" />
                <path d="M9 11h2" />
              </svg>
            </div>
            <h1>Upload a document to start</h1>
            <p>Chats are unlocked after your file is processed and indexed.</p>
            <button className="chat-start-upload" onClick={onUploadClick}>
              Upload document
            </button>
          </div>
        )}

        {selectedDoc?.status !== 'ready' && selectedDoc && messages.length === 0 && (
          <div className="chat-start">
            <div className="chat-processing-spinner" />
            <h1>Preparing your session</h1>
            <p>{selectedDoc.originalName}</p>
            <span className="chat-start-status">Chat unlocks automatically when processing finishes.</span>
          </div>
        )}

        {selectedDoc?.status === 'ready' && messages.length === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">💬</div>
            <h2>Ask anything about this document</h2>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {error && <div className="chat-error-msg">⚠️ {error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-wrapper">
        <div className="chat-input-box">
          <button
            className="chat-attach-btn"
            onClick={onUploadClick}
            title="Upload document"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={canChat ? 'Ask a question...' : 'Upload and process a document to chat'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!canChat || isStreaming}
          />
          <button
            className="chat-send"
            onClick={() => handleSend()}
            disabled={!input.trim() || !canChat || isStreaming}
          >
            {isStreaming ? (
              <Spinner size={18} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
        <p className="chat-disclaimer">
          {canChat
            ? 'AI can make mistakes. Responses are grounded in your document.'
            : 'Upload a document before asking questions.'}
        </p>
      </div>
    </div>
  );
}
