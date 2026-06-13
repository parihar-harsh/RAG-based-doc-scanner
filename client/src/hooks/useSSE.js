import { useState, useCallback, useRef } from 'react';
import { getAuthToken } from '../services/api';

export default function useSSE() {
  const [streamedText, setStreamedText] = useState('');
  const [sources, setSources] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const startStream = useCallback(async (sessionId, question, conversationId) => {
    setStreamedText('');
    setSources([]);
    setError(null);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/chat/sessions/${sessionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
          },
          body: JSON.stringify({ question, conversationId }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let finalSources = [];
      let finalConversationId = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            switch (parsed.type) {
              case 'token':
                fullText += parsed.content;
                setStreamedText(fullText);
                break;
              case 'sources':
                finalSources = parsed.sources || [];
                setSources(parsed.sources || []);
                break;
              case 'done':
                finalConversationId = parsed.conversationId || null;
                setIsStreaming(false);
                break;
              case 'error':
                setError(parsed.message || 'Stream error');
                setIsStreaming(false);
                break;
              default:
                break;
            }
          } catch {
            // Non-JSON SSE line — might be a plain token
            if (data !== '[DONE]') {
              fullText += data;
              setStreamedText(fullText);
            }
          }
        }
      }

      setIsStreaming(false);
      return {
        text: fullText,
        sources: finalSources,
        conversationId: finalConversationId,
      };
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setIsStreaming(false);
      }
      throw err;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setStreamedText('');
    setSources([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    streamedText,
    sources,
    isStreaming,
    error,
    startStream,
    stopStream,
    reset,
  };
}
