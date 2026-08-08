import { useTranslation } from 'react-i18next';

import { LanguageControl } from '../settings/LanguageControl';
import { ThemeControl } from '../settings/ThemeControl';
import styles from './HomePage.module.css';

export function HomePage() {
  const { t } = useTranslation();
  const foundationItems = [
    {
      key: 'local-first',
      title: t(($) => $.home.foundation.items.localFirst.title),
      description: t(($) => $.home.foundation.items.localFirst.description),
    },
    {
      key: 'personal-patterns',
      title: t(($) => $.home.foundation.items.personalPatterns.title),
      description: t(($) => $.home.foundation.items.personalPatterns.description),
    },
    {
      key: 'accessible',
      title: t(($) => $.home.foundation.items.accessible.title),
      description: t(($) => $.home.foundation.items.accessible.description),
    },
  ] as const;

  return (
    <main className={styles['page']}>
      <header className={styles['hero']}>
        <p className={styles['eyebrow']}>{t(($) => $.home.eyebrow)}</p>
        <h1>{t(($) => $.home.title)}</h1>
        <p className={styles['introduction']}>{t(($) => $.home.introduction)}</p>
      </header>

      <section className={styles['foundation']} aria-labelledby="foundation-title">
        <div>
          <p className={styles['sectionLabel']}>{t(($) => $.home.foundation.label)}</p>
          <h2 id="foundation-title">{t(($) => $.home.foundation.title)}</h2>
        </div>
        <ul className={styles['foundationList']}>
          {foundationItems.map(({ key, title, description }) => (
            <li key={key}>
              <strong>{title}</strong>
              <span>{description}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles['preferences']} aria-labelledby="preferences-title">
        <div>
          <p className={styles['sectionLabel']}>{t(($) => $.home.preferences.label)}</p>
          <h2 id="preferences-title">{t(($) => $.home.preferences.title)}</h2>
          <p>{t(($) => $.home.preferences.description)}</p>
        </div>
        <div className={styles['preferenceControls']}>
          <ThemeControl />
          <LanguageControl />
        </div>
      </section>

      <footer className={styles['footer']}>{t(($) => $.home.footer)}</footer>
    </main>
  );
}
