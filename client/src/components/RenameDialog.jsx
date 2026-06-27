import { useEffect, useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';

export default function RenameDialog({ session, onSave, onClose }) {
  const [title, setTitle] = useState(session?.title || '');
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!session) return undefined;
    const previousFocus = window.document.activeElement;
    setTitle(session.title || '');
    window.setTimeout(() => inputRef.current?.select(), 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;

      const items = [...(dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled)'
      ) || [])];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [session, onClose]);

  if (!session) return null;

  const submit = (event) => {
    event.preventDefault();
    const normalized = title.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    onSave(normalized);
  };

  return (
    <div className="dialog-overlay" role="presentation" onMouseDown={onClose}>
      <form
        ref={dialogRef}
        className="action-dialog rename-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-dialog-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="action-dialog-icon"><Pencil size={19} /></div>
        <button type="button" className="action-dialog-close" onClick={onClose} title="Close">
          <X size={17} />
        </button>
        <h2 id="rename-dialog-title">Rename session</h2>
        <label>
          <span>Session title</span>
          <input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 120))}
            maxLength={120}
            required
          />
        </label>
        <div className="action-dialog-actions">
          <button type="button" className="dialog-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="dialog-primary" disabled={!title.trim()}>Save</button>
        </div>
      </form>
    </div>
  );
}
