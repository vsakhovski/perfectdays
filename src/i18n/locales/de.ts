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
  tracker: {
    onboarding: {
      title: 'Richte dein privates Tagebuch ein',
      introduction:
        'Trage nur ein, was du weißt. Frühere Daten verbessern Schätzungen; optionale Schätzwerte können später geändert werden.',
      history: {
        title: 'Frühere Perioden',
        description:
          'Startdaten bilden den Zyklusverlauf. Füge ein Enddatum nur hinzu, wenn du es kennst; ohne Enddatum wird keine Blutungsdauer geschätzt.',
        empty: 'Noch keine frühere Periode hinzugefügt.',
        startDate: 'Startdatum',
        endDate: 'Enddatum (optional)',
        add: 'Frühere Periode hinzufügen',
        entryLabel: 'Frühere Periode {{position}}',
        removeEntry: 'Frühere Periode {{position}} entfernen',
      },
      fallbacks: {
        title: 'Optionale Ausgangsschätzungen',
        description:
          'Sie werden nur verwendet, solange nicht genügend aufgezeichnete Daten vorliegen. Aufzeichnungen haben immer Vorrang.',
        cycleLength: 'Übliche Zykluslänge in Tagen',
        cycleLengthDescription: 'Optional. Viele Zyklen Erwachsener schwanken von Monat zu Monat.',
        bleedDuration: 'Übliche Blutungsdauer in Tagen',
        bleedDurationDescription: 'Optional. Lass das Feld leer, wenn du unsicher bist.',
      },
      orange: {
        title: 'Mögliches Check-in-Fenster vor der Periode',
        description:
          'Diese optionale Markierung lädt zu einem persönlichen Check-in ein. Sie sagt weder Konflikte voraus noch gibt sie Entscheidungen vor.',
        enabled: 'Mögliches Check-in-Fenster vor der Periode anzeigen',
        days: 'Tage vor der zentralen Schätzung',
        daysDescription: 'Wähle 1 bis 14 Tage.',
      },
      validation: {
        startRequired: 'Füge ein Startdatum hinzu oder entferne diese Zeile.',
        endBeforeStart: 'Das Enddatum darf nicht vor dem Startdatum liegen.',
        duplicateStart: 'Jede frühere Periode benötigt ein anderes Startdatum.',
        overlappingHistory: 'Frühere Periodenzeiträume dürfen sich nicht überschneiden.',
        positiveInteger: 'Gib eine ganze Zahl größer als null ein.',
        cycleRange: 'Wähle eine ganze Zahl von 1 bis 365 Tagen.',
        bleedRange: 'Wähle eine ganze Zahl von 1 bis 90 Tagen.',
        orangeRange: 'Wähle eine ganze Zahl von 1 bis 14.',
        futureDate: 'Zukünftige Daten können nicht zum Periodenverlauf hinzugefügt werden.',
      },
      actions: {
        skip: 'Ohne Verlauf abschließen',
        complete: 'Einrichtung abschließen',
        completing: 'Einrichtung wird gespeichert…',
      },
      saveFailed:
        'Die Einrichtung konnte nicht gespeichert werden. Dein bestehendes Tagebuch wurde nicht verändert.',
    },
    calendar: {
      sectionLabel: 'Kalender',
      title: 'Deine Aufzeichnungen und Schätzungen',
      description:
        'Aufzeichnungen sind flächig dargestellt. Schätzungen sind gemustert oder umrandet und können sich mit dem Verlauf ändern.',
      navigationLabel: 'Monatsnavigation des Kalenders',
      calendarLabel: 'Kalender für Menstruationsmuster',
      previousMonth: 'Vorheriger Monat',
      nextMonth: 'Nächster Monat',
      today: 'Heute.',
      selected: 'Ausgewählt.',
      outsideMonth: 'Außerhalb des angezeigten Monats.',
      future: 'Zukünftiges Datum; Check-ins sind nicht verfügbar.',
      legendTitle: 'Legende der Kalendermarkierungen',
      markers: {
        recordedRed: 'Aufgezeichneter Periodentag.',
        predictedRed: 'Geschätzter Periodentag.',
        predictedStart: 'Zentrale Schätzung des Beginns.',
        possibleStart: 'Möglicher Periodenbeginn.',
        orange: 'Mögliches Check-in-Fenster vor der Periode.',
        green: 'Höheres Selbstvertrauen aufgezeichnet.',
        spotting: 'Schmierblutung aufgezeichnet.',
        neutral: 'Keine Markierung aufgezeichnet.',
      },
      markerConfidence: {
        predictedRed: 'Geschätzter Periodentag. Prognosesicherheit: {{confidence}}.',
        possibleStart: 'Möglicher Periodenbeginn. Prognosesicherheit: {{confidence}}.',
        orange: 'Mögliches Check-in-Fenster vor der Periode. Prognosesicherheit: {{confidence}}.',
      },
    },
    forecast: {
      title: 'Schätzung der nächsten Periode',
      unavailable:
        'Füge mindestens zwei Periodenstarts oder eine optionale übliche Zykluslänge hinzu, um eine Schätzung zu sehen.',
      paused: 'Schätzungen sind pausiert. Aufzeichnungen bleiben sichtbar.',
      range: 'Deine nächste Periode könnte zwischen {{range}} beginnen.',
      central: 'Zentrale Schätzung: {{date}}.',
      confidenceLabel: 'Verlässlichkeit: {{confidence}}.',
      confidence: {
        rough: 'grob',
        low: 'niedrig',
        medium: 'mittel',
      },
      basedOn: 'Basierend auf {{count}} abgeschlossenen Zyklusabständen.',
      basedOn_one: 'Basierend auf {{count}} abgeschlossenen Zyklusabstand.',
      basedOn_other: 'Basierend auf {{count}} abgeschlossenen Zyklusabständen.',
      typicalSource: 'Diese grobe Schätzung verwendet deine optionale übliche Zykluslänge.',
      duration: 'Geschätzte Blutungsdauer in Tagen: {{count}}.',
      variable:
        'Die letzten Zykluslängen schwanken stark. Deshalb werden Kalenderschätzungen ausgeblendet, der Textzeitraum bleibt aber sichtbar.',
      late: 'Diese Schätzung liegt nun hinter ihrem ursprünglichen Zeitraum. Sie wurde nicht automatisch nach vorn verschoben.',
    },
    dayDetail: {
      title: 'Täglicher Check-in',
      close: 'Täglichen Check-in schließen',
      quickActionsTitle: 'Periodenaktionen',
      periodActions: {
        start: {
          label: 'Periode beginnen',
          description: 'Eine Periode mit diesem Startdatum anlegen.',
        },
        continue: {
          label: 'Periodentag eintragen',
          description: 'Dieses Datum mit der aktiven Periode verknüpfen.',
        },
        end: {
          label: 'Periode hier beenden',
          description: 'Dieses Datum als einschließlich letzten Tag verwenden.',
        },
        remove: {
          label: 'Diese Periode entfernen',
          description: 'Die gesamte Periode entfernen und andere Check-in-Werte behalten.',
        },
      },
      flowLegend: 'Blutungsstärke',
      flowOptions: {
        none: 'Keine',
        spotting: 'Schmierblutung',
        light: 'Leicht',
        medium: 'Mittel',
        heavy: 'Stark',
      },
      ratings: {
        confidence: 'Selbstvertrauen',
        tension: 'Anspannung',
        energy: 'Energie',
        pain: 'Schmerzen',
        clear: 'Bewertung löschen',
        option: '{{legend}}: {{rating}} von 5',
      },
      noteLabel: 'Private Notiz',
      noteDescription: 'Optional. Wird nur in deinem lokalen Tagebuch gespeichert.',
      save: 'Check-in speichern',
      saving: 'Wird gespeichert…',
      removePeriodConfirmation:
        'Diese gesamte Periode entfernen? Check-in-Werte ohne Bezug dazu bleiben erhalten.',
      confirmRemovePeriod: 'Periode entfernen',
      cancelRemovePeriod: 'Periode behalten',
      deleteEntry: 'Check-in löschen',
      deleteConfirmation: 'Check-in-Werte für dieses Datum löschen?',
      confirmDelete: 'Check-in löschen',
      deleting: 'Wird gelöscht…',
      cancelDelete: 'Abbrechen',
      errors: {
        future: 'Zukünftige Daten können keine aufgezeichneten Check-ins enthalten.',
        startFlow:
          'Wähle eine leichte, mittlere oder starke Blutung, bevor du eine Periode beginnst.',
        historicalStart:
          'Eine neue offene Periode kann nicht vor einer später aufgezeichneten Periode beginnen. Historische Grenzen können noch nicht bearbeitet werden.',
        laterPeriodDays:
          'Für diese Periode sind Tage nach diesem Datum eingetragen. Entferne diese Einträge, bevor du sie hier beendest.',
        periodConflict:
          'Diese Periodenänderung steht im Konflikt mit einer anderen Periode. Korrigiere zuerst die vorhandenen Daten.',
        noActivePeriod: 'Es gibt keine aktive Periode zum Fortsetzen oder Beenden.',
        startLog: 'Entferne die Periode, bevor du den Check-in ihres Starttags löschst.',
        saveFailed:
          'Die Änderung konnte nicht gespeichert werden. Dein bestehendes Tagebuch wurde nicht verändert.',
      },
      status: {
        saved: 'Check-in gespeichert.',
        deleted: 'Check-in gelöscht.',
        started: 'Periode begonnen.',
        continued: 'Periodentag eingetragen.',
        ended: 'Periode beendet.',
        removed: 'Periode entfernt.',
      },
    },
    settings: {
      sectionLabel: 'Tracking-Einstellungen',
      title: 'Schätzungen und Check-in-Fenster',
      description:
        'Diese Einstellungen beeinflussen nur Schätzungen. Deine Aufzeichnungen werden nie verändert.',
      typicalCycleLength: 'Übliche Zykluslänge in Tagen',
      typicalBleedDuration: 'Übliche Blutungsdauer in Tagen',
      orangeEnabled: 'Mögliche Check-in-Tage vor der Periode anzeigen',
      orangeDays: 'Länge des Check-in-Fensters',
      forecastingPaused: 'Schätzungen und geschätzte Kalendermarkierungen pausieren',
      optionalNumber: 'Optionale ganze Zahl',
      orangeRange: 'Wähle 1 bis 14 Tage.',
      save: 'Tracking-Einstellungen speichern',
      saving: 'Einstellungen werden gespeichert…',
      saved: 'Tracking-Einstellungen gespeichert.',
      failed: 'Die Tracking-Einstellungen konnten nicht gespeichert werden.',
    },
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
