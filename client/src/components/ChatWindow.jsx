import { useState, useRef, useEffect } from 'react';
import { useDoc } from '../context/DocContext';
import useSSE from '../hooks/useSSE';
import MessageBubble from './MessageBubble';
import { Spinner } from './Loader';
import { deleteDocument, getSession, retryDocument } from '../services/api';
import toast from 'react-hot-toast';
import {
  FilePlus2,
  FileText,
  GitCompareArrows,
  ListChecks,
  Plus,
  RotateCcw,
  ScanText,
  Search,
  Send,
  Trash2,
} from 'lucide-react';

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
  chunking: 'Organizing document',
  embedding: 'Indexing document',
  ready: 'Ready to chat',
  error: 'Processing failed',
};

const MAX_QUESTION_LENGTH = 4000;
const QUICK_QUESTIONS = [
  { label: 'Summarize the key ideas', question: 'Summarize the key ideas in this session.', icon: ScanText },
  { label: 'Extract important details', question: 'Extract the most important facts, dates, and requirements.', icon: ListChecks },
  { label: 'Find a specific answer', question: 'What are the most important details I should look for?', icon: Search },
  { label: 'Compare the documents', question: 'Compare the uploaded documents and identify important differences.', icon: GitCompareArrows },
];

function toTime(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

function formatDocumentMeta(doc) {
  const pageCount = doc.metadata?.pageCount;
  if (Number.isFinite(pageCount) && pageCount > 0) {
    return `${pageCount} page${pageCount === 1 ? '' : 's'}`;
  }

  const fileSize = doc.fileSize;
  if (Number.isFinite(fileSize) && fileSize > 0) {
    if (fileSize < 1024 * 1024) {
      return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
    }
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }

  return '';
}

export default function ChatWindow({ onUploadClick }) {
  const {
    selectedDoc,
    messages,
    conversationId,
    setConversationId,
    setSelectedDoc,
    setMessages,
    fetchDocuments,
    addMessage,
    updateLastMessage,
  } = useDoc();
  const { streamedText, sources, isStreaming, error, startStream, reset } = useSSE();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const hasChatMessages = messages.some((msg) => msg.role === 'user' || msg.role === 'assistant');
  const sessionDocuments = selectedDoc?.documents || [];
  const displayedSessionDocuments = [...sessionDocuments].sort(
    (a, b) => (toTime(b.createdAt) || 0) - (toTime(a.createdAt) || 0)
  );
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
      ? `${PHASE_LABELS.ready} • ${sessionDocuments.length} document${sessionDocuments.length === 1 ? '' : 's'}`
      : hasError
        ? PHASE_LABELS.error
        : hasDocuments
          ? PHASE_LABELS[currentPhase] || 'Processing documents'
          : 'Upload a document first'
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
    const q = (typeof question === 'string' ? question : input).trim();
    if (!q || !canChat || isStreaming) return;

    if (q.length > MAX_QUESTION_LENGTH) {
      toast.error(`Question is too long. Maximum length is ${MAX_QUESTION_LENGTH} characters.`);
      return;
    }

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

  const shouldOpenUploadFromComposer = !canChat && !isStreaming && (!selectedDoc || !hasDocuments);

  const refreshSelectedSession = async () => {
    if (!selectedDoc?._id) return;

    try {
      const res = await getSession(selectedDoc._id);
      setSelectedDoc(res.data);
    } catch (err) {
      if (err?.response?.status === 404) {
        setSelectedDoc(null);
        setMessages([]);
        setConversationId(null);
      } else {
        throw err;
      }
    } finally {
      await fetchDocuments();
    }
  };

  const hasChatAfterDocumentUpload = (doc) => {
    const uploadedAt = toTime(doc.createdAt);
    if (!uploadedAt) return hasChatMessages;

    return messages.some((msg) => {
      if (msg.role !== 'user' && msg.role !== 'assistant') return false;

      const messageTime = toTime(msg.createdAt);
      if (!messageTime) return true;

      return messageTime >= uploadedAt;
    });
  };

  const isDocumentProcessing = (doc) => ['parsing', 'chunking', 'embedding'].includes(doc.status);
  const canShowDeleteDocument = (doc) => !hasChatAfterDocumentUpload(doc);

  const handleDeleteDocument = async (doc) => {
    if (hasChatAfterDocumentUpload(doc)) {
      toast.error('This document cannot be deleted after chat has started for it.');
      return;
    }

    const isProcessing = ['parsing', 'chunking', 'embedding'].includes(doc.status);
    if (isProcessing) {
      toast.error('Wait for processing to finish before deleting this document.');
      return;
    }

    if (!confirm(`Delete "${doc.originalName}" from this session?`)) return;

    try {
      await deleteDocument(doc._id);
      toast.success('Document deleted.');
      await refreshSelectedSession();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to delete document.');
    }
  };

  const handleRetryDocument = async (doc) => {
    try {
      await retryDocument(doc._id);
      toast.success('Document queued for retry.');
      await refreshSelectedSession();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to retry document.');
    }
  };

  const handleComposerClick = () => {
    if (shouldOpenUploadFromComposer) onUploadClick();
  };

  const handleComposerKeyDown = (e) => {
    if (!shouldOpenUploadFromComposer) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onUploadClick();
    }
  };

  return (
    <div className="chat-container">
      <header className="workspace-header">
        <div className="workspace-heading">
          <span className="workspace-eyebrow">Document workspace</span>
          <h1>{selectedDoc?.title || 'New research session'}</h1>
          <div className="workspace-meta">
            {selectedDoc ? (
              <>
                <span className={`workspace-status-dot ${canChat ? 'is-ready' : hasError ? 'is-error' : 'is-processing'}`} />
                <span>{statusLabel}</span>
              </>
            ) : (
              <span>Start by adding a source document</span>
            )}
          </div>
        </div>
        <button className="workspace-upload-btn" onClick={onUploadClick}>
          <FilePlus2 size={16} />
          Add document
        </button>
      </header>

      {selectedDoc && (
        <section className="workspace-document-rail" aria-label="Session documents">
          <button className="document-add-card" onClick={onUploadClick}>
            <span><Plus size={18} /></span>
            <strong>Add document</strong>
          </button>

          {displayedSessionDocuments.map((doc) => {
            const isReady = doc.status === 'ready';
            const isError = doc.status === 'error';
            const canShowDelete = canShowDeleteDocument(doc);
            const isProcessing = isDocumentProcessing(doc);
            const statusText = isReady
              ? formatDocumentMeta(doc)
              : isError
                ? 'Processing failed'
                : doc.status === 'uploaded'
                  ? 'Queued'
                  : doc.status;

            return (
              <article key={doc._id} className={`document-card ${isError ? 'document-card--error' : ''}`}>
                <div className="document-card-icon">
                  <FileText size={18} />
                </div>
                <div className="document-card-content">
                  <strong title={doc.originalName}>{doc.originalName}</strong>
                  <span className={isError ? 'is-error' : ''}>
                    <i className={`status-dot ${isReady ? 'status-dot--ready' : isError ? 'status-dot--error' : 'status-dot--processing'}`} />
                    {statusText}
                  </span>
                </div>
                {(isError || canShowDelete) && (
                  <div className="document-card-actions">
                    {isError && (
                      <button type="button" onClick={() => handleRetryDocument(doc)} title="Retry processing">
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {canShowDelete && (
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => handleDeleteDocument(doc)}
                        disabled={isProcessing}
                        title={isProcessing ? 'Wait for processing to finish' : 'Delete document'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* Messages area */}
      <div className="chat-messages">
        {!selectedDoc && messages.length === 0 && (
          <div className="chat-start">
            <div className="chat-start-visual">
              <span className="chat-start-sheet chat-start-sheet--back" />
              <span className="chat-start-sheet chat-start-sheet--front"><FileText size={34} /></span>
            </div>
            <span className="chat-start-kicker">Grounded document intelligence</span>
            <h1>Turn documents into clear answers</h1>
            <p>Upload research, reports, resumes, or notes and work directly from their contents.</p>
            <button className="chat-start-upload" onClick={onUploadClick}>
              <FilePlus2 size={17} />
              Choose a document
            </button>
          </div>
        )}

        {!canChat && selectedDoc && messages.length === 0 && (
          <div className="chat-start">
            <div className="chat-processing-spinner" />
            <span className="chat-start-kicker">Building your workspace</span>
            <h1>Indexing your documents</h1>
            <p>{statusName}</p>
            {hasDocuments && (
              <div className="processing-track" aria-label={statusLabel}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            )}
            <span className="chat-start-status">{hasDocuments ? statusLabel : 'Add a document to begin'}</span>
          </div>
        )}

        {canChat && messages.length === 0 && (
          <div className="chat-welcome">
            <span className="chat-start-kicker">Ready to explore</span>
            <h2>What would you like to understand?</h2>
            <div className="quick-question-grid">
              {QUICK_QUESTIONS.map(({ label, question, icon: Icon }) => (
                <button key={label} type="button" onClick={() => handleSend(question)}>
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
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
        <div
          className={`chat-input-box ${shouldOpenUploadFromComposer ? 'chat-input-box--upload-trigger' : ''}`}
          onClick={handleComposerClick}
          onKeyDown={handleComposerKeyDown}
          tabIndex={shouldOpenUploadFromComposer ? 0 : undefined}
          aria-label={shouldOpenUploadFromComposer ? 'Upload a document to start chatting' : undefined}
        >
          <button
            className="chat-attach-btn"
            onClick={onUploadClick}
            title="Upload document"
          >
            <Plus size={18} />
          </button>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={canChat ? 'Ask across your documents...' : 'Add a document to begin'}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_QUESTION_LENGTH}
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
              <Send size={17} />
            )}
          </button>
        </div>
        <p className="chat-disclaimer">
          {canChat
            ? 'Answers are grounded in the documents shown above.'
            : 'Add a document to unlock the workspace.'}
        </p>
      </div>
    </div>
  );
}
