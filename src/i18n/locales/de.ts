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
  vault: {
    loading: {
      title: 'Dein privates Tagebuch wird geöffnet',
      description: 'Der lokale Datentresor auf diesem Gerät wird geprüft.',
    },
    unavailable: {
      eyebrow: 'Lokaler Speicher nicht verfügbar',
      title: 'Das private Tagebuch konnte nicht geöffnet werden',
      description:
        'Deine vorhandenen Daten wurden nicht verändert. Prüfe, ob dieser Browser lokalen Speicher erlaubt, und lade die App dann neu.',
      reset: {
        reveal: 'Lokale App-Daten zurücksetzen',
        title: 'Stattdessen die lokalen Daten löschen?',
        description:
          'Wenn erneutes Laden nicht hilft, kannst du alle Daten und Einstellungen dieser App in diesem Browser dauerhaft entfernen.',
        confirmation: 'Ich verstehe, dass dies nicht rückgängig gemacht werden kann.',
        action: 'Löschen und neu beginnen',
        working: 'Wird gelöscht…',
        cancel: 'Meine Daten behalten',
        failed: 'Der Browser hat das Löschen der lokalen Daten nicht zugelassen.',
      },
    },
    erased: {
      eyebrow: 'Lokale Daten gelöscht',
      title: 'Die Daten wurden gelöscht, aber die App konnte nicht neu starten',
      description:
        'Das vorherige Tagebuch und die PIN-Daten sind gelöscht. Prüfe, ob dieser Browser lokalen Speicher erlaubt, und lade die App neu, um einen leeren Datentresor anzulegen.',
      preferencesMayRemain:
        'Der Browser hat das Entfernen der gespeicherten Darstellungs- oder Spracheinstellung nicht bestätigt.',
    },
    lock: {
      metaTitle: 'Private App – gesperrt',
      metaDescription: 'Eine private lokale App ist gesperrt.',
      eyebrow: 'Private App',
      title: 'Gesperrt',
      description: 'Gib deine sechsstellige PIN ein, um fortzufahren.',
      cryptoUnavailable:
        'Das Entsperren per PIN ist in diesem Browser oder über diese Verbindung nicht verfügbar. Deine gespeicherten Daten wurden nicht verändert. Öffne die App in einem unterstützten sicheren Browser, bevor du ein Zurücksetzen erwägst.',
      pinLabel: 'PIN',
      pinHint: 'Gib sechs Ziffern ein.',
      unlock: 'Entsperren',
      unlocking: 'Wird entsperrt…',
      failed: 'Die App konnte nicht entsperrt werden. Prüfe die PIN und versuche es erneut.',
      forgotPin: 'PIN vergessen?',
      reset: {
        title: 'Diese App zurücksetzen?',
        description:
          'Die PIN kann nicht wiederhergestellt werden. Beim Zurücksetzen werden alle Daten und Einstellungen dieser App in diesem Browser dauerhaft gelöscht.',
        confirmation: 'Ich verstehe, dass dies nicht rückgängig gemacht werden kann.',
        action: 'Lokale App-Daten löschen',
        working: 'Wird gelöscht…',
        cancel: 'Meine Daten behalten',
        failed:
          'Die lokalen Daten konnten nicht gelöscht werden. Es wurde nichts absichtlich entfernt.',
      },
      preferences: 'Einstellungen auf dem Sperrbildschirm',
    },
    security: {
      eyebrow: 'Datenschutz',
      title: 'PIN-Sperre und lokaler Datentresor',
      description:
        'Eine PIN schützt das Tagebuch, wenn diese App geschlossen oder im Hintergrund gelassen wird.',
      cryptoUnavailable:
        'Der PIN-Schutz ist nicht verfügbar, weil dieser Browser oder diese Verbindung die Prüfung der sicheren Verschlüsselung nicht bestanden hat.',
      protected: {
        status: 'PIN-Schutz ist aktiviert',
        description:
          'Die Tagebuchdaten sind in diesem Browser verschlüsselt gespeichert. Die PIN kann nicht wiederhergestellt werden.',
        lockNow: 'Jetzt sperren',
      },
      unprotected: {
        status: 'PIN-Schutz ist deaktiviert',
        description:
          'Die Tagebuchdaten werden derzeit ohne Verschlüsselung durch die App und ohne Zugangssperre gespeichert.',
        recommendation: 'PIN einrichten',
      },
      autoLock: {
        label: 'Nach Verlassen der App sperren',
        options: {
          immediate: 'Sofort',
          oneMinute: 'Nach 1 Minute',
          fiveMinutes: 'Nach 5 Minuten',
          fifteenMinutes: 'Nach 15 Minuten',
        },
        saving: 'Einstellung für automatische Sperre wird gespeichert…',
        failed: 'Die Einstellung für die automatische Sperre konnte nicht gespeichert werden.',
      },
      actions: {
        changePin: 'PIN ändern',
        disablePin: 'PIN-Schutz ausschalten',
        eraseEverything: 'Alles löschen',
      },
      setup: {
        title: 'Sechsstellige PIN einrichten',
        description:
          'Das Tagebuch wird verschlüsselt, bevor der PIN-Schutz aktiviert wird. Eine vergessene PIN kann nicht wiederhergestellt werden.',
        pinLabel: 'Neue PIN',
        confirmationLabel: 'Neue PIN bestätigen',
        submit: 'PIN-Schutz aktivieren',
        working: 'Tagebuch wird geschützt…',
        success: 'Der PIN-Schutz ist jetzt aktiviert.',
      },
      change: {
        title: 'PIN ändern',
        description:
          'Wähle eine neue sechsstellige PIN. Die Tagebuchdaten müssen dabei nicht neu geschrieben werden.',
        currentPinLabel: 'Aktuelle PIN',
        newPinLabel: 'Neue PIN',
        confirmationLabel: 'Neue PIN bestätigen',
        submit: 'PIN ändern',
        working: 'PIN wird geändert…',
        success: 'Die PIN wurde geändert.',
      },
      disable: {
        title: 'PIN-Schutz ausschalten?',
        description:
          'Das Tagebuch bleibt nur in diesem Browser, wird aber ohne Verschlüsselung durch die App und ohne Zugangssperre gespeichert.',
        currentPinLabel: 'Aktuelle PIN',
        confirmation: 'Ich verstehe, dass das Tagebuch ohne PIN-Schutz gespeichert wird.',
        submit: 'PIN-Schutz ausschalten',
        working: 'PIN-Schutz wird entfernt…',
        success: 'Der PIN-Schutz ist jetzt deaktiviert.',
      },
      reset: {
        title: 'Alle lokalen Daten löschen?',
        description:
          'Dadurch werden Tagebuch, PIN-Schutz, Darstellungs- und Spracheinstellungen dauerhaft aus diesem Browser entfernt.',
        confirmation: 'Ich verstehe, dass dies nicht rückgängig gemacht werden kann.',
        submit: 'Alles löschen',
        working: 'Wird gelöscht…',
        success: 'Alle App-Daten wurden gelöscht.',
        partialSuccess:
          'Tagebuch und PIN-Daten wurden gelöscht, aber eine Darstellungs- oder Spracheinstellung könnte erhalten geblieben sein.',
      },
      form: {
        cancel: 'Abbrechen',
        sixDigits: 'Verwende genau sechs Ziffern.',
        mismatch: 'Die PINs stimmen nicht überein.',
        unlockFailed: 'Die aktuelle PIN wurde nicht akzeptiert.',
        operationFailed:
          'Die Änderung konnte nicht abgeschlossen werden. Deine vorhandenen Daten wurden nicht verändert.',
      },
    },
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
