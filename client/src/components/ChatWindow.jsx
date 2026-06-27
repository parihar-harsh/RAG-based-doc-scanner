import { useState, useRef, useEffect } from 'react';
import { useDoc } from '../context/DocContext';
import useSSE from '../hooks/useSSE';
import MessageBubble from './MessageBubble';
import { Spinner } from './Loader';
import { deleteDocument, getSession, retryDocument } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import InsightPanel from './InsightPanel';
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
  const [scopeMode, setScopeMode] = useState('all');
  const [scopedDocumentId, setScopedDocumentId] = useState('');
  const [panelSource, setPanelSource] = useState(null);
  const [panelDocument, setPanelDocument] = useState(null);
  const [documentToDelete, setDocumentToDelete] = useState(null);
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
  const readyDocuments = sessionDocuments.filter((doc) => doc.status === 'ready');
  const selectedDocumentReady = readyDocuments.some((doc) => doc._id === scopedDocumentId);
  const canChat = scopeMode === 'single'
    ? selectedDocumentReady
    : scopeMode === 'compare'
      ? readyDocuments.length >= 2
      : allReady && !hasError;
  const processingDocument =
    sessionDocuments.find((doc) => doc.status !== 'ready' && doc.status !== 'error') ||
    sessionDocuments.find((doc) => doc.status === 'error');
  const currentPhase = processingDocument?.phase || processingDocument?.status || selectedDoc?.status;
  const progressPercent = PHASE_PROGRESS[currentPhase] ?? 0;
  const statusLabel = selectedDoc
    ? allReady
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
  const scopedDocumentIds = scopeMode === 'single' && scopedDocumentId
    ? [scopedDocumentId]
    : scopeMode === 'compare'
      ? readyDocuments.map((doc) => doc._id)
      : undefined;

  useEffect(() => {
    setScopeMode('all');
    setScopedDocumentId('');
    setPanelSource(null);
    setPanelDocument(null);
  }, [selectedDoc?._id]);

  useEffect(() => {
    if (scopeMode !== 'single') return;
    const selectedStillExists = readyDocuments.some((doc) => doc._id === scopedDocumentId);
    if (!selectedStillExists) setScopedDocumentId(readyDocuments[0]?._id || '');
  }, [scopeMode, scopedDocumentId, readyDocuments]);

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
    if (!selectedDoc || allReady || hasError) return;

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
  }, [selectedDoc?._id, allReady, hasError, setSelectedDoc]);

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
      const result = await startStream(selectedDoc._id, q, conversationId, {
        documentIds: scopedDocumentIds,
      });
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

  const requestDeleteDocument = (doc) => {
    if (hasChatAfterDocumentUpload(doc)) {
      toast.error('This document cannot be deleted after chat has started for it.');
      return;
    }

    const isProcessing = ['parsing', 'chunking', 'embedding'].includes(doc.status);
    if (isProcessing) {
      toast.error('Wait for processing to finish before deleting this document.');
      return;
    }

    setDocumentToDelete(doc);
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;
    try {
      await deleteDocument(documentToDelete._id);
      toast.success('Document deleted.');
      setDocumentToDelete(null);
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

  const handleRegenerate = (messageIndex) => {
    for (let index = messageIndex - 1; index >= 0; index -= 1) {
      if (messages[index].role === 'user') {
        handleSend(messages[index].content);
        return;
      }
    }
  };

  const handleTransform = (instruction) => {
    handleSend(instruction);
  };

  const handleExport = (messageIndex) => {
    const answer = messages[messageIndex];
    if (!answer?.content) return;

    const previousQuestion = [...messages.slice(0, messageIndex)]
      .reverse()
      .find((message) => message.role === 'user');
    const markdown = [
      `# ${selectedDoc?.title || 'DoxChat AI answer'}`,
      previousQuestion?.content ? `## Question\n\n${previousQuestion.content}` : '',
      `## Answer\n\n${answer.content}`,
    ].filter(Boolean).join('\n\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${(selectedDoc?.title || 'doxchat-answer').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openSource = (source) => {
    setPanelDocument(null);
    setPanelSource(source);
  };

  const openDocument = (doc) => {
    if (doc.status !== 'ready') return;
    setPanelSource(null);
    setPanelDocument(doc);
  };

  const closePanel = () => {
    setPanelSource(null);
    setPanelDocument(null);
  };

  return (
    <div className={`chat-container ${panelSource || panelDocument ? 'chat-container--panel-open' : ''}`}>
      <div className="chat-workspace">
      <header className="workspace-header">
        <div className="workspace-heading">
          <span className="workspace-eyebrow">Document workspace</span>
          <h1>{selectedDoc?.title || 'New research session'}</h1>
          <div className="workspace-meta" role="status" aria-live="polite">
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
              <article
                key={doc._id}
                className={`document-card ${isError ? 'document-card--error' : ''} ${isReady ? 'is-clickable' : ''}`}
                role={isReady ? 'button' : undefined}
                tabIndex={isReady ? 0 : undefined}
                onClick={() => openDocument(doc)}
                onKeyDown={(event) => {
                  if (isReady && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openDocument(doc);
                  }
                }}
                aria-label={isReady ? `Preview ${doc.originalName}` : undefined}
              >
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
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRetryDocument(doc);
                        }}
                        title="Retry processing"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {canShowDelete && (
                      <button
                        type="button"
                        className="is-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          requestDeleteDocument(doc);
                        }}
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
            {hasDocuments && (
              <div className="processing-stage-list" aria-label="Document processing stages">
                {['parsing', 'chunking', 'embedding', 'ready'].map((phase) => (
                  <span
                    key={phase}
                    className={PHASE_PROGRESS[phase] <= progressPercent ? 'is-complete' : ''}
                  >
                    <i />
                    {phase === 'ready' ? 'Ready' : PHASE_LABELS[phase]}
                  </span>
                ))}
              </div>
            )}
            {hasError && processingDocument?.errorMessage && (
              <p className="processing-error">{processingDocument.errorMessage}</p>
            )}
            {hasError && processingDocument && (
              <button
                type="button"
                className="processing-retry"
                onClick={() => handleRetryDocument(processingDocument)}
              >
                <RotateCcw size={15} /> Retry processing
              </button>
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
                <button
                  key={label}
                  type="button"
                  onClick={() => handleSend(question)}
                  disabled={label === 'Compare the documents' && readyDocuments.length < 2}
                  title={label === 'Compare the documents' && readyDocuments.length < 2
                    ? 'Add at least two documents to compare'
                    : undefined}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg._id || `${msg.role}-${i}`}
            message={msg}
            messageIndex={i}
            onOpenSource={openSource}
            onRegenerate={handleRegenerate}
            onTransform={handleTransform}
            onExport={handleExport}
          />
        ))}

        {error && <div className="chat-error-msg" role="alert">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="chat-input-wrapper">
        {readyDocuments.length > 0 && (
          <div className="composer-toolbar">
            <div className="scope-segments" role="group" aria-label="Document scope">
              <button
                type="button"
                className={scopeMode === 'all' ? 'is-active' : ''}
                onClick={() => setScopeMode('all')}
              >
                All documents
              </button>
              <button
                type="button"
                className={scopeMode === 'single' ? 'is-active' : ''}
                onClick={() => {
                  setScopeMode('single');
                  setScopedDocumentId((current) => current || readyDocuments[0]?._id || '');
                }}
              >
                Selected
              </button>
              <button
                type="button"
                className={scopeMode === 'compare' ? 'is-active' : ''}
                onClick={() => setScopeMode('compare')}
                disabled={readyDocuments.length < 2}
              >
                Compare
              </button>
            </div>
            {scopeMode === 'single' && (
              <select
                className="scope-document-select"
                value={scopedDocumentId}
                onChange={(event) => setScopedDocumentId(event.target.value)}
                aria-label="Select document for this question"
              >
                {readyDocuments.map((doc) => (
                  <option key={doc._id} value={doc._id}>{doc.originalName}</option>
                ))}
              </select>
            )}
          </div>
        )}
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
            ? scopeMode === 'single'
              ? 'Answering from the selected document only.'
              : scopeMode === 'compare'
                ? `Comparing ${readyDocuments.length} documents.`
                : 'Answers are grounded in all documents shown above.'
            : 'Add a document to unlock the workspace.'}
        </p>
      </div>
      </div>

      {(panelSource || panelDocument) && (
        <>
          <button
            type="button"
            className="insight-panel-backdrop"
            onClick={closePanel}
            aria-label="Close preview panel"
          />
          <InsightPanel
            source={panelSource}
            document={panelDocument}
            documents={sessionDocuments}
            onClose={closePanel}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(documentToDelete)}
        title="Delete this document?"
        description={`"${documentToDelete?.originalName || ''}" and its indexed content will be permanently removed.`}
        confirmLabel="Delete document"
        danger
        onConfirm={handleDeleteDocument}
        onClose={() => setDocumentToDelete(null)}
      />
    </div>
  );
}
