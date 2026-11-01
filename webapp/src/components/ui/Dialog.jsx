import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap, useScrollLock } from '../../hooks';

// Accessible modal: focus moves in and is trapped, Escape and a click outside
// close it, and focus returns to what opened it. Use it only when the task needs
// the person's full attention (confirming, commenting on a decision).
export default function Dialog({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, initialFocusRef, hideHeader = false, label }) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();
  useScrollLock(open);
  useFocusTrap(ref, open, initialFocusRef);

  if (!open) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => { if (dismissible && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        className={`dialog dialog-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hideHeader ? undefined : titleId}
        aria-label={hideHeader ? label : undefined}
        aria-describedby={description ? descId : undefined}
        data-dialog-open
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && dismissible) {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        {!hideHeader && (
          <div className="dialog-head">
            <h2 id={titleId} className="dialog-title">{title}</h2>
            {dismissible && (
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
            )}
          </div>
        )}
        {description && <p id={descId} className="dialog-desc">{description}</p>}
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
