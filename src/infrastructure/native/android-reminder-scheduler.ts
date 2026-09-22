import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import type {
  ReminderReceipt,
  ReminderScheduler,
} from '../../application/ports/reminder-scheduler';

const ID = 21001;
const KEY = 'period-reminder-receipt-v1';
const CHANNEL = 'period-reminders';

export const androidReminderScheduler: ReminderScheduler = {
  async permission(request) {
    const result = request
      ? await LocalNotifications.requestPermissions()
      : await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  },
  async pending() {
    return (await LocalNotifications.getPending()).notifications.some((item) => item.id === ID);
  },
  async schedule(plan) {
    await LocalNotifications.createChannel({
      id: CHANNEL,
      name: plan.title,
      importance: 3,
      visibility: 0,
    });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: ID,
          title: plan.title,
          body: plan.body,
          channelId: CHANNEL,
          schedule: { at: new Date(plan.at), allowWhileIdle: true },
          isExactNotification: false,
          ongoing: false,
          autoCancel: true,
        },
      ],
    });
  },
  async clear() {
    await LocalNotifications.cancel({ notifications: [{ id: ID }] });
    const delivered = await LocalNotifications.getDeliveredNotifications();
    const notifications = delivered.notifications.filter((item) => item.id === ID);
    if (notifications.length)
      await LocalNotifications.removeDeliveredNotifications({ notifications });
  },
  async read() {
    const { value } = await Preferences.get({ key: KEY });
    if (value === null) return { armed: false };
    const receipt: unknown = JSON.parse(value);
    if (
      !receipt ||
      typeof receipt !== 'object' ||
      !('armed' in receipt) ||
      typeof receipt.armed !== 'boolean'
    ) {
      throw new Error('Invalid reminder receipt.');
    }
    return receipt as ReminderReceipt;
  },
  async write(receipt) {
    await Preferences.set({ key: KEY, value: JSON.stringify(receipt) });
  },
};
