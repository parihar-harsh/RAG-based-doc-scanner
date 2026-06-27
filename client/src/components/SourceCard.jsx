import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

export default function SourceCard({ source, sourceNumber }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`source-card ${expanded ? 'source-card--expanded' : ''}`}>
      <button
        className="source-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <FileText size={13} />
        <span className="source-card-label">
          {source.documentName && `${source.documentName} · `}
          Evidence {sourceNumber}
          {source.pageNumber != null && ` · Page ${source.pageNumber}`}
        </span>
        <span className="source-card-toggle">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {expanded && (
        <div className="source-card-body">
          <p className="source-card-text">{source.text}</p>
        </div>
      )}
    </div>
  );
}
