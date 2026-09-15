import { render, waitFor, act } from '@testing-library/react';
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';

import { useDialogBack } from './use-dialog-back';

it('consumes Back for the dialog while retaining the underlying history state in Strict Mode', async () => {
  const close = vi.fn();
  const underlying = { page: 'privacy' };
  window.history.replaceState(underlying, '');
  function Dialog() {
    useDialogBack(true, close);
    return <div />;
  }
  render(
    <StrictMode>
      <Dialog />
    </StrictMode>,
  );
  await waitFor(() => {
    expect(window.history.state).toHaveProperty('dialog');
  });
  act(() => {
    window.history.back();
  });
  await waitFor(() => {
    expect(close).toHaveBeenCalledOnce();
  });
  expect(window.history.state).toEqual(underlying);
});
