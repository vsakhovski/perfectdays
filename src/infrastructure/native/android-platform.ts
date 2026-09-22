import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { reminderRuntime } from '../../application/reminders/reminder-runtime';
import { androidReminderScheduler } from './android-reminder-scheduler';

export async function initializeAndroid(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  reminderRuntime.install(androidReminderScheduler);
  await App.addListener('backButton', () => {
    window.history.back();
  });
  await App.addListener('appStateChange', ({ isActive }) => {
    // Native lifecycle also reaches auto-lock; the browser event alone isn't sufficient.
    window.dispatchEvent(new CustomEvent('native-app-state', { detail: isActive }));
    if (isActive) window.dispatchEvent(new Event('native-reminder-resume'));
  });
  await LocalNotifications.addListener('localNotificationActionPerformed', () => {
    // Never reload over an unsaved entry or bypass PIN protection.
    window.dispatchEvent(new Event('native-reminder-open'));
  });
}
