import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirm } from './context/ConfirmContext';

// Warns before changes are lost: when navigating inside the app (asks with a
// dialog) and when closing or reloading the tab (the browser's own prompt).
export function useUnsavedChanges(dirty) {
  const confirm = useConfirm();
  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }) => dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
    [dirty]
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    confirm({
      title: 'Leave without saving?',
      message: 'You have changes that are not saved yet. If you leave now, they will be lost.',
      confirmLabel: 'Leave page',
      cancelLabel: 'Keep editing',
      tone: 'danger',
    }).then((leave) => (leave ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
