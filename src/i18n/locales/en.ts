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
  tracker: {
    onboarding: {
      title: 'Set up your private journal',
      introduction:
        'Add only what you know. Previous dates improve estimates, and optional estimate settings can be changed later.',
      history: {
        title: 'Previous periods',
        description:
          'Start dates build cycle history. Add an end date only when you know it; an omitted end will not be used as a bleeding-duration estimate.',
        empty: 'No previous periods added yet.',
        startDate: 'Start date',
        endDate: 'End date (optional)',
        add: 'Add previous period',
        entryLabel: 'Previous period {{position}}',
        removeEntry: 'Remove previous period {{position}}',
      },
      fallbacks: {
        title: 'Optional starting estimates',
        description:
          'These are used only while there is not enough recorded history. Recorded dates always take priority.',
        cycleLength: 'Usual cycle length in days',
        cycleLengthDescription: 'Optional. Many adult cycles vary from month to month.',
        bleedDuration: 'Usual bleeding duration in days',
        bleedDurationDescription: 'Optional. Leave blank when you are unsure.',
      },
      orange: {
        title: 'Possible pre-period check-in window',
        description:
          'This optional marker invites a personal check-in. It does not predict conflict or tell you what decisions to make.',
        enabled: 'Show the possible pre-period check-in window',
        days: 'Days before the central estimate',
        daysDescription: 'Choose from 1 to 14 days.',
      },
      validation: {
        startRequired: 'Add a start date or remove this row.',
        endBeforeStart: 'The end date cannot be before the start date.',
        duplicateStart: 'Each previous period needs a different start date.',
        overlappingHistory: 'Previous period ranges cannot overlap.',
        positiveInteger: 'Enter a whole number greater than zero.',
        cycleRange: 'Choose a whole number from 1 to 365 days.',
        bleedRange: 'Choose a whole number from 1 to 90 days.',
        orangeRange: 'Choose a whole number from 1 to 14.',
        futureDate: 'Future dates cannot be added to period history.',
      },
      actions: {
        skip: 'Finish without history',
        complete: 'Finish setup',
        completing: 'Saving setup…',
      },
      saveFailed: 'The setup could not be saved. Your existing journal was not changed.',
    },
    calendar: {
      sectionLabel: 'Calendar',
      title: 'Your recorded days and estimates',
      description:
        'Recorded observations are solid. Estimates are patterned or outlined and can change when history changes.',
      navigationLabel: 'Calendar month navigation',
      calendarLabel: 'Menstrual pattern calendar',
      previousMonth: 'Previous month',
      nextMonth: 'Next month',
      today: 'Today.',
      selected: 'Selected.',
      outsideMonth: 'Outside the displayed month.',
      future: 'Future date; check-ins are unavailable.',
      legendTitle: 'Calendar marker legend',
      markers: {
        recordedRed: 'Recorded period day.',
        predictedRed: 'Predicted period day.',
        predictedStart: 'Central predicted start.',
        possibleStart: 'Possible period start.',
        orange: 'Possible pre-period check-in window.',
        green: 'Higher confidence recorded.',
        spotting: 'Spotting recorded.',
        neutral: 'No marker recorded.',
      },
      markerConfidence: {
        predictedRed: 'Predicted period day. Forecast confidence: {{confidence}}.',
        possibleStart: 'Possible period start. Forecast confidence: {{confidence}}.',
        orange: 'Possible pre-period check-in window. Forecast confidence: {{confidence}}.',
      },
    },
    forecast: {
      title: 'Next-period estimate',
      unavailable:
        'Add at least two period starts, or an optional usual cycle length, to see an estimate.',
      paused: 'Forecasting is paused. Recorded observations remain visible.',
      range: 'Your next period may start {{range}}.',
      central: 'Central estimate: {{date}}.',
      confidenceLabel: 'Confidence: {{confidence}}.',
      confidence: {
        rough: 'rough',
        low: 'low',
        medium: 'medium',
      },
      basedOn: 'Based on {{count}} completed cycle-length records.',
      basedOn_one: 'Based on {{count}} completed cycle-length record.',
      basedOn_other: 'Based on {{count}} completed cycle-length records.',
      typicalSource: 'This rough estimate uses your optional usual cycle length.',
      duration: 'Estimated bleeding duration in days: {{count}}.',
      variable:
        'Recent cycle lengths vary widely, so calendar forecast coloring is hidden while the textual range remains available.',
      late: 'This estimate is now later than its original range. It has not been moved forward automatically.',
    },
    dayDetail: {
      title: 'Daily check-in',
      close: 'Close daily check-in',
      quickActionsTitle: 'Period actions',
      periodActions: {
        start: {
          label: 'Start period',
          description: 'Create a period starting on this date.',
        },
        continue: {
          label: 'Record period day',
          description: 'Link this date to the active period.',
        },
        end: {
          label: 'End period here',
          description: 'Use this date as the inclusive final day.',
        },
        remove: {
          label: 'Remove this period',
          description: 'Remove the complete period while keeping unrelated check-in values.',
        },
      },
      flowLegend: 'Flow',
      flowOptions: {
        none: 'None',
        spotting: 'Spotting',
        light: 'Light',
        medium: 'Medium',
        heavy: 'Heavy',
      },
      ratings: {
        confidence: 'Confidence',
        tension: 'Tension',
        energy: 'Energy',
        pain: 'Pain',
        clear: 'Clear rating',
        option: '{{legend}}: {{rating}} out of 5',
      },
      noteLabel: 'Private note',
      noteDescription: 'Optional. Stored only inside your local journal.',
      save: 'Save check-in',
      saving: 'Saving…',
      removePeriodConfirmation:
        'Remove this complete period? Check-in values unrelated to it will be kept.',
      confirmRemovePeriod: 'Remove period',
      cancelRemovePeriod: 'Keep period',
      deleteEntry: 'Delete check-in',
      deleteConfirmation: 'Delete the check-in values for this date?',
      confirmDelete: 'Delete check-in',
      deleting: 'Deleting…',
      cancelDelete: 'Cancel',
      errors: {
        future: 'Future dates cannot contain recorded check-ins.',
        startFlow: 'Choose light, medium, or heavy flow before starting a period.',
        historicalStart:
          'A new open period cannot begin before a later recorded period. Historical boundary editing is not available yet.',
        laterPeriodDays:
          'This period has recorded days after this date. Remove those entries before ending it here.',
        periodConflict:
          'That period change conflicts with another period. Correct the existing dates first.',
        noActivePeriod: 'There is no active period to continue or end.',
        startLog: 'Remove the period before deleting its start-day check-in.',
        saveFailed: 'The change could not be saved. Your existing journal was left unchanged.',
      },
      status: {
        saved: 'Check-in saved.',
        deleted: 'Check-in deleted.',
        started: 'Period started.',
        continued: 'Period day recorded.',
        ended: 'Period ended.',
        removed: 'Period removed.',
      },
    },
    settings: {
      sectionLabel: 'Tracking preferences',
      title: 'Estimates and check-in window',
      description: 'These settings affect estimates only. They never change what you recorded.',
      typicalCycleLength: 'Usual cycle length in days',
      typicalBleedDuration: 'Usual bleeding duration in days',
      orangeEnabled: 'Show possible pre-period check-in days',
      orangeDays: 'Check-in window length',
      forecastingPaused: 'Pause forecasts and predicted calendar markers',
      optionalNumber: 'Optional whole number',
      orangeRange: 'Choose from 1 to 14 days.',
      save: 'Save tracking preferences',
      saving: 'Saving preferences…',
      saved: 'Tracking preferences saved.',
      failed: 'The tracking preferences could not be saved.',
    },
  },
  vault: {
    loading: {
      title: 'Opening your private journal',
      description: 'Checking the local vault on this device.',
    },
    unavailable: {
      eyebrow: 'Local storage unavailable',
      title: 'The private journal could not be opened',
      description:
        'Your existing data was left unchanged. Check that this browser allows local storage, then reload the app.',
      reset: {
        reveal: 'Reset local app data',
        title: 'Erase the local data instead?',
        description:
          'If reloading does not help, you can permanently remove all data and preferences stored by this app in this browser.',
        confirmation: 'I understand that this cannot be undone.',
        action: 'Erase and start again',
        working: 'Erasing…',
        cancel: 'Keep my data',
        failed: 'The browser did not allow the local data to be erased.',
      },
    },
    erased: {
      eyebrow: 'Local data erased',
      title: 'The data was erased, but the app could not restart',
      description:
        'The previous journal and PIN data are gone. Check that this browser allows local storage, then reload the app to create a new empty vault.',
      preferencesMayRemain:
        'The browser did not confirm removal of the saved appearance or language preference.',
    },
    lock: {
      metaTitle: 'Private app — locked',
      metaDescription: 'A private local app is locked.',
      eyebrow: 'Private app',
      title: 'Locked',
      description: 'Enter your six-digit PIN to continue.',
      cryptoUnavailable:
        'PIN unlocking is unavailable in this browser or connection. Your stored data was not changed. Try this app in a supported secure browser before considering a reset.',
      pinLabel: 'PIN',
      pinHint: 'Enter six digits.',
      unlock: 'Unlock',
      unlocking: 'Unlocking…',
      failed: 'The app could not be unlocked. Check the PIN and try again.',
      forgotPin: 'Forgot PIN?',
      reset: {
        title: 'Reset this app?',
        description:
          'There is no PIN recovery. Resetting permanently erases all data and preferences stored by this app in this browser.',
        confirmation: 'I understand that this cannot be undone.',
        action: 'Erase local app data',
        working: 'Erasing…',
        cancel: 'Keep my data',
        failed: 'The local data could not be erased. Nothing was intentionally removed.',
      },
      preferences: 'Lock-screen preferences',
    },
    security: {
      eyebrow: 'Privacy',
      title: 'PIN lock and local vault',
      description: 'A PIN protects the journal when this app is closed or left in the background.',
      cryptoUnavailable:
        'PIN protection is unavailable because this browser or connection did not pass the secure-cryptography check.',
      protected: {
        status: 'PIN protection is on',
        description:
          'Journal data is encrypted at rest in this browser. The PIN cannot be recovered.',
        lockNow: 'Lock now',
      },
      unprotected: {
        status: 'PIN protection is off',
        description:
          'Journal data is currently stored without app-level encryption or an access gate.',
        recommendation: 'Set up a PIN',
      },
      autoLock: {
        label: 'Lock after leaving the app',
        options: {
          immediate: 'Immediately',
          oneMinute: 'After 1 minute',
          fiveMinutes: 'After 5 minutes',
          fifteenMinutes: 'After 15 minutes',
        },
        saving: 'Saving auto-lock preference…',
        failed: 'The auto-lock preference could not be saved.',
      },
      actions: {
        changePin: 'Change PIN',
        disablePin: 'Turn off PIN protection',
        eraseEverything: 'Erase everything',
      },
      setup: {
        title: 'Set up a six-digit PIN',
        description:
          'The journal will be encrypted before PIN protection becomes active. There is no recovery if you forget it.',
        pinLabel: 'New PIN',
        confirmationLabel: 'Confirm new PIN',
        submit: 'Enable PIN protection',
        working: 'Protecting the journal…',
        success: 'PIN protection is now on.',
      },
      change: {
        title: 'Change PIN',
        description: 'Choose a new six-digit PIN. The journal data does not need to be rewritten.',
        currentPinLabel: 'Current PIN',
        newPinLabel: 'New PIN',
        confirmationLabel: 'Confirm new PIN',
        submit: 'Change PIN',
        working: 'Changing PIN…',
        success: 'The PIN was changed.',
      },
      disable: {
        title: 'Turn off PIN protection?',
        description:
          'The journal will remain only in this browser, but it will be stored without app-level encryption or an access gate.',
        currentPinLabel: 'Current PIN',
        confirmation: 'I understand that the journal will be stored without PIN protection.',
        submit: 'Turn off PIN protection',
        working: 'Removing PIN protection…',
        success: 'PIN protection is now off.',
      },
      reset: {
        title: 'Erase all local data?',
        description:
          'This permanently removes the journal, PIN protection, appearance, and language preferences from this browser.',
        confirmation: 'I understand that this cannot be undone.',
        submit: 'Erase everything',
        working: 'Erasing…',
        success: 'All app data was erased.',
        partialSuccess:
          'The journal and PIN data were erased, but an appearance or language preference may remain.',
      },
      form: {
        cancel: 'Cancel',
        sixDigits: 'Use exactly six digits.',
        mismatch: 'The PINs do not match.',
        unlockFailed: 'The current PIN was not accepted.',
        operationFailed:
          'The change could not be completed. Your existing data was left unchanged.',
      },
    },
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
