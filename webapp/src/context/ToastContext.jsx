import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

// Short messages that confirm what just happened ("Record saved."). Errors stay a
// little longer. Hovering or focusing a message pauses its timer. Persistent
// problems (a page that failed to load) stay inline on the page instead.
const ToastContext = createContext(null);
const DURATION = { success: 5000, info: 5000, error: 9000 };
const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };

function Toast({ toast, onDismiss }) {
  const timer = useRef(null);
  const Icon = ICON[toast.kind];

  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDismiss(toast.id), DURATION[toast.kind]);
  }, [toast.id, toast.kind, onDismiss]);
  const stop = () => clearTimeout(timer.current);

  useEffect(() => {
    start();
    return stop;
  }, [start]);

  return (
    <div
      className={`toast toast-${toast.kind}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
    >
      <Icon size={18} className="toast-icon" aria-hidden="true" />
      <div className="toast-text">
        <div>{toast.message}</div>
        {toast.detail && <div className="toast-detail">{toast.detail}</div>}
      </div>
      {toast.action && (
        <button type="button" className="toast-action" onClick={() => { toast.action.onClick(); onDismiss(toast.id); }}>
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast-close" aria-label="Dismiss message" onClick={() => onDismiss(toast.id)}><X size={16} /></button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback((kind, message, options = {}) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, kind, message, ...options }]);
    return id;
  }, []);

  const api = useMemo(() => ({
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    info: (message, options) => push('info', message, options),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Messages">
        {toasts.map((t) => <Toast key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
