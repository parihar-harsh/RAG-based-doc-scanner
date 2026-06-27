import Markdown from 'react-markdown';
import SourceCard from './SourceCard';
import {
  Check,
  Copy,
  Download,
  Minimize2,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { useState } from 'react';

export default function MessageBubble({
  message,
  messageIndex,
  onOpenSource,
  onRegenerate,
  onTransform,
  onExport,
}) {
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
            DoxChat analysis
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
            <button type="button" onClick={() => onRegenerate?.(messageIndex)} title="Regenerate answer">
              <RefreshCw size={14} /> Regenerate
            </button>
            <button
              type="button"
              onClick={() => onTransform?.('Rewrite your previous answer more concisely.', messageIndex)}
              title="Make answer shorter"
            >
              <Minimize2 size={14} /> Shorter
            </button>
            <button
              type="button"
              onClick={() => onTransform?.('Explain your previous answer in simple language.', messageIndex)}
              title="Explain simply"
            >
              <WandSparkles size={14} /> Explain simply
            </button>
            <button type="button" onClick={() => onExport?.(messageIndex)} title="Export answer">
              <Download size={14} /> Export
            </button>
          </div>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="msg-sources">
            {message.sources.map((src, i) => (
              <SourceCard
                key={`${src.documentId || src.documentName}-${src.chunkIndex ?? i}`}
                source={src}
                sourceNumber={i + 1}
                onOpen={onOpenSource}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
