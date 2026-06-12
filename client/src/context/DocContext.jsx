import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getDocuments, getDocument, deleteDocument as apiDeleteDoc } from '../services/api';

const DocContext = createContext(null);

export function DocProvider({ children }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getDocuments();
      setDocuments(res.data || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectDocument = useCallback(async (docId) => {
    try {
      const res = await getDocument(docId);
      setSelectedDoc(res.data);
      setConversationId(null);
      setMessages([]);
    } catch (err) {
      console.error('Failed to fetch document:', err);
    }
  }, []);

  const removeDocument = useCallback(async (docId) => {
    try {
      await apiDeleteDoc(docId);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      if (selectedDoc && selectedDoc._id === docId) {
        setSelectedDoc(null);
        setMessages([]);
        setConversationId(null);
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  }, [selectedDoc]);

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
