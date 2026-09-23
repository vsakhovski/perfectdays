import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReminderReceipt, ReminderScheduler } from '../ports/reminder-scheduler';
import { ReminderRuntime } from './reminder-runtime';

const plan = {
  cycleKey: 'cycle-1',
  at: Date.parse('2026-10-10T09:00:00Z'),
  title: 'App',
  body: 'Reminder',
};

function setup() {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T09:00:00Z'));
  let receipt: ReminderReceipt = { armed: false };
  let pending = false;
  const adapter = {
    permission: vi.fn(() => Promise.resolve(true)),
    pending: vi.fn(() => Promise.resolve(pending)),
    schedule: vi.fn(() => {
      pending = true;
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      pending = false;
      return Promise.resolve();
    }),
    read: vi.fn(() => Promise.resolve({ ...receipt })),
    write: vi.fn((next: ReminderReceipt) => {
      receipt = { ...next };
      return Promise.resolve();
    }),
  } satisfies ReminderScheduler;
  const runtime = new ReminderRuntime();
  runtime.install(adapter);
  return {
    runtime,
    adapter,
    loseRegistration: () => {
      pending = false;
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('local reminder runtime', () => {
  it('does nothing on the PWA', async () => {
    const runtime = new ReminderRuntime();
    expect(runtime.available).toBe(false);
    await runtime.enable();
    await runtime.reconcile(plan);
    expect(runtime.getSnapshot().status).toBe('off');
  });
  it('requires per-device activation even when a plan exists', async () => {
    const { runtime, adapter } = setup();
    await runtime.reconcile(plan);
    expect(adapter.schedule).not.toHaveBeenCalled();
    expect(adapter.permission).not.toHaveBeenCalled();
  });
  it('does not arm after permission denial', async () => {
    const { runtime, adapter } = setup();
    adapter.permission.mockResolvedValue(false);
    await runtime.enable();
    expect(runtime.getSnapshot().status).toBe('permission');
    expect(adapter.write).not.toHaveBeenCalled();
  });
  it('serializes repeated reconciliations without duplicating registrations', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    await Promise.all([runtime.reconcile(plan), runtime.reconcile(plan), runtime.reconcile(plan)]);
    expect(adapter.schedule).toHaveBeenCalledTimes(1);
    expect(adapter.permission).toHaveBeenCalledWith(false);
  });
  it('repairs a missing future registration and updates changed text', async () => {
    const { runtime, adapter, loseRegistration } = setup();
    await runtime.enable();
    await runtime.reconcile(plan);
    loseRegistration();
    await runtime.reconcile(plan);
    await runtime.reconcile({ ...plan, body: 'Updated' });
    expect(adapter.schedule).toHaveBeenCalledTimes(3);
  });
  it('preserves the skipped time across restarts and clears it on rescheduling', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    await runtime.reconcile(plan);
    await runtime.skip(plan);
    const restarted = new ReminderRuntime();
    restarted.install(adapter);
    await restarted.reconcile(plan);
    expect(restarted.getSnapshot()).toEqual({ status: 'skipped', at: plan.at });
    expect(adapter.schedule).toHaveBeenCalledTimes(1);
    await restarted.reconcile({ ...plan, at: plan.at + 86400000 });
    expect(adapter.schedule).toHaveBeenCalledTimes(2);
    expect((await adapter.read()).skippedAt).toBeUndefined();
    expect((await adapter.read()).skippedCycle).toBeUndefined();
  });
  it('explicitly reschedules a handled cycle for a future time and then deduplicates resume', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    await runtime.reconcile(plan);
    vi.spyOn(Date, 'now').mockReturnValue(plan.at + 1);
    const next = { ...plan, at: plan.at + 3600000 };
    await runtime.reconcile(next, { reschedule: true });
    expect(adapter.schedule).toHaveBeenLastCalledWith(next);
    expect(adapter.schedule).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot()).toEqual({ status: 'scheduled', at: next.at });
    expect((await adapter.read()).handledCycle).toBeUndefined();
    await runtime.reconcile(next);
    expect(adapter.schedule).toHaveBeenCalledTimes(2);
  });

  it('explicitly replaces even an unchanged future registration', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    await runtime.reconcile(plan);
    await runtime.skip(plan);
    await runtime.reconcile(plan, { reschedule: true });
    expect(adapter.schedule).toHaveBeenCalledTimes(2);
    await runtime.reconcile(plan, { reschedule: true });
    expect(adapter.schedule).toHaveBeenCalledTimes(3);
  });

  it.each([0, -1, Number.NaN])(
    'rejects invalid or elapsed explicit time offset %s',
    async (offset) => {
      const { runtime, adapter } = setup();
      await runtime.enable();
      await runtime.reconcile({ ...plan, at: Date.now() + offset }, { reschedule: true });
      expect(adapter.schedule).not.toHaveBeenCalled();
      expect(runtime.getSnapshot().status).toBe('past');
    },
  );

  it('keeps skipped details after failed rescheduling until retry succeeds', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    await runtime.reconcile(plan);
    await runtime.skip(plan);
    adapter.schedule.mockRejectedValueOnce(new Error('OS failure'));
    await expect(runtime.reconcile(plan, { reschedule: true })).rejects.toThrow();
    expect((await adapter.read()).skippedAt).toBe(plan.at);
    await runtime.reconcile(plan, { reschedule: true });
    expect((await adapter.read()).skippedAt).toBeUndefined();
  });
  it('never recreates an elapsed occurrence even if the prediction moves forward', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    await runtime.reconcile(plan);
    vi.spyOn(Date, 'now').mockReturnValue(plan.at + 1);
    await runtime.reconcile({ ...plan, at: plan.at + 86400000 });
    expect(adapter.schedule).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot().status).toBe('past');
  });
  it('does not schedule catch-up notifications', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    await runtime.reconcile({ ...plan, at: Date.now() - 1 });
    expect(adapter.schedule).not.toHaveBeenCalled();
  });
  it('clears alarms when estimates disappear or permission is revoked', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    await runtime.reconcile(plan);
    await runtime.reconcile(undefined);
    expect(await adapter.pending()).toBe(false);
    expect(runtime.getSnapshot().status).toBe('waiting');
    adapter.permission.mockResolvedValue(false);
    await runtime.reconcile(plan);
    expect(runtime.getSnapshot().status).toBe('permission');
  });
  it('disarms before failed cancellation and can retry cleanup', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    adapter.clear.mockRejectedValueOnce(new Error('OS failure'));
    await expect(runtime.disable()).rejects.toThrow('OS failure');
    expect((await adapter.read()).armed).toBe(false);
    await runtime.reconcile(plan);
    expect(adapter.schedule).not.toHaveBeenCalled();
  });
  it('reports scheduling failures and recovers on retry', async () => {
    const { runtime, adapter } = setup();
    await runtime.enable();
    adapter.schedule.mockRejectedValueOnce(new Error('OS failure'));
    await expect(runtime.reconcile(plan)).rejects.toThrow('OS failure');
    expect(runtime.getSnapshot().status).toBe('error');
    await runtime.reconcile(plan);
    expect(runtime.getSnapshot().status).toBe('scheduled');
  });
});
