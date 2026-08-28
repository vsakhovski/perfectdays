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
      splash: {
        appName: 'My Perfect Days',
        tagline: 'Ein privater Ort für deine Zyklusmuster.',
        version: 'Version {{version}}',
      },
      introduction: {
        title: 'Verstehe deinen Zyklus – privat',
        description:
          'Diese App hilft dir, deine Zyklen zu erfassen, den möglichen Beginn deiner nächsten Periode einzuschätzen und ein privates Tagebuch deiner eigenen Beobachtungen zu führen.',
        privacyTitle: 'Du behältst die Kontrolle über deine Daten',
        privacyDescription:
          'Dein Tagebuch bleibt standardmäßig auf diesem Gerät – ohne Konto, Werbung oder Analyse. Eine optionale PIN kann es im Speicher verschlüsseln; ohne PIN sind lokale Daten nicht verschlüsselt.',
      },
      history: {
        title: 'Frühere Perioden',
        description:
          'Schätzungen beruhen auf früheren Periodenstarts. Füge frühere Perioden hinzu, wenn dir diese Daten vorliegen. Trage ein Enddatum nur ein, wenn du es kennst.',
        empty: 'Noch keine frühere Periode hinzugefügt.',
        startDate: 'Startdatum',
        endDate: 'Enddatum (optional)',
        add: 'Periode hinzufügen',
        entryLabel: 'Frühere Periode {{position}}',
        removeEntry: 'Frühere Periode {{position}} entfernen',
        datePicker: {
          chooseDate: 'Datum auswählen',
          previousMonth: 'Vorheriger Monat',
          nextMonth: 'Nächster Monat',
          calendarLabel: '{{field}} auswählen. {{month}}',
        },
        editor: {
          saveStartOnly: 'Nur Startdatum speichern',
          configureStartOnlyDescription:
            'Dieses Startdatum speichern, ohne ein unbekanntes Enddatum zu erfinden?',
          deleteTitle: 'Frühere Periode {{range}} entfernen?',
          deleteDescription:
            'Dadurch wird die frühere Periode aus deinen Einrichtungsdaten entfernt.',
        },
      },
      fallbacks: {
        title: 'Optionale Periodenschätzungen',
        description:
          'Sie werden nur verwendet, solange nicht genügend aufgezeichnete Daten vorliegen. Aufzeichnungen haben immer Vorrang.',
        cycleLength: 'Übliche Zykluslänge in Tagen',
        cycleLengthDescription:
          'Optional. Verwende Minus und Plus oder gib einen anderen Wert ein.',
        bleedDuration: 'Übliche Blutungsdauer in Tagen',
        bleedDurationDescription:
          'Optional. Verwende Minus und Plus oder gib einen anderen Wert ein.',
        notSure: 'Nicht sicher',
        decrease: '{{field}} verringern',
        increase: '{{field}} erhöhen',
        quickChoices: 'Schnellwerte für {{field}}',
      },
      orange: {
        title: 'Möglicher Zeitraum vor der Periode',
        description:
          'Diese optionale Markierung hebt Tage vor der geschätzten Periode hervor. Sie sagt weder Konflikte voraus noch gibt sie Entscheidungen vor.',
        enabled: 'Möglichen Zeitraum vor der Periode anzeigen',
        days: 'Tage vor der zentralen Schätzung',
        daysDescription: 'Verwende Minus und Plus oder gib 1 bis 14 Tage ein.',
        decrease: 'Tage vor der Schätzung verringern',
        increase: 'Tage vor der Schätzung erhöhen',
        quickChoices: 'Schnellwerte für Tage vor der Schätzung',
      },
      pin: {
        title: 'Schütze dein privates Tagebuch',
        description:
          'Lege optional eine sechsstellige PIN fest. Sie verschlüsselt das in diesem Browser gespeicherte Tagebuch und sperrt die App, wenn sie geschlossen oder im Hintergrund gelassen wird. Die PIN kann nicht wiederhergestellt werden.',
        pinLabel: 'Gib eine sechsstellige PIN ein',
        confirmationLabel: 'Bitte wiederhole die PIN',
        showPin: '{{field}} anzeigen',
        hidePin: '{{field}} verbergen',
        enable: 'PIN aktivieren',
        keypadLabel: 'PIN-Ziffernblock',
        deleteDigit: 'Letzte PIN-Ziffer löschen',
        placeholder: '******',
        unavailable:
          'PIN-Schutz ist in diesem Browser oder über diese Verbindung nicht verfügbar. Du kannst die Einrichtung abschließen und ihn später unter Datenschutz in einem unterstützten sicheren Browser aktivieren.',
        enabled:
          'PIN-Schutz ist aktiviert. Schließe die Einrichtung ab, um den Kalender zu öffnen.',
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
        pinSixDigits: 'Gib in beide Felder eine sechsstellige PIN ein.',
        pinMismatch: 'Die PINs stimmen nicht überein.',
        pinFailed:
          'Der PIN-Schutz konnte nicht aktiviert werden. Dein Tagebuch wurde nicht verändert.',
      },
      actions: {
        back: 'Zurück',
        skip: 'Einrichtung überspringen',
        start: 'Loslegen',
        next: 'Weiter',
        finishWithoutPin: 'Ohne PIN abschließen',
        enablePinAndFinish: 'PIN aktivieren und abschließen',
        enablingPin: 'PIN wird aktiviert…',
        finish: 'Einrichtung abschließen',
        completing: 'Einrichtung wird gespeichert…',
        progress: 'Schritt {{current}} von {{total}}',
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
        predictedStart: 'Wahrscheinlichster Beginn.',
        possibleStart: 'Möglicher Periodenbeginn.',
        orange: 'Möglicher Zeitraum vor der Periode.',
        green: 'Höheres Selbstvertrauen aufgezeichnet.',
        spotting: 'Schmierblutung aufgezeichnet.',
        neutral: 'Keine Markierung aufgezeichnet.',
      },
      markerConfidence: {
        predictedRed: 'Geschätzter Periodentag. Prognosesicherheit: {{confidence}}.',
        activePredictedRed:
          'Geschätzter verbleibender Periodentag auf Grundlage der aufgezeichneten oder üblichen Blutungsdauer.',
        possibleStart: 'Möglicher Periodenbeginn. Prognosesicherheit: {{confidence}}.',
        orange: 'Möglicher Zeitraum vor der Periode. Prognosesicherheit: {{confidence}}.',
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
    insights: {
      sectionLabel: 'Einblicke',
      title: 'Aktuelle Muster aus deinem Tagebuch',
      description:
        'Diese Zusammenfassungen verwenden bis zu sechs aktuelle Aufzeichnungen. Sie beschreiben deinen Verlauf, nicht jeden Zyklus oder künftigen Tag.',
      noRecords: 'Noch nicht genügend Verlauf aufgezeichnet.',
      cycles: {
        title: 'Letzte Zykluslängen',
        description: 'Tage zwischen aufeinanderfolgenden aufgezeichneten Periodenstarts.',
        days: '{{count}} Tage',
        days_one: '{{count}} Tag',
        days_other: '{{count}} Tage',
      },
      bleeding: {
        title: 'Bekannte Blutungsdauern',
        description: 'Einbezogen werden nur beendete Perioden mit bekanntem Enddatum.',
        days: '{{count}} Tage',
        days_one: '{{count}} Tag',
        days_other: '{{count}} Tage',
      },
      greenDays: {
        title: 'Letzte Tage mit höherem Selbstvertrauen',
        description:
          'Einbezogen werden nur Tage, an denen du ausdrücklich Selbstvertrauen 4 oder 5 eingetragen hast.',
        count: '{{count}} aktuelle Einträge',
        count_one: '{{count}} aktueller Eintrag',
        count_other: '{{count}} aktuelle Einträge',
        confidence: 'Selbstvertrauen {{rating}} von 5',
      },
      forecast: {
        title: 'Warum diese Schätzung so aussieht',
        description:
          'Dies erklärt die aktuelle deterministische Schätzung; es ist kein Maß für klinische Genauigkeit.',
        unavailable: 'Es gibt derzeit keine Schätzung, die erklärt werden kann.',
        confidenceLabel: 'Verlässlichkeit',
        sourceLabel: 'Quelle der Zykluslänge',
        source: {
          recorded: 'Letzte aufgezeichnete Periodenstarts',
          typical: 'Deine optionale übliche Zykluslänge',
        },
        cyclesUsedLabel: 'Verwendete aufgezeichnete Zyklen',
        cyclesUsed: '{{count}} Zyklen',
        cyclesUsed_one: '{{count}} Zyklus',
        cyclesUsed_other: '{{count}} Zyklen',
        variabilityLabel: 'Letzte Schwankung',
        variability: {
          unavailable: 'Noch nicht genügend Zykluslängen aufgezeichnet',
          narrow: 'Die letzten Zykluslängen unterscheiden sich um höchstens 4 Tage',
          variable: 'Die letzten Zykluslängen unterscheiden sich um 5 bis 10 Tage',
          highlyVariable: 'Die letzten Zykluslängen unterscheiden sich um mehr als 10 Tage',
        },
        spanLabel: 'Unterschied zwischen kürzester und längster Dauer',
        span: '{{count}} Tage',
        span_one: '{{count}} Tag',
        span_other: '{{count}} Tage',
      },
    },
    history: {
      sectionLabel: 'Periodenverlauf',
      title: 'Aufgezeichnete Perioden',
      description:
        'Hier kannst du aufgezeichnete Perioden überprüfen, bearbeiten, löschen oder hinzufügen.',
      empty: 'Noch keine Periode aufgezeichnet.',
      active: 'Aktive Periode',
      completed: 'Beendet; Dauer bekannt',
      unknownDuration: 'Start aufgezeichnet; Dauer unbekannt',
      startIntensityLabel: 'Blutung am Starttag:',
      startIntensity: {
        unspecified: 'Nicht angegeben',
        light: 'Leicht',
        medium: 'Mittel',
        heavy: 'Stark',
      },
      edit: 'Daten bearbeiten',
      editLabel: 'Periode ab {{date}} auswählen',
      showMore: 'Mehr anzeigen',
      bleedingDuration: 'Blutungsdauer: {{count}} Tage',
      bleedingDuration_one: 'Blutungsdauer: {{count}} Tag',
      bleedingDuration_other: 'Blutungsdauer: {{count}} Tage',
      cycleLength: 'Zykluslänge: {{count}} Tage',
      cycleLength_one: 'Zykluslänge: {{count}} Tag',
      cycleLength_other: 'Zykluslänge: {{count}} Tage',
      cycleChecks: {
        title: 'Überprüfung erforderlich',
        description:
          'Zyklusprüfungen weisen auf Einträge hin, die Schätzungen beeinflussen können. Dein Tagebuch wird nie automatisch geändert.',
        interval: '{{from}} bis {{to}}',
        possibleMissing: {
          title: 'Im Tagebuch könnte eine Periode fehlen',
          description:
            'Dieses Intervall ist ungefähr {{count}}-mal so lang wie deine letzten Zyklen. Prüfe, ob eine Periode nicht aufgezeichnet wurde.',
          chooseDate:
            'Wähle den aufgezeichneten Beginn im Kalender. Es wird keine Periode hinzugefügt, bevor du beide Daten ausgewählt und bestätigt hast.',
        },
        possiblyStaleActive: {
          title: 'Ist diese Periode noch aktiv?',
          description:
            'Diese Periode ist seit {{count}} Tagen aktiv. Prüfe, ob sie noch aktiv ist oder ihr Enddatum korrigiert werden muss.',
          description_one:
            'Diese Periode ist seit {{count}} Tag aktiv. Prüfe, ob sie noch aktiv ist oder ihr Enddatum korrigiert werden muss.',
          description_other:
            'Diese Periode ist seit {{count}} Tagen aktiv. Prüfe, ob sie noch aktiv ist oder ihr Enddatum korrigiert werden muss.',
        },
        possibleSplit: {
          title: 'Zwei Perioden liegen sehr nah beieinander',
          description:
            'Zwischen diesen Perioden liegen nur {{count}} blutungsfreie Tage. Prüfe, ob beide Einträge stimmen.',
          description_zero:
            'Zwischen diesen Perioden liegt kein blutungsfreier Tag. Prüfe, ob beide Einträge stimmen.',
          description_one:
            'Zwischen diesen Perioden liegt nur {{count}} blutungsfreier Tag. Prüfe, ob beide Einträge stimmen.',
          description_other:
            'Zwischen diesen Perioden liegen nur {{count}} blutungsfreie Tage. Prüfe, ob beide Einträge stimmen.',
        },
        actions: {
          addMissingPeriod: 'Fehlende Periode hinzufügen',
          reviewActivePeriod: 'Periodendaten prüfen',
          stillActive: 'Sie ist noch aktiv',
          reviewDates: 'Aufgezeichnete Daten prüfen',
          keepAndUse: 'Behalten und für Schätzungen verwenden',
          keepAndExclude: 'Behalten, aber aus Schätzungen ausschließen',
          useAgain: 'Wieder verwenden',
        },
        excluded: {
          title: 'Nicht für Schätzungen verwendet',
          description:
            'Die aufgezeichneten Perioden bleiben im Tagebuch. Nur diese Zykluslänge wird aus den Schätzungen ausgeschlossen.',
        },
        savedIncluded: 'Diese Zykluslänge wird für Schätzungen verwendet.',
        savedExcluded: 'Diese Zykluslänge wird nicht für Schätzungen verwendet.',
        savedStillActive:
          'Diese Periode bleibt aktiv. Die Prüfung erscheint erneut, wenn der Eintrag geändert wird.',
        saveFailed:
          'Die Entscheidung konnte nicht gespeichert werden. Dein Tagebuch wurde nicht geändert.',
      },
      estimate: {
        title: 'Nächste Periode',
        rangeLabel: 'Geschätzter Startzeitraum',
        centralStartLabel: 'Wahrscheinlichster Beginn',
        durationLabel: 'Geschätzte Blutungsdauer',
        explanationTitle: 'Warum diese Schätzung?',
        explanation:
          'Der wahrscheinlichste Beginn verwendet den mittleren Wert deiner letzten abgeschlossenen Zykluslängen. Unterschiede zwischen diesen Zyklen bestimmen, wie breit der geschätzte Zeitraum ist. Die geschätzte Periodenlänge verwendet den mittleren Wert deiner abgeschlossenen aufgezeichneten Perioden. Wenn noch nicht genügend Daten vorliegen, werden deine optionalen Startschätzungen verwendet.',
        basedOnLabel: 'Basiert auf',
        basedOnRecorded: '{{count}} abgeschlossenen Zyklen',
        basedOnRecorded_one: '{{count}} abgeschlossenem Zyklus',
        basedOnRecorded_other: '{{count}} abgeschlossenen Zyklen',
        basedOnReviewed: '{{used}} von {{available}} letzten Zyklen',
        basedOnTypical: 'Deiner optionalen Startschätzung',
        pendingReview:
          '{{count}} letzter Zyklus muss geprüft werden und wird derzeit nicht für diese Schätzung verwendet.',
        pendingReview_one:
          '{{count}} letzter Zyklus muss geprüft werden und wird derzeit nicht für diese Schätzung verwendet.',
        pendingReview_other:
          '{{count}} letzte Zyklen müssen geprüft werden und werden derzeit nicht für diese Schätzung verwendet.',
        excluded:
          '{{count}} geprüfter Zyklus ist von dieser Schätzung ausgeschlossen. Du kannst dies im Periodenverlauf ändern.',
        excluded_one:
          '{{count}} geprüfter Zyklus ist von dieser Schätzung ausgeschlossen. Du kannst dies im Periodenverlauf ändern.',
        excluded_other:
          '{{count}} geprüfte Zyklen sind von dieser Schätzung ausgeschlossen. Du kannst dies im Periodenverlauf ändern.',
        reviewRequired:
          'Zwei kürzlich aufgezeichnete Perioden müssen geprüft werden, bevor sie eine neue Schätzung verankern können. Öffne den Periodenverlauf, um sie zu prüfen.',
        recentCycleLengths: 'Letzte Zykluslängen',
        recentCycleLengthsValue: '{{lengths}} Tage',
        estimatedCycleLength: 'Geschätzte Zykluslänge',
        consistency: {
          unavailable:
            'Es gibt noch nicht genügend aufgezeichnete Zyklen, um ihre Regelmäßigkeit zu beschreiben.',
          consistent: 'Deine letzten Zyklen waren weitgehend regelmäßig.',
          variable:
            'Deine letzten Zykluslängen schwanken, daher ist der geschätzte Zeitraum breiter.',
          highlyVariable:
            'Deine letzten Zykluslängen schwanken deutlich, daher ist der geschätzte Zeitraum breiter.',
        },
        estimatedPeriodLength: 'Geschätzte Periodenlänge',
      },
      calendar: {
        label: 'Kalender der aufgezeichneten Perioden',
        legend: 'Hintergrundfarben',
        cancel: 'Abbrechen',
        selectBoundary: 'Wähle das Start- und Enddatum dieser Periode.',
        firstBoundary: 'Erste Grenze gewählt. Wähle die andere Grenze.',
        newFirstBoundary: 'Grenze der neuen Periode gewählt. Wähle die andere Grenze.',
        selectEndBoundary: 'Wähle ein Enddatum nach dem ausgewählten Startdatum.',
        endAfterStart: 'Das Enddatum muss nach dem ausgewählten Startdatum liegen.',
        selectedPeriod: 'Periode {{range}}',
        emptyDate: '{{date}} gehört zu keiner aufgezeichneten Periode',
        emptyDateDescription:
          'Verwende dieses Datum als Start einer neuen Periode und wähle danach ihr Enddatum.',
        addStartingHere: 'Neue Periode hier beginnen',
        selectedStart: 'Gewähltes Startdatum der Periode',
        selectedEnd: 'Gewähltes Enddatum der Periode',
        selectedRange: 'Innerhalb des gewählten Periodenzeitraums',
        saved: 'Periodendaten aktualisiert.',
        added: 'Neue Periode hinzugefügt.',
        configure: {
          title: 'Periode {{range}} konfigurieren',
          description: 'Diese Start- und Enddaten für die Periode speichern?',
          save: 'Periode speichern',
          saving: 'Periode wird gespeichert…',
          cancel: 'Abbrechen',
        },
      },
      delete: {
        action: 'Periode löschen',
        label: 'Periode {{date}} löschen',
        title: 'Periode {{range}} löschen?',
        description:
          'Dadurch wird die gesamte aufgezeichnete Periode entfernt. Bewertungen, Notizen und andere unabhängige tägliche Beobachtungen bleiben erhalten.',
        confirm: 'Periode löschen',
        deleting: 'Periode wird gelöscht…',
        cancel: 'Abbrechen',
        deleted: 'Periode gelöscht.',
      },
      correction: {
        title: 'Periodendaten korrigieren',
        close: 'Korrektur der Periodendaten schließen',
        explanation: 'Passe diese Periode an, ohne die Grenzen einer anderen zu verändern.',
        consequence:
          'Beim Verschieben, Verkürzen oder Markieren eines unbekannten Endes werden alte Periodenverknüpfungen und reine Blutungsangaben außerhalb der korrigierten Daten entfernt. Die gewählte Blutungsstärke ersetzt Angaben am korrigierten Startdatum; andere Bewertungen und Notizen bleiben erhalten.',
        startDate: 'Startdatum',
        endDate: 'Einschließliches Enddatum',
        endDateDescription: 'Wird nur verwendet, wenn du ein bekanntes Enddatum auswählst.',
        endState: 'Periodenende',
        endStateOptions: {
          known: {
            label: 'Beendet — Datum bekannt',
            description: 'Diese Periode fließt in Zusammenfassungen der Blutungsdauer ein.',
          },
          unknown: {
            label: 'Beendet — Datum unbekannt',
            description: 'Als reinen Starteintrag behalten, ohne eine Dauer zu erfinden.',
          },
          active: {
            label: 'Noch aktiv',
            description: 'Diese Periode hat noch kein Enddatum.',
          },
        },
        startIntensity: 'Blutung am Starttag',
        validation: {
          startRequired: 'Gib ein Startdatum ein.',
          endRequired: 'Gib ein Enddatum ein oder wähle ein unbekanntes oder aktives Ende.',
          endBeforeStart: 'Das Enddatum darf nicht vor dem Startdatum liegen.',
          futureDate: 'Periodendaten dürfen nicht in der Zukunft liegen.',
          startIntensityRequired: 'Wähle die Blutungsstärke für das korrigierte Startdatum.',
        },
        save: 'Korrigierte Daten speichern',
        saving: 'Korrektur wird gespeichert…',
        cancel: 'Abbrechen',
        errors: {
          overlap: 'Diese Daten überschneiden sich mit einer anderen aufgezeichneten Periode.',
          activeConflict: 'Eine andere Periode ist bereits aktiv.',
          missing:
            'Diese Periode existiert nicht mehr. Schließe den Dialog und versuche es erneut.',
          failed:
            'Die Korrektur konnte nicht gespeichert werden. Dein bestehendes Tagebuch wurde nicht verändert.',
        },
        saved: 'Periodendaten korrigiert.',
      },
    },
    dayDetail: {
      title: 'Täglicher Check-in',
      close: 'Täglichen Check-in schließen',
      quickActionsTitle: 'Periode',
      periodActions: {
        start: {
          label: 'Periode beginnen',
          description: 'Die Periode beginnt an diesem Tag.',
        },
        continue: {
          label: 'Periodentag eintragen',
          description: 'Die Periode dauert an diesem Tag an.',
        },
        end: {
          label: 'Periode hier beenden',
          description: 'Die Periode endet an diesem Tag.',
        },
        remove: {
          label: 'Diese Periode entfernen',
          description: 'Die gesamte Periode entfernen und andere Check-in-Werte behalten.',
        },
      },
      periodEndsBeforeDay:
        'Wenn du „Keine“ speicherst, wird der vorherige Tag als letzter Periodentag markiert.',
      extendPeriod: {
        title: 'Aufgezeichnete Periode erweitern?',
        startDescription:
          'Zwischen diesem Check-in und der ab {{periodStart}} aufgezeichneten Periode liegen {{count}} blutungsfreie Tage. Soll diese Periode bereits am {{checkInDate}} beginnen?',
        startDescription_zero:
          'Dieser Check-in liegt direkt vor der ab {{periodStart}} aufgezeichneten Periode. Soll diese Periode bereits am {{checkInDate}} beginnen?',
        startDescription_one:
          'Zwischen diesem Check-in und der ab {{periodStart}} aufgezeichneten Periode liegt {{count}} blutungsfreier Tag. Soll diese Periode bereits am {{checkInDate}} beginnen?',
        startDescription_other:
          'Zwischen diesem Check-in und der ab {{periodStart}} aufgezeichneten Periode liegen {{count}} blutungsfreie Tage. Soll diese Periode bereits am {{checkInDate}} beginnen?',
        endDescription:
          'Zwischen der bis {{periodEnd}} aufgezeichneten Periode und diesem Check-in liegen {{count}} blutungsfreie Tage. Soll diese Periode bis {{checkInDate}} verlängert werden?',
        endDescription_zero:
          'Dieser Check-in liegt direkt nach der bis {{periodEnd}} aufgezeichneten Periode. Soll diese Periode bis {{checkInDate}} verlängert werden?',
        endDescription_one:
          'Zwischen der bis {{periodEnd}} aufgezeichneten Periode und diesem Check-in liegt {{count}} blutungsfreier Tag. Soll diese Periode bis {{checkInDate}} verlängert werden?',
        endDescription_other:
          'Zwischen der bis {{periodEnd}} aufgezeichneten Periode und diesem Check-in liegen {{count}} blutungsfreie Tage. Soll diese Periode bis {{checkInDate}} verlängert werden?',
        confirm: 'Periode erweitern und speichern',
        cancel: 'Abbrechen',
      },
      historicalPeriodEnd: {
        title: 'Letzten Periodentag auswählen',
        description:
          'Wenn die Periode am {{startDate}} beginnt, würden sonst alle Tage bis heute als Teil einer aktiven Periode markiert. Das ist länger als die derzeit erwartete Dauer. Wähle den tatsächlichen letzten Tag aus.',
        label: 'Enddatum der Periode',
        confirm: 'Abgeschlossene Periode speichern',
        cancel: 'Abbrechen',
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
        option: '{{legend}}: {{rating}} von 5',
      },
      noteLabel: 'Private Notiz',
      noteDescription: 'Wird nur in deinem lokalen Tagebuch gespeichert.',
      save: 'Check-in speichern',
      saving: 'Wird gespeichert…',
      removePeriodConfirmation:
        'Diese gesamte Periode entfernen? Check-in-Werte ohne Bezug dazu bleiben erhalten.',
      confirmRemovePeriod: 'Periode entfernen',
      cancelRemovePeriod: 'Periode behalten',
      deleteEntry: 'Gespeicherten Check-in löschen',
      deleteConfirmation: 'Check-in-Werte für dieses Datum löschen?',
      confirmDelete: 'Check-in löschen',
      deleting: 'Wird gelöscht…',
      cancelDelete: 'Abbrechen',
      errors: {
        future: 'Zukünftige Daten können keine aufgezeichneten Check-ins enthalten.',
        startFlow:
          'Wähle eine leichte, mittlere oder starke Blutung, bevor du eine Periode beginnst.',
        historicalStart:
          'Dieser Tag liegt zu weit vor der später aufgezeichneten Periode, um sie zu erweitern. Korrigiere die Daten im Periodenverlauf.',
        laterPeriodDays:
          'Für diese Periode sind Tage nach diesem Datum eingetragen. Entferne diese Einträge, bevor du sie hier beendest.',
        noneRequiresPeriodCorrection:
          'Mit „Keine“ können eine abgeschlossene Periode oder spätere eingetragene Periodentage nicht geändert werden. Korrigiere die Periodendaten im Periodenverlauf.',
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
      title: 'Schätzungen und Zeitraum vor der Periode',
      description:
        'Diese Einstellungen beeinflussen nur Schätzungen. Deine Aufzeichnungen werden nie verändert.',
      typicalCycleLength: 'Übliche Zykluslänge in Tagen',
      typicalBleedDuration: 'Übliche Blutungsdauer in Tagen',
      orangeEnabled: 'Mögliche Tage vor der Periode anzeigen',
      orangeDays: 'Länge des Zeitraums vor der Periode',
      forecastingPaused: 'Schätzungen und geschätzte Kalendermarkierungen pausieren',
      optionalNumber: 'Optionale ganze Zahl',
      orangeRange: 'Wähle 1 bis 14 Tage.',
      save: 'Tracking-Einstellungen speichern',
      saving: 'Einstellungen werden gespeichert…',
      saved: 'Tracking-Einstellungen gespeichert.',
      failed: 'Die Tracking-Einstellungen konnten nicht gespeichert werden.',
    },
  },
  mobile: {
    shell: {
      navigation: {
        label: 'Hauptnavigation',
        calendar: 'Kalender',
        history: 'Verlauf',
        privacy: 'Datenschutz',
        settings: 'Einstellungen',
      },
      actions: {
        checkInToday: 'Heute eintragen',
        editTodayCheckIn: 'Heutigen Check-in bearbeiten',
        checkInFor: 'Am {{date}} eintragen',
        editCheckInFor: 'Eintrag für {{date}} bearbeiten',
        lock: 'Sperren',
      },
    },
    calendar: {
      title: 'Kalender',
      description: 'Aufzeichnungen, Schätzungen und der heutige Tag auf einen Blick.',
      navigation: {
        label: 'Monatsnavigation des Kalenders',
        previousMonth: 'Vorheriger Monat',
        nextMonth: 'Nächster Monat',
        today: 'Heute',
        goToToday: 'Heute anzeigen',
      },
      legend: {
        title: 'Hintergrundfarben',
        recorded: 'Aufgezeichnete Periode',
        predicted: 'Geschätzte Periode',
        today: 'Heute',
        showGuide: 'Markierungsübersicht anzeigen',
        hideGuide: 'Markierungsübersicht ausblenden',
        guideTitle: 'Erklärung der Markierungen',
        markers: {
          recorded: 'Durchgehendes Band: aufgezeichnete Periode.',
          predicted: 'Gestreiftes Band: geschätzte Periode.',
          possibleStart: 'Umrandung: möglicher Periodenbeginn.',
          checkInWindow: 'Bernsteinfarbener Balken: möglicher Zeitraum vor der Periode.',
          higherConfidence: 'Grüne Markierung: höheres Selbstvertrauen aufgezeichnet.',
          spotting: 'Punkt: Schmierblutung aufgezeichnet.',
        },
      },
      forecast: {
        title: 'Nächste Periode',
        range: 'Möglicher Beginn: {{range}}.',
        basis: 'Verlässlichkeit: {{confidence}} · basierend auf {{count}} abgeschlossenen Zyklen.',
        basis_one:
          'Verlässlichkeit: {{confidence}} · basierend auf {{count}} abgeschlossenem Zyklus.',
        basis_other:
          'Verlässlichkeit: {{confidence}} · basierend auf {{count}} abgeschlossenen Zyklen.',
        why: 'Warum diese Schätzung?',
        states: {
          active: {
            title: 'Die aktuelle Periode ist aktiv',
            description: 'Der nächste geschätzte Beginn ist noch nicht verfügbar.',
            nextEstimatedStart: 'Die nächste Periode beginnt ungefähr am {{date}}.',
          },
          unavailable: {
            title: 'Keine Schätzung verfügbar',
            description:
              'Füge mindestens zwei Periodenstarts oder eine übliche Zykluslänge hinzu, um eine Schätzung zu sehen.',
          },
          paused: {
            title: 'Schätzung pausiert',
            description: 'Aufgezeichnete Tage bleiben sichtbar.',
          },
          variable: {
            title: 'Zykluslängen schwanken stark',
            description:
              'Der geschätzte Startzeitraum bleibt verfügbar, aber Prognosefarben werden ausgeblendet.',
          },
          late: {
            title: 'Ursprünglicher Schätzzeitraum überschritten',
            description:
              'Der ursprüngliche Zeitraum bleibt bestehen und wird nicht automatisch nach vorn verschoben.',
          },
        },
      },
      context: {
        navigationLabel: 'Kalenderdetails',
        insights: 'Einblicke',
        periodHistory: 'Periodenverlauf',
        backToCalendar: 'Zurück zum Kalender',
      },
      day: {
        title: 'Details für {{date}}',
        recorded: 'Aufgezeichnete Beobachtungen',
        forecast: 'Schätzung für dieses Datum',
        edit: 'Diesen Tag bearbeiten',
        future: 'Zukünftige Daten können nur angesehen werden.',
        close: 'Tagesdetails schließen',
      },
      selectedDay: {
        title: '{{date}}',
        titleToday: '{{date}} (heute)',
        selected: 'Ausgewählter Kalendertag',
        periodKnown: 'Periode: {{range}}.',
        periodActive: 'Aktive Periode, begonnen am {{date}}.',
        periodUnknown: 'Periode begann am {{date}}; Enddatum unbekannt.',
        noCheckIn: 'Für diesen Tag wurde noch kein Check-in gespeichert.',
        flow: 'Blutung: {{flow}}',
        rating: '{{label}}: {{value}}',
        start: 'Für diesen Tag eintragen',
        startToday: 'Heute eintragen',
        edit: 'Check-in dieses Tages bearbeiten',
      },
    },
    privacy: {
      title: 'Datenschutz',
      sections: {
        protection: 'PIN-Schutz',
        portability: 'Sicherung und Export',
      },
      storage: {
        title: 'Tagebuchdaten',
        description:
          'Die Tagebuchdaten bleiben auf diesem Gerät, es sei denn, du exportierst eine Datei oder löschst die lokalen Daten.',
        downloads:
          'Heruntergeladene Sicherungen und Exporte liegen außerhalb der App und werden durch „Alles löschen“ nicht entfernt.',
      },
      danger: {
        title: 'Daten endgültig löschen',
        description:
          'Beim Löschen werden dieses Tagebuch und seine App-Einstellungen dauerhaft aus diesem Browser entfernt.',
      },
    },
    settings: {
      title: 'Einstellungen',
      description: 'Verwalte Schätzungen, Kalenderdarstellung, Design und Sprache.',
      cards: {
        theme: 'Design',
        language: 'Sprache',
        weekStart: 'Erster Tag der Woche',
      },
      sections: {
        tracking: 'Tracking und Schätzungen',
        appearance: 'Design, Sprache und Kalender',
      },
      prePeriod: {
        title: 'Zeitraum vor der Periode',
        description:
          'Hebt optionale Tage vor einer geschätzten Periode hervor, damit du deine eigenen Muster beobachten und festhalten kannst.',
        enabled: 'Zeitraum vor der Periode im Kalender anzeigen',
        days: 'Anzahl der Tage vor der Periode',
      },
      fallbacks: {
        title: 'Übliche Periodenschätzungen',
        description:
          'Diese optionalen Startwerte werden nur verwendet, bis deine aufgezeichneten Perioden dieselben Informationen liefern.',
        cycleLength: 'Übliche Zykluslänge',
        bleedDuration: 'Übliche Blutungstage',
        cycleOverridden:
          'Aufgezeichnete Zykluslängen bestimmen nun die Schätzung; dieser Startwert wird nicht mehr verwendet.',
        bleedOverridden:
          'Aufgezeichnete Blutungsdauern bestimmen nun die Schätzung; dieser Startwert wird nicht mehr verwendet.',
      },
      autoSave: {
        saving: 'Wird automatisch gespeichert…',
        saved: 'Automatisch gespeichert.',
        failed: 'Die Änderung konnte nicht gespeichert werden.',
      },
      about: {
        title: 'Über die App',
        version: 'Version {{version}}',
        description:
          'Perfect Days ist ein privates, lokal gespeichertes Tagebuch für Perioden, tägliche Beobachtungen und persönliche Schätzungen.',
        development:
          'Die App wird als installierbare Web-App mit Offline-Unterstützung und optionaler Verschlüsselung auf dem Gerät entwickelt.',
        limitationsTitle: 'Was dieses Tagebuch nicht bestimmen kann',
        limitations:
          'Schätzungen beschreiben Muster in aufgezeichneten Daten. Sie sind keine medizinische Beratung oder Diagnose.',
        authorTitle: 'Über den Autor',
        author:
          'Erstellt von einem unabhängigen Entwickler. Angaben zum Autor werden vor der öffentlichen Veröffentlichung ergänzt.',
        donate: 'Entwicklung mit PayPal unterstützen',
      },
    },
    checkIn: {
      title: 'Heute eintragen',
      editTitle: 'Heutigen Check-in bearbeiten',
      dayTitle: 'Check-in für diesen Tag',
      editDayTitle: 'Check-in dieses Tages bearbeiten',
      description:
        'Trage nur ein, was du heute bemerkst. Optionale Werte sind nicht vorausgewählt.',
      optional: {
        show: 'Notiz oder Details hinzufügen (optional)',
        hide: 'Notiz und Details ausblenden',
      },
      guidance: {
        chooseObservation: 'Wähle vor dem Speichern mindestens eine Beobachtung aus.',
        startPeriod: 'Eine leichte, mittlere oder starke Blutung kann eine Periode beginnen.',
        activePeriod:
          'Wenn du die heutige Blutung speicherst, wird die aktive Periode fortgeführt.',
        endPeriod: 'Wenn du „Keine“ speicherst, endet eine aktive Periode am vorherigen Tag.',
      },
      actions: {
        saveAndDone: 'Speichern und fertig',
        saving: 'Wird gespeichert…',
        startPeriodAndSave: 'Periode beginnen und speichern',
        startingAndSaving: 'Periode wird begonnen und gespeichert…',
        cancel: 'Abbrechen',
        close: 'Check-in schließen',
      },
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
      metaTitle: 'Perfect Days – gesperrt',
      metaDescription: 'Eine private lokale App ist gesperrt.',
      eyebrow: 'Perfect Days',
      title: 'Gesperrt',
      description: 'Gib deine sechsstellige PIN ein, um fortzufahren.',
      cryptoUnavailable:
        'Das Entsperren per PIN ist in diesem Browser oder über diese Verbindung nicht verfügbar. Deine gespeicherten Daten wurden nicht verändert. Öffne die App in einem unterstützten sicheren Browser, bevor du ein Zurücksetzen erwägst.',
      pinLabel: 'PIN',
      pinHint: 'Gib sechs Ziffern ein.',
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
    },
    backup: {
      title: 'Sichern oder wiederherstellen',
      description:
        'Verschlüsselte Sicherungen bleiben durch ihre Sicherungs-PIN geschützt. Heruntergeladene Dateien liegen außerhalb dieser App und werden durch „Alles löschen“ nicht entfernt.',
      locked:
        'Entsperre den lokalen Datentresor, bevor du Sicherungs- oder Wiederherstellungsfunktionen verwendest.',
      cryptoUnavailable:
        'Verschlüsselte Sicherung und Wiederherstellung sind nicht verfügbar, weil die sichere Browser-Verschlüsselung fehlt.',
      encrypted: {
        title: 'Verschlüsselte Sicherung',
        description:
          'Lade eine übertragbare verschlüsselte Kopie herunter. Sie bleibt durch die jetzt verwendete PIN geschützt, auch wenn du die App-PIN später änderst.',
        action: 'Verschlüsselte Sicherung exportieren',
        working: 'Verschlüsselte Sicherung wird vorbereitet…',
        pinRequired: 'Aktiviere den PIN-Schutz, bevor du eine verschlüsselte Sicherung erstellst.',
        enablePin: 'PIN-Schutz einrichten',
        enablingPin: 'PIN-Einrichtung wird geöffnet…',
      },
      plaintext: {
        title: 'Menschenlesbarer Export',
        reviewWarning: 'Lesbaren Export herunterladen',
        warningTitle: 'Diese Datei enthält lesbare sensible Daten',
        warning:
          'Jede Person mit Zugriff auf diese unverschlüsselte Datei kann alle Periodendaten, Bewertungen und privaten Notizen darin lesen. Bewahre und teile sie mit größter Sorgfalt. Dieser Export kann nicht zur Wiederherstellung deines Tagebuchs verwendet werden.',
        confirmation:
          'Ich verstehe, dass dieser Export nicht verschlüsselt ist und lesbare sensible Daten enthält.',
        action: 'Lesbare Daten exportieren',
        working: 'Lesbarer Export wird vorbereitet…',
        cancel: 'Lesbaren Export abbrechen',
        close: 'Dialog für menschenlesbaren Export schließen',
      },
      restore: {
        title: 'Verschlüsselte Sicherung wiederherstellen',
        description:
          'Wähle eine verschlüsselte JSON-Sicherung und gib die sechsstellige PIN ein, mit der diese Datei geschützt wurde.',
        warningTitle: 'Die wiederhergestellte Sicherung ersetzt das aktuelle Tagebuch',
        warning:
          'Datei und PIN werden geprüft, bevor sich etwas ändert. Eine erfolgreiche Wiederherstellung ersetzt dieses Tagebuch und verwendet die Sicherungs-PIN als Sperre. Darstellung und Sprache bleiben unverändert.',
        fileLabel: 'Verschlüsselte Sicherungsdatei',
        chooseFile: 'Sicherungsdatei auswählen',
        noFileSelected: 'Keine Sicherungsdatei ausgewählt.',
        selectedFile: 'Ausgewählte Sicherung: {{fileName}}',
        pinLabel: 'Sicherungs-PIN',
        pinHint: 'Gib die sechsstellige PIN ein, die beim Erstellen dieser Sicherung galt.',
        confirmation:
          'Ich verstehe, dass eine bestätigte Wiederherstellung mein aktuelles lokales Tagebuch ersetzt.',
        action: 'Aus ausgewählter Sicherung wiederherstellen',
        working: 'Verschlüsselte Sicherung wird geprüft…',
        clear: 'Wiederherstellung abbrechen',
        close: 'Wiederherstellungsdialog schließen',
        verifyPin: 'Sicherungs-PIN prüfen',
        verifyingPin: 'Sicherungs-PIN wird geprüft...',
        validation: {
          fileRequired: 'Wähle eine verschlüsselte JSON-Sicherung aus.',
          jsonRequired: 'Wähle eine Datei, deren Name auf .json endet.',
          fileTooLarge: 'Wähle eine Sicherung mit höchstens {{maximumMegabytes}} MB.',
          invalidBackup: 'Wähle eine gültige verschlüsselte JSON-Sicherung aus dieser App.',
          pinRequired: 'Gib die Sicherungs-PIN ein.',
          pinInvalid: 'Gib genau sechs Ziffern ein.',
          verificationFailed:
            'Die Sicherung oder PIN konnte nicht bestÃ¤tigt werden. Versuche es erneut.',
          confirmationRequired: 'Bestätige, dass das aktuelle Tagebuch ersetzt wird.',
        },
      },
      feedback: {
        encryptedDownloaded: 'Der Download der verschlüsselten Sicherung wurde gestartet.',
        plaintextDownloaded: 'Der Download des lesbaren Exports wurde gestartet.',
        restored:
          'Die verschlüsselte Sicherung wurde wiederhergestellt. Dieses Tagebuch ist jetzt durch die Sicherungs-PIN geschützt.',
        encryptedFailed:
          'Die verschlüsselte Sicherung konnte nicht erstellt werden. Dein Tagebuch wurde nicht verändert.',
        plaintextFailed:
          'Der lesbare Export konnte nicht erstellt werden. Dein Tagebuch wurde nicht verändert.',
        restoreFailed:
          'Die Sicherung konnte nicht wiederhergestellt werden. Prüfe Datei und Sicherungs-PIN. Dein aktuelles Tagebuch wurde nicht verändert.',
      },
    },
    security: {
      title: 'PIN-Schutz',
      description:
        'Eine PIN verschlüsselt das Tagebuch und sperrt es sofort, sobald die App in den Hintergrund wechselt.',
      cryptoUnavailable:
        'Der PIN-Schutz ist nicht verfügbar, weil dieser Browser oder diese Verbindung die Prüfung der sicheren Verschlüsselung nicht bestanden hat.',
      protected: {
        status: 'PIN-Schutz ist aktiviert',
      },
      unprotected: {
        status: 'PIN-Schutz ist deaktiviert',
        recommendation: 'PIN einrichten',
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
    weekStart: {
      label: 'Erster Tag der Woche',
      options: {
        system: 'Systemstandard',
        monday: 'Montag',
        sunday: 'Sonntag',
      },
      systemDefault: 'Dein aktueller Systemstandard ist {{day}}.',
      saving: 'Kalendereinstellung wird gespeichert…',
      saved: 'Kalendereinstellung gespeichert.',
      failed: 'Die Kalendereinstellung konnte nicht gespeichert werden.',
    },
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
      label: 'Sprache auswählen',
      options: {
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
