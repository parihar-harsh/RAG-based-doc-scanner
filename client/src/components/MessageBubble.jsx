import Markdown from 'react-markdown';
import SourceCard from './SourceCard';
import { Check, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const copyAnswer = async () => {
    if (!message.content) return;
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`msg-row ${isUser ? 'msg-row--user' : 'msg-row--assistant'}`}>
      <div className="msg-body">
        {!isUser && (
          <div className="msg-role">
            <Sparkles size={14} />
            DocChat analysis
          </div>
        )}
        <div className="msg-content">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="msg-markdown">
              <Markdown>{message.content || (message.isStreaming ? '...' : '')}</Markdown>
            </div>
          )}
          {message.isStreaming && <span className="msg-cursor">▊</span>}
        </div>

        {!isUser && !message.isStreaming && message.content && (
          <div className="msg-actions">
            <button type="button" onClick={copyAnswer} title="Copy answer">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="msg-sources">
            {message.sources.map((src, i) => (
              <SourceCard key={i} source={src} sourceNumber={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
