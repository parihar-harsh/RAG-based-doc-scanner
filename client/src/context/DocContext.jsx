import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import {
  getSessions,
  getSession,
  listSessionConversations,
  getConversation,
  deleteSession as apiDeleteSession,
  updateSession as apiUpdateSession,
} from '../services/api';
import useDocumentProgress from '../hooks/useDocumentProgress';

const DocContext = createContext(null);
const ACTIVE_DOCUMENT_STATUSES = new Set(['uploaded', 'parsing', 'chunking', 'embedding', 'processing']);

function deriveSessionStatus(documents = []) {
  if (documents.some((doc) => doc.status === 'error')) return 'error';
  if (documents.length > 0 && documents.every((doc) => doc.status === 'ready')) return 'ready';
  return 'processing';
}

function progressStatus(payload) {
  if (payload.phase === 'ready' || payload.phase === 'error') return payload.phase;
  if (payload.phase) return payload.phase;
  return payload.status === 'ready' || payload.status === 'error' ? payload.status : 'processing';
}

function applyProgressToDocument(doc, payload) {
  if (doc._id !== payload.documentId) return doc;

  const nextStatus = progressStatus(payload);
  return {
    ...doc,
    status: nextStatus,
    phase: payload.phase || nextStatus,
    errorMessage:
      nextStatus === 'error'
        ? payload.error || payload.message || doc.errorMessage || 'Document processing failed.'
        : null,
  };
}

function applyProgressToSession(session, payload) {
  const sessionDocuments = session.documents || [];
  if (!sessionDocuments.some((doc) => doc._id === payload.documentId)) return session;

  const updatedDocuments = sessionDocuments.map((doc) => applyProgressToDocument(doc, payload));
  return {
    ...session,
    documents: updatedDocuments,
    status: deriveSessionStatus(updatedDocuments),
  };
}

export function DocProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSessions();
      setDocuments(res.data || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectDocument = useCallback(async (sessionId) => {
    try {
      const res = await getSession(sessionId);
      setSelectedDoc(res.data);
      setConversationId(null);
      setMessages([]);

      const conversationsRes = await listSessionConversations(sessionId);
      const latestConversation = conversationsRes.data?.[0];
      if (!latestConversation) return;

      const conversationRes = await getConversation(latestConversation._id);
      const conversation = conversationRes.data;
      setConversationId(conversation._id);
      setMessages(conversation.messages || []);
    } catch (err) {
      console.error('Failed to fetch document:', err);
    }
  }, []);

  const removeDocument = useCallback(async (sessionId) => {
    try {
      await apiDeleteSession(sessionId);
      setDocuments((prev) => prev.filter((d) => d._id !== sessionId));
      if (selectedDoc && selectedDoc._id === sessionId) {
        setSelectedDoc(null);
        setMessages([]);
        setConversationId(null);
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
      throw err;
    }
  }, [selectedDoc]);

  const renameSession = useCallback(async (sessionId, title) => {
    const res = await apiUpdateSession(sessionId, { title });
    const updated = res.data;
    setDocuments((prev) => prev.map((session) => (session._id === sessionId ? updated : session)));
    setSelectedDoc((prev) => (prev?._id === sessionId ? updated : prev));
    return updated;
  }, []);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastMessage = useCallback((updater) => {
    setMessages((prev) => {
      const copy = [...prev];
      if (copy.length > 0) {
        copy[copy.length - 1] = updater(copy[copy.length - 1]);
      }
      return copy;
    });
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const progressDocumentIds = useMemo(() => {
    const ids = new Set();
    const addActiveDocs = (session) => {
      (session?.documents || []).forEach((doc) => {
        if (ACTIVE_DOCUMENT_STATUSES.has(doc.status)) ids.add(doc._id);
      });
    };

    documents.forEach(addActiveDocs);
    addActiveDocs(selectedDoc);
    return [...ids];
  }, [documents, selectedDoc]);

  const handleDocumentProgress = useCallback((payload) => {
    if (!payload?.documentId) return;

    setDocuments((prev) => prev.map((session) => applyProgressToSession(session, payload)));
    setSelectedDoc((prev) => (prev ? applyProgressToSession(prev, payload) : prev));
  }, []);

  useDocumentProgress(progressDocumentIds, handleDocumentProgress);

  return (
    <DocContext.Provider
      value={{
        documents,
        selectedDoc,
        conversationId,
        messages,
        loading,
        setDocuments,
        setSelectedDoc,
        setConversationId,
        setMessages,
        fetchDocuments,
        selectDocument,
        removeDocument,
        renameSession,
        addMessage,
        updateLastMessage,
      }}
    >
      {children}
    </DocContext.Provider>
  );
}

export function useDoc() {
  const ctx = useContext(DocContext);
  if (!ctx) throw new Error('useDoc must be used within DocProvider');
  return ctx;
}
