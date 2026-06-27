import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, LoaderCircle, X } from 'lucide-react';
import { getDocumentFile, getDocumentPreview } from '../services/api';

function pageLabel(source) {
  if (!source?.pageNumber) return 'Page unavailable';
  if (source.endPageNumber && source.endPageNumber !== source.pageNumber) {
    return `Pages ${source.pageNumber}-${source.endPageNumber}`;
  }
  return `Page ${source.pageNumber}`;
}

export default function InsightPanel({ source, document: selectedDocument, documents, onClose }) {
  const document = useMemo(() => {
    if (selectedDocument) return selectedDocument;
    if (source?.documentId) return documents.find((doc) => doc._id === source.documentId);
    return documents.find((doc) => doc.originalName === source?.documentName);
  }, [selectedDocument, source, documents]);
  const [preview, setPreview] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!document?._id) return undefined;
    let cancelled = false;
    let objectUrl = '';

    const loadPreview = async () => {
      setLoading(true);
      setError('');
      setPreview(null);
      setFileUrl('');

      try {
        const previewResponse = await getDocumentPreview(document._id);
        if (cancelled) return;
        setPreview(previewResponse.data);

        if (document.mimeType === 'application/pdf') {
          const blob = await getDocumentFile(document._id);
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setFileUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || 'Preview could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document?._id, document?.mimeType]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.document.addEventListener('keydown', handleKeyDown);
    return () => window.document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const downloadFile = async () => {
    if (!document?._id) return;
    const blob = await getDocumentFile(document._id);
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.originalName;
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!document) return null;

  const pdfUrl = fileUrl
    ? `${fileUrl}#page=${source?.pageNumber || 1}&view=FitH`
    : '';

  return (
    <aside className="insight-panel" aria-label={source ? 'Citation evidence' : 'Document preview'}>
      <header className="insight-panel-header">
        <div>
          <span>{source ? 'Citation evidence' : 'Document preview'}</span>
          <h2 title={document.originalName}>{document.originalName}</h2>
        </div>
        <button type="button" onClick={onClose} title="Close panel"><X size={18} /></button>
      </header>

      <div className="insight-panel-toolbar">
        <span><FileText size={14} /> {source ? pageLabel(source) : `${document.metadata?.pageCount || 0} pages`}</span>
        <button type="button" onClick={downloadFile}><Download size={14} /> Download</button>
      </div>

      <div className="insight-panel-body" aria-live="polite">
        {source && (
          <section className="evidence-passage">
            <span>Retrieved passage</span>
            <mark>{source.text}</mark>
            {source.score != null && <small>Retrieval score {Math.round(source.score * 1000) / 10}%</small>}
          </section>
        )}

        {loading && (
          <div className="panel-loading"><LoaderCircle size={22} /> Loading preview</div>
        )}
        {error && <div className="panel-error">{error}</div>}

        {!loading && !error && pdfUrl && (
          <iframe
            className="pdf-preview"
            src={pdfUrl}
            title={`Preview of ${document.originalName}`}
          />
        )}

        {!loading && !error && document.mimeType !== 'application/pdf' && (
          <section className="text-preview">
            <div className="text-preview-heading">
              <span>Extracted text</span>
              {preview?.truncated && <small>Preview shortened</small>}
            </div>
            <pre>{preview?.excerpt || 'No extracted text is available.'}</pre>
          </section>
        )}
      </div>

      {fileUrl && (
        <a className="insight-open-link" href={pdfUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Open full preview
        </a>
      )}
    </aside>
  );
}
