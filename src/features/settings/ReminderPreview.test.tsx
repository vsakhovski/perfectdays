import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { useState } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppI18n } from '../../i18n/create-i18n';
import { ReminderPreview } from './ReminderPreview';

// Browser-history integration is covered separately; keep these interaction tests isolated.
vi.mock('../../shared/ui/use-dialog-back', () => ({ useDialogBack: vi.fn() }));

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    writable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    writable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
beforeEach(() => {
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      readonly pointerId: number;
      readonly isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.isPrimary = init.isPrimary ?? false;
      }
    },
  );
});
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

async function setup() {
  const onClose = vi.fn();
  const i18n = await createAppI18n('en');
  const view = render(
    <I18nextProvider i18n={i18n}>
      <ReminderPreview message="My private reminder" onClose={onClose} />
    </I18nextProvider>,
  );
  return { onClose, ...view };
}

describe('ReminderPreview', () => {
  it('stays open after its trigger click and restores focus when dismissed', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            {'Preview reminder'}
          </button>
          {open ? (
            <ReminderPreview
              message="Private reminder"
              onClose={() => {
                setOpen(false);
              }}
            />
          ) : null}
        </>
      );
    }
    const i18n = await createAppI18n('en');
    render(
      <I18nextProvider i18n={i18n}>
        <Harness />
      </I18nextProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'Preview reminder' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.click(screen.getByText('Private reminder'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeVisible();
  });
  it('opens a modal, displays the message, and focuses its close control', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    await setup();
    expect(showModal).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'Preview' })).toHaveAttribute('open');
    expect(screen.getByText('My private reminder')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close notification preview' })).toHaveFocus();
  });

  it.each(['message', 'backdrop', 'close', 'escape', 'cancel'])(
    'dismisses on %s',
    async (target) => {
      const { onClose } = await setup();
      if (target === 'message') fireEvent.click(screen.getByText('My private reminder'));
      if (target === 'backdrop') fireEvent.click(screen.getByRole('dialog'));
      if (target === 'close') fireEvent.click(screen.getByRole('button'));
      if (target === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
      if (target === 'cancel')
        fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
      expect(onClose).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [60, 0],
    [-60, 0],
    [0, 60],
    [0, -60],
  ])('dismisses a swipe by %s/%s', async (x, y) => {
    const { onClose } = await setup();
    const dialog = screen.getByRole('dialog');
    fireEvent.pointerDown(dialog, { pointerId: 1, isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(dialog, { pointerId: 1, clientX: 100 + x, clientY: 100 + y });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores small movement and cancelled gestures and removes listeners on unmount', async () => {
    const { onClose, unmount } = await setup();
    fireEvent.pointerDown(document, { pointerId: 1, isPrimary: true, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerCancel(document, { pointerId: 1 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 80, clientY: 80 });
    expect(onClose).not.toHaveBeenCalled();
    unmount();
    fireEvent.click(document);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
