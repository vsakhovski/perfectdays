import { useEffect, useLayoutEffect, useRef } from 'react';

let nextDialogId = 0;
function historyRecord(): Record<string, unknown> {
  const state: unknown = window.history.state;
  return state !== null && typeof state === 'object' ? (state as Record<string, unknown>) : {};
}

/** Keep transient dialogs out of routes and never put PINs or journal data in history. */
export function useDialogBack(open: boolean, close: () => void, busy = false): void {
  const latest = useRef({ close, busy });
  useLayoutEffect(() => {
    latest.current = { close, busy };
  }, [close, busy]);
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    let entered = false;
    let popped = false;
    const token = `pin-dialog-${String(++nextDialogId)}`;
    const onPop = (event: PopStateEvent): void => {
      event.stopImmediatePropagation();
      if (!disposed && latest.current.busy) {
        window.history.pushState({ ...historyRecord(), dialog: token }, '');
        return;
      }
      popped = true;
      window.removeEventListener('popstate', onPop, true);
      if (!disposed) latest.current.close();
    };
    // Avoid creating an entry during Strict Mode's setup/cleanup probe.
    queueMicrotask(() => {
      if (disposed) return;
      window.history.pushState({ ...historyRecord(), dialog: token }, '');
      entered = true;
      window.addEventListener('popstate', onPop, true);
    });
    return () => {
      disposed = true;
      if (entered && !popped && historyRecord()['dialog'] === token) {
        // Consume our entry on X/success as well, without navigating the page.
        window.history.back();
      } else {
        window.removeEventListener('popstate', onPop, true);
      }
    };
  }, [open]);
}
