import { useEffect } from 'react';
import { getAuthToken } from '../services/api';

function parseSseEvent(eventText) {
  const data = eventText
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();

  if (!data) return null;
  return JSON.parse(data);
}

async function consumeProgressStream(documentId, signal, onProgress) {
  const token = getAuthToken();
  if (!token) return;

  const response = await fetch(
    `${import.meta.env.VITE_API_URL || '/api'}/documents/${documentId}/progress`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal,
    }
  );

  if (!response.ok || !response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const eventText of events) {
      try {
        const payload = parseSseEvent(eventText);
        if (payload) onProgress(payload);
      } catch {
        // Ignore malformed stream frames and keep the progress connection alive.
      }
    }
  }
}

export default function useDocumentProgress(documentIds = [], onProgress) {
  const documentKey = [...new Set(documentIds.filter(Boolean))].sort().join('|');

  useEffect(() => {
    const uniqueIds = documentKey ? documentKey.split('|') : [];
    if (uniqueIds.length === 0) return undefined;

    const controllers = uniqueIds.map((documentId) => {
      const controller = new AbortController();
      consumeProgressStream(documentId, controller.signal, onProgress).catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Document progress stream failed:', err.message);
        }
      });
      return controller;
    });

    return () => {
      controllers.forEach((controller) => controller.abort());
    };
  }, [documentKey, onProgress]);
}
