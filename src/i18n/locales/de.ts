import type { TranslationResource } from './en';

export const de = {
  meta: {
    title: 'Menstruationskalender',
    description: 'Ein privates, lokal gespeichertes Tagebuch für Menstruationsmuster.',
  },
  home: {
    eyebrow: 'Technische Grundlage',
    title: 'Deine Muster. In deiner Hand.',
    introduction:
      'Ein privates Menstruationstagebuch, das widerspiegelt, was du einträgst – ohne dir vorzuschreiben, wie du dich fühlen oder verhalten sollst.',
    foundation: {
      label: 'In der Architektur verankert',
      title: 'Datenschutz und Klarheit von Anfang an',
      items: {
        localFirst: {
          title: 'Lokal gespeichert',
          description:
            'Kein Konto, keine Analyse-Tools und keine Übertragung von Gesundheitsdaten.',
        },
        personalPatterns: {
          title: 'Persönliche Muster',
          description: 'Aufgezeichnete Beobachtungen bleiben klar von Vorhersagen getrennt.',
        },
        accessible: {
          title: 'Barrierefrei von Anfang an',
          description:
            'Bedeutungen werden nie ausschließlich durch Rot, Orange oder Grün vermittelt.',
        },
      },
    },
    preferences: {
      label: 'MVP-Einstellungen',
      title: 'Passe die App an',
      description: 'Darstellung und Sprache werden nur auf diesem Gerät gespeichert.',
    },
    footer: 'Deine Daten bleiben standardmäßig auf diesem Gerät.',
  },
  settings: {
    appearance: {
      legend: 'Darstellung',
      options: {
        system: 'System',
        light: 'Hell',
        dark: 'Dunkel',
      },
      resolved: {
        light: 'hell',
        dark: 'dunkel',
      },
      current: 'Aktuell wird der Modus „{{theme}}“ angezeigt.',
    },
    language: {
      label: 'Sprache',
      options: {
        system: 'Gerätesprache',
        en: 'English',
        de: 'Deutsch',
      },
      resolved: {
        en: 'Englisch',
        de: 'Deutsch',
      },
      current: 'Die App wird derzeit auf {{language}} angezeigt.',
    },
  },
} as const satisfies TranslationResource;
