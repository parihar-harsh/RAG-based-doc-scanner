import { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAuthToken } from '../services/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export default function useSocket(documentIds = []) {
  const socketRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [connected, setConnected] = useState(false);
  const [processingEvents, setProcessingEvents] = useState({});

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: {
        token: getAuthToken(),
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('processing:progress', (data) => {
      setStatus('processing');
      setPhase(data.phase || '');
      setProgress(data.progress || 0);

      setProcessingEvents((prev) => ({
        ...prev,
        [data.documentId]: {
          status: 'processing',
          phase: data.phase || '',
          progress: data.progress || 0,
          documentId: data.documentId,
        },
      }));
    });

    socket.on('processing:complete', (data) => {
      setStatus('ready');
      setPhase('ready');
      setProgress(100);

      setProcessingEvents((prev) => ({
        ...prev,
        [data.documentId]: {
          status: 'ready',
          phase: 'ready',
          progress: 100,
          documentId: data.documentId,
        },
      }));
    });

    socket.on('processing:error', (data) => {
      setStatus('error');
      setPhase('error');
      setProgress(100);

      setProcessingEvents((prev) => ({
        ...prev,
        [data.documentId]: {
          status: 'error',
          phase: 'error',
          progress: 100,
          documentId: data.documentId,
          error: data.error,
        },
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!connected || !socketRef.current) return;

    const uniqueIds = [...new Set(documentIds.filter(Boolean))];
    uniqueIds.forEach((documentId) => {
      socketRef.current.emit('join-document', documentId);
    });
  }, [connected, documentIds]);

  const getDocumentStatus = useCallback(
    (documentId) => {
      return processingEvents[documentId] || null;
    },
    [processingEvents]
  );

  return {
    socket: socketRef.current,
    connected,
    status,
    progress,
    phase,
    processingEvents,
    getDocumentStatus,
  };
}
