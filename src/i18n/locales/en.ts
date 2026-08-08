export const en = {
  meta: {
    title: 'Menstrual Pattern Tracker',
    description: 'A private, local-first menstrual pattern journal.',
  },
  home: {
    eyebrow: 'Foundation scaffold',
    title: 'Your patterns, in your hands.',
    introduction:
      'A private menstrual journal designed to reflect what you record, without prescribing how you should feel or act.',
    foundation: {
      label: 'Built into the architecture',
      title: 'Privacy and clarity from day one',
      items: {
        localFirst: {
          title: 'Local-first',
          description: 'No account, analytics, or health-data network requests.',
        },
        personalPatterns: {
          title: 'Personal patterns',
          description: 'Recorded observations will remain distinct from predictions.',
        },
        accessible: {
          title: 'Accessible by default',
          description: 'Meaning will never depend on red, orange, or green alone.',
        },
      },
    },
    preferences: {
      label: 'MVP preferences',
      title: 'Make the app yours',
      description: 'Appearance and language are saved only on this device.',
    },
    footer: 'Your data will stay on this device by default.',
  },
  settings: {
    appearance: {
      legend: 'Appearance',
      options: {
        system: 'System',
        light: 'Light',
        dark: 'Dark',
      },
      resolved: {
        light: 'light',
        dark: 'dark',
      },
      current: 'Currently displaying {{theme}} mode.',
    },
    language: {
      label: 'Language',
      options: {
        system: 'Device language',
        en: 'English',
        de: 'Deutsch',
      },
      resolved: {
        en: 'English',
        de: 'German',
      },
      current: 'The app is currently displayed in {{language}}.',
    },
  },
} as const;

type WidenTranslationValues<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : WidenTranslationValues<T[Key]>;
};

export type TranslationResource = WidenTranslationValues<typeof en>;
