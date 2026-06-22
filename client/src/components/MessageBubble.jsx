import Markdown from 'react-markdown';
import SourceCard from './SourceCard';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`msg-row ${isUser ? 'msg-row--user' : 'msg-row--assistant'}`}>
      <div className="msg-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="msg-body">
        <div className="msg-role">{isUser ? 'You' : 'Talk to My Doc'}</div>
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
