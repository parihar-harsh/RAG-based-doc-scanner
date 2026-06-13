import { useState, useRef, useEffect } from 'react';
import { useDoc } from '../context/DocContext';
import useSSE from '../hooks/useSSE';
import MessageBubble from './MessageBubble';
import { Spinner } from './Loader';
import { getSession } from '../services/api';

const PHASE_PROGRESS = {
  uploaded: 10,
  uploading: 10,
  parsing: 25,
  chunking: 55,
  embedding: 80,
  ready: 100,
  error: 100,
};

const PHASE_LABELS = {
  uploaded: 'Queued for processing',
  uploading: 'Uploading document',
  parsing: 'Parsing document',
  chunking: 'Building semantic chunks',
  embedding: 'Generating embeddings',
  ready: 'Ready to chat',
  error: 'Processing failed',
};

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
  const sessionDocuments = selectedDoc?.documents || [];
  const hasDocuments = sessionDocuments.length > 0;
  const hasError = sessionDocuments.some((doc) => doc.status === 'error') || selectedDoc?.status === 'error';
  const allReady = hasDocuments && sessionDocuments.every((doc) => doc.status === 'ready');
  const canChat = allReady && !hasError;
  const processingDocument =
    sessionDocuments.find((doc) => doc.status !== 'ready' && doc.status !== 'error') ||
    sessionDocuments.find((doc) => doc.status === 'error');
  const currentPhase = processingDocument?.phase || processingDocument?.status || selectedDoc?.status;
  const progressPercent = PHASE_PROGRESS[currentPhase] ?? 0;
  const statusLabel = selectedDoc
    ? canChat
      ? `${PHASE_LABELS.ready} • ${sessionDocuments.length} document${sessionDocuments.length === 1 ? '' : 's'} • ${selectedDoc.totalChunks || 0} chunks`
      : hasError
        ? PHASE_LABELS.error
        : hasDocuments
          ? PHASE_LABELS[currentPhase] || 'Processing documents'
          : 'Upload a document first'
    : '';
  const statusTitle = selectedDoc
    ? hasDocuments
      ? sessionDocuments.map((doc) => doc.originalName).join(', ')
      : selectedDoc.title || 'New session'
    : '';
  const statusName = selectedDoc
    ? hasDocuments
      ? sessionDocuments.length === 1
        ? sessionDocuments[0].originalName
        : `${sessionDocuments.length} documents in this session`
      : selectedDoc.title || 'New session'
    : '';

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
    if (!selectedDoc || canChat || hasError) return;

    let cancelled = false;
    const refreshSession = async () => {
      try {
        const res = await getSession(selectedDoc._id);
        if (!cancelled) setSelectedDoc(res.data);
      } catch (err) {
        console.error('Failed to refresh session status:', err);
      }
    };

    const intervalId = setInterval(refreshSession, 1500);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedDoc?._id, canChat, hasError, setSelectedDoc]);

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

        {!canChat && selectedDoc && messages.length === 0 && (
          <div className="chat-start">
            <div className="chat-processing-spinner" />
            <h1>Preparing your session</h1>
            <p>{statusName}</p>
            <span className="chat-start-status">
              {hasDocuments ? 'Chat unlocks automatically when processing finishes.' : 'Push doc first.'}
            </span>
          </div>
        )}

        {canChat && messages.length === 0 && (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">💬</div>
            <h2>Ask anything about this session</h2>
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
        {selectedDoc && (
          <div
            className={`chat-file-status ${canChat ? 'chat-file-status--ready' : ''} ${
              hasError ? 'chat-file-status--error' : ''
            }`}
            title={statusTitle}
          >
            <div className="chat-file-progress" style={{ '--progress': `${progressPercent}%` }}>
              {canChat ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : hasError ? (
                <span>!</span>
              ) : (
                <span>{progressPercent}%</span>
              )}
            </div>
            <div className="chat-file-info">
              <span className="chat-file-name">{statusName}</span>
              <span className="chat-file-meta">{statusLabel}</span>
            </div>
          </div>
        )}
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
            placeholder={canChat ? 'Ask a question...' : 'Push doc first'}
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
            ? 'AI can make mistakes. Responses are grounded in this session.'
            : 'Push doc first.'}
        </p>
      </div>
    </div>
  );
}
