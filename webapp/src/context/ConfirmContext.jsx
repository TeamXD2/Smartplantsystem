import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Dialog from '../components/ui/Dialog';

// One shared confirm dialog: `const ok = await confirm({ title, message, ... })`.
// Focus starts on Cancel for destructive actions so a stray Enter cannot delete.
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => setRequest({ options, resolve })), []);

  function answer(value) {
    request.resolve(value);
    setRequest(null);
  }

  const o = request ? request.options : {};
  const danger = o.tone === 'danger';
  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(request)}
        onClose={() => answer(false)}
        title={o.title}
        description={o.message}
        size="sm"
        initialFocusRef={danger ? cancelRef : confirmRef}
        footer={(
          <>
            <button type="button" ref={cancelRef} className="btn btn-outline" onClick={() => answer(false)}>{o.cancelLabel || 'Cancel'}</button>
            <button type="button" ref={confirmRef} className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`} onClick={() => answer(true)}>
              {o.confirmLabel || 'Confirm'}
            </button>
          </>
        )}
      >
        {o.details}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
