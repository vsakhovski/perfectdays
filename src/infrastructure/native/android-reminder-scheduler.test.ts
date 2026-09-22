import { beforeEach, describe, expect, it, vi } from 'vitest';
import { androidReminderScheduler as scheduler } from './android-reminder-scheduler';

const mocks = vi.hoisted(() => ({
  requestPermissions: vi.fn(),
  checkPermissions: vi.fn(),
  getPending: vi.fn(),
  createChannel: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  getDeliveredNotifications: vi.fn(),
  removeDeliveredNotifications: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: mocks }));
vi.mock('@capacitor/preferences', () => ({ Preferences: mocks }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.checkPermissions.mockResolvedValue({ display: 'denied' });
  mocks.requestPermissions.mockResolvedValue({ display: 'granted' });
  mocks.getPending.mockResolvedValue({ notifications: [] });
  mocks.getDeliveredNotifications.mockResolvedValue({ notifications: [] });
  mocks.get.mockResolvedValue({ value: null });
});

describe('Android reminder scheduler', () => {
  it('requests permission only when explicitly requested', async () => {
    expect(await scheduler.permission(false)).toBe(false);
    expect(mocks.requestPermissions).not.toHaveBeenCalled();
    expect(await scheduler.permission(true)).toBe(true);
    expect(mocks.requestPermissions).toHaveBeenCalledOnce();
  });

  it('recognizes only the reserved reminder notification ID', async () => {
    mocks.getPending.mockResolvedValueOnce({ notifications: [{ id: 9 }] });
    expect(await scheduler.pending()).toBe(false);
    mocks.getPending.mockResolvedValueOnce({ notifications: [{ id: 21001 }] });
    expect(await scheduler.pending()).toBe(true);
  });

  it('schedules a dismissible, inexact notification on a private channel', async () => {
    const at = new Date('2026-10-01T09:00:00Z').getTime();
    await scheduler.schedule({
      cycleKey: 'period-1',
      at,
      title: 'My Perfect Days',
      body: 'Personal reminder',
    });
    expect(mocks.createChannel).toHaveBeenCalledWith({
      id: 'period-reminders',
      name: 'My Perfect Days',
      importance: 3,
      visibility: 0,
    });
    expect(mocks.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: 21001,
          title: 'My Perfect Days',
          body: 'Personal reminder',
          channelId: 'period-reminders',
          schedule: { at: new Date(at), allowWhileIdle: true },
          isExactNotification: false,
          ongoing: false,
          autoCancel: true,
        },
      ],
    });
  });

  it('clears both pending and delivered reminders without clearing unrelated notifications', async () => {
    mocks.getDeliveredNotifications.mockResolvedValue({
      notifications: [{ id: 9 }, { id: 21001 }],
    });
    await scheduler.clear();
    expect(mocks.cancel).toHaveBeenCalledWith({ notifications: [{ id: 21001 }] });
    expect(mocks.removeDeliveredNotifications).toHaveBeenCalledWith({
      notifications: [{ id: 21001 }],
    });
  });

  it('does not remove delivered notifications when there are no reminders', async () => {
    await scheduler.clear();
    expect(mocks.removeDeliveredNotifications).not.toHaveBeenCalled();
  });

  it('starts disarmed and persists the receipt for restart deduplication', async () => {
    expect(await scheduler.read()).toEqual({ armed: false });
    const receipt = { armed: true, skippedCycle: 'period-1' };
    await scheduler.write(receipt);
    expect(mocks.set).toHaveBeenCalledWith({
      key: 'period-reminder-receipt-v1',
      value: JSON.stringify(receipt),
    });
    mocks.get.mockResolvedValue({ value: JSON.stringify(receipt) });
    expect(await scheduler.read()).toEqual(receipt);
  });

  it.each(['not json', '{}', '{"armed":"yes"}'])(
    'rejects invalid stored receipt %s',
    async (value) => {
      mocks.get.mockResolvedValue({ value });
      await expect(scheduler.read()).rejects.toThrow();
    },
  );
});
