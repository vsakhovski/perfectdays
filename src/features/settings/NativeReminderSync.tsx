import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../app/vault/use-vault';
import { useAppNavigation } from '../../app/navigation/use-app-navigation';
import { planPeriodReminder } from '../../application/reminders/reminder-plan';
import { reminderRuntime } from '../../application/reminders/reminder-runtime';

/** A recovery check may read pending alarms, but never replaces an unchanged registration. */
export function NativeReminderSync() {
  const { snapshot, journalEnvironment } = useVault();
  const { t } = useTranslation();
  const { navigate } = useAppNavigation();
  useEffect(() => {
    const open = () => {
      if (snapshot.phase === 'unlocked' && !document.querySelector('[role="dialog"]')) {
        navigate({ kind: 'root', destination: 'calendar' });
      }
    };
    window.addEventListener('native-reminder-open', open);
    return () => {
      window.removeEventListener('native-reminder-open', open);
    };
  }, [navigate, snapshot.phase]);
  useEffect(() => {
    if (!reminderRuntime.available || snapshot.phase !== 'unlocked') return;
    const reconcile = () => {
      const plan = planPeriodReminder(snapshot.payload, journalEnvironment.today(), {
        title: t(($) => $.meta.title),
        discreet: t(($) => $.reminders.discreetText),
        direct: t(($) => $.reminders.directText),
      });
      void reminderRuntime.reconcile(plan).catch(() => {
        /* Runtime exposes a localized error in settings. */
      });
    };
    reconcile();
    window.addEventListener('native-reminder-resume', reconcile);
    return () => {
      window.removeEventListener('native-reminder-resume', reconcile);
    };
  }, [snapshot, journalEnvironment, t]);
  return null;
}
