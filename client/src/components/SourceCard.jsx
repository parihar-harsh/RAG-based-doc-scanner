import { ArrowUpRight, FileText } from 'lucide-react';

export default function SourceCard({ source, sourceNumber, onOpen }) {
  return (
    <div className="source-card">
      <button
        className="source-card-header"
        onClick={() => onOpen?.(source)}
        title="Open citation evidence"
      >
        <FileText size={13} />
        <span className="source-card-label">
          {source.documentName && `${source.documentName} · `}
          Evidence {sourceNumber}
          {source.pageNumber != null && ` · Page ${source.pageNumber}`}
        </span>
        <span className="source-card-toggle"><ArrowUpRight size={14} /></span>
      </button>
    </div>
  );
}
