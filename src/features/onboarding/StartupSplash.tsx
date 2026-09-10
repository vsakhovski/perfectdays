import { useTranslation } from 'react-i18next';

import { AppLogo } from '../../shared/ui/AppLogo';
import styles from './StartupSplash.module.css';

export function StartupSplash() {
  const { t } = useTranslation();

  return (
    <main className={styles['splash']}>
      <div className={styles['identity']}>
        <AppLogo className={styles['logo']} animated />
        <h1>{t(($) => $.tracker.onboarding.splash.appName)}</h1>
      </div>
      <p className={styles['version']}>
        {t(($) => $.tracker.onboarding.splash.version, { version: __APP_VERSION__ })}
      </p>
    </main>
  );
}
