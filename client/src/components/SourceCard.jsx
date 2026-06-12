import { useState } from 'react';

export default function SourceCard({ source }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`source-card ${expanded ? 'source-card--expanded' : ''}`}>
      <button
        className="source-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="source-card-label">
          Chunk #{source.chunkIndex + 1}
          {source.pageNumber != null && ` · Page ${source.pageNumber}`}
        </span>
        <span className="source-card-toggle">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="source-card-body">
          <p className="source-card-text">{source.text}</p>
        </div>
      )}
    </div>
  );
}
