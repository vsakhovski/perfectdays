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
      splash: {
        appName: 'Pattern Journal',
        tagline: 'A private place for your cycle patterns.',
        version: 'Version {{version}}',
      },
      introduction: {
        title: 'Understand your cycle, privately',
        description:
          'This app can help you track your cycles, estimate when your next period may begin, and keep a private journal of your own observations.',
        privacyTitle: 'Your data stays under your control',
        privacyDescription:
          'Your journal stays on this device by default, with no account, advertising, or analytics. An optional PIN can encrypt it at rest; without a PIN, local data is not encrypted.',
      },
      history: {
        title: 'Previous periods',
        description:
          'Predictions are based on previous period starts. Add previous periods when that information is available. Add an end date only when you know it.',
        empty: 'No previous periods added yet.',
        startDate: 'Start date',
        endDate: 'End date (optional)',
        add: 'Add period',
        entryLabel: 'Previous period {{position}}',
        removeEntry: 'Remove previous period {{position}}',
        datePicker: {
          chooseDate: 'Choose date',
          previousMonth: 'Previous month',
          nextMonth: 'Next month',
          calendarLabel: 'Choose {{field}}. {{month}}',
        },
      },
      fallbacks: {
        title: 'Optional period estimates',
        description:
          'These are used only while there is not enough recorded history. Recorded dates always take priority.',
        cycleLength: 'Usual cycle length in days',
        cycleLengthDescription: 'Optional. Choose a common value below or enter another value.',
        bleedDuration: 'Usual bleeding duration in days',
        bleedDurationDescription: 'Optional. Choose a common value below or enter another value.',
        notSure: 'Not sure',
        decrease: 'Decrease {{field}}',
        increase: 'Increase {{field}}',
        quickChoices: 'Quick choices for {{field}}',
      },
      orange: {
        title: 'Possible pre-period window',
        description:
          'This optional marker highlights days leading up to the estimated period. It does not predict conflict or tell you what decisions to make.',
        enabled: 'Show the possible pre-period window',
        days: 'Days before the central estimate',
        daysDescription: 'Choose a common value below or enter from 1 to 14 days.',
        decrease: 'Decrease days before the estimate',
        increase: 'Increase days before the estimate',
        quickChoices: 'Quick choices for days before the estimate',
      },
      pin: {
        title: 'Protect your private journal',
        description:
          'Optionally choose a six-digit PIN. It encrypts the journal stored in this browser and locks the app when it is closed or left in the background. There is no PIN recovery.',
        pinLabel: 'Enter a six-digit PIN',
        confirmationLabel: 'Please repeat the PIN',
        showPin: 'Show {{field}}',
        hidePin: 'Hide {{field}}',
        enable: 'Enable PIN',
        keypadLabel: 'PIN number pad',
        deleteDigit: 'Delete the last PIN digit',
        placeholder: '******',
        unavailable:
          'PIN protection is unavailable in this browser or connection. You can finish setup and enable it later from Privacy in a supported secure browser.',
        enabled: 'PIN protection is on. Finish setup to open your calendar.',
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
        pinSixDigits: 'Enter a six-digit PIN in both fields.',
        pinMismatch: 'The PINs do not match.',
        pinFailed: 'PIN protection could not be enabled. Your journal was not changed.',
      },
      actions: {
        back: 'Back',
        skip: 'Skip setup',
        start: 'Get started',
        next: 'Continue',
        finishWithoutPin: 'Finish without PIN',
        enablePinAndFinish: 'Enable PIN and finish',
        enablingPin: 'Enabling PIN…',
        finish: 'Finish setup',
        completing: 'Saving setup…',
        progress: 'Step {{current}} of {{total}}',
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
        orange: 'Possible pre-period window.',
        green: 'Higher confidence recorded.',
        spotting: 'Spotting recorded.',
        neutral: 'No marker recorded.',
      },
      markerConfidence: {
        predictedRed: 'Predicted period day. Forecast confidence: {{confidence}}.',
        possibleStart: 'Possible period start. Forecast confidence: {{confidence}}.',
        orange: 'Possible pre-period window. Forecast confidence: {{confidence}}.',
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
    insights: {
      sectionLabel: 'Insights',
      title: 'Recent patterns from your journal',
      description:
        'These summaries use up to six recent recorded observations. They describe your history, not what every cycle or future day will be like.',
      noRecords: 'Not enough recorded history yet.',
      cycles: {
        title: 'Recent cycle lengths',
        description: 'Days between successive recorded period starts.',
        days: '{{count}} days',
        days_one: '{{count}} day',
        days_other: '{{count}} days',
      },
      bleeding: {
        title: 'Known bleeding durations',
        description: 'Only completed periods whose end date is known are included.',
        days: '{{count}} days',
        days_one: '{{count}} day',
        days_other: '{{count}} days',
      },
      greenDays: {
        title: 'Recent higher-confidence days',
        description: 'Only days where you explicitly recorded confidence 4 or 5 are included.',
        count: '{{count}} recent records',
        count_one: '{{count}} recent record',
        count_other: '{{count}} recent records',
        confidence: 'Confidence {{rating}} of 5',
      },
      forecast: {
        title: 'Why this estimate looks this way',
        description:
          'This explains the current deterministic estimate; it is not a measure of clinical accuracy.',
        unavailable: 'There is no current estimate to explain.',
        confidenceLabel: 'Confidence',
        sourceLabel: 'Cycle-length source',
        source: {
          recorded: 'Recent recorded period starts',
          typical: 'Your optional usual cycle length',
        },
        cyclesUsedLabel: 'Recorded cycles used',
        cyclesUsed: '{{count}} cycles',
        cyclesUsed_one: '{{count}} cycle',
        cyclesUsed_other: '{{count}} cycles',
        variabilityLabel: 'Recent variability',
        variability: {
          unavailable: 'Not enough recorded cycle lengths yet',
          narrow: 'Recent cycle lengths differ by 4 days or less',
          variable: 'Recent cycle lengths differ by 5 to 10 days',
          highlyVariable: 'Recent cycle lengths differ by more than 10 days',
        },
        spanLabel: 'Shortest-to-longest difference',
        span: '{{count}} days',
        span_one: '{{count}} day',
        span_other: '{{count}} days',
      },
    },
    history: {
      sectionLabel: 'Period history',
      title: 'Review and correct period dates',
      description:
        'Edit the start and inclusive end of a recorded period. Split and merge tools are not part of this version.',
      empty: 'No periods have been recorded yet.',
      active: 'Active period',
      completed: 'Completed; duration known',
      unknownDuration: 'Start recorded; duration unknown',
      startIntensityLabel: 'Start-day flow:',
      startIntensity: {
        unspecified: 'Unspecified',
        light: 'Light',
        medium: 'Medium',
        heavy: 'Heavy',
      },
      edit: 'Correct dates',
      editLabel: 'Correct period starting {{date}}',
      correction: {
        title: 'Correct period dates',
        close: 'Close period correction',
        explanation: 'Adjust this period without changing the boundaries of another period.',
        consequence:
          'Moving, shortening, or marking the end unknown removes old period links and period-only flow outside the corrected dates. Your chosen start-day flow replaces any flow on the corrected start date; unrelated ratings and notes are kept.',
        startDate: 'Start date',
        endDate: 'Inclusive end date',
        endDateDescription: 'Used only when you choose a known end date.',
        endState: 'Period end',
        endStateOptions: {
          known: {
            label: 'Ended — date known',
            description: 'Include this period in bleeding-duration summaries.',
          },
          unknown: {
            label: 'Ended — date unknown',
            description: 'Keep this as a start-only record without inventing a duration.',
          },
          active: {
            label: 'Still active',
            description: 'This period has no end date yet.',
          },
        },
        startIntensity: 'Start-day flow',
        validation: {
          startRequired: 'Enter a start date.',
          endRequired: 'Enter an end date or choose an unknown or active end state.',
          endBeforeStart: 'The end date cannot be before the start date.',
          futureDate: 'Period dates cannot be in the future.',
          startIntensityRequired: 'Choose the flow for the corrected start date.',
        },
        save: 'Save corrected dates',
        saving: 'Saving correction…',
        cancel: 'Cancel',
        errors: {
          overlap: 'Those dates overlap another recorded period.',
          activeConflict: 'Another period is already active.',
          missing: 'This period no longer exists. Close the editor and try again.',
          failed: 'The correction could not be saved. Your existing journal was not changed.',
        },
        saved: 'Period dates corrected.',
      },
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
      title: 'Estimates and pre-period window',
      description: 'These settings affect estimates only. They never change what you recorded.',
      typicalCycleLength: 'Usual cycle length in days',
      typicalBleedDuration: 'Usual bleeding duration in days',
      orangeEnabled: 'Show possible pre-period days',
      orangeDays: 'Pre-period window length',
      forecastingPaused: 'Pause forecasts and predicted calendar markers',
      optionalNumber: 'Optional whole number',
      orangeRange: 'Choose from 1 to 14 days.',
      save: 'Save tracking preferences',
      saving: 'Saving preferences…',
      saved: 'Tracking preferences saved.',
      failed: 'The tracking preferences could not be saved.',
    },
  },
  mobile: {
    shell: {
      navigation: {
        label: 'Primary navigation',
        calendar: 'Calendar',
        privacy: 'Privacy',
        settings: 'Settings',
      },
      actions: {
        checkInToday: 'Check in today',
        editTodayCheckIn: "Edit today's check-in",
        lock: 'Lock',
      },
    },
    calendar: {
      title: 'Calendar',
      description: 'Recorded days, estimates, and today at a glance.',
      navigation: {
        label: 'Calendar month navigation',
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        today: 'Today',
        goToToday: 'Go to today',
      },
      legend: {
        title: 'Calendar markers',
        recorded: 'Recorded',
        predicted: 'Predicted',
        today: 'Today',
        showGuide: 'Show marker guide',
        hideGuide: 'Hide marker guide',
        guideTitle: 'Marker guide',
        markers: {
          recorded: 'Solid band: recorded period.',
          predicted: 'Striped band: predicted period.',
          possibleStart: 'Outline: possible period start.',
          checkInWindow: 'Amber bar: possible pre-period window.',
          higherConfidence: 'Green marker: higher confidence recorded.',
          spotting: 'Dot: spotting recorded.',
        },
      },
      forecast: {
        title: 'Next period',
        range: 'May start {{range}}.',
        basis: '{{confidence}} confidence · based on {{count}} completed cycles.',
        basis_one: '{{confidence}} confidence · based on {{count}} completed cycle.',
        basis_other: '{{confidence}} confidence · based on {{count}} completed cycles.',
        why: 'Why this estimate?',
        showPredictedMonth: 'Show predicted month',
        states: {
          active: {
            title: 'Period recorded as active',
            description: 'Recorded period days take priority over estimates.',
          },
          unavailable: {
            title: 'Estimate unavailable',
            description:
              'Add at least two period starts, or a usual cycle length, to see an estimate.',
          },
          paused: {
            title: 'Estimate paused',
            description: 'Recorded days remain visible.',
          },
          variable: {
            title: 'Cycle lengths vary widely',
            description:
              'The estimated start range remains available, but forecast coloring is hidden.',
          },
          late: {
            title: 'Original estimate range has passed',
            description: 'The original range stays fixed and is not moved forward automatically.',
          },
        },
      },
      context: {
        navigationLabel: 'Calendar details',
        insights: 'Insights',
        periodHistory: 'Period history',
        closeInsights: 'Close Insights',
        closePeriodHistory: 'Close Period history',
      },
      day: {
        title: 'Details for {{date}}',
        recorded: 'Recorded observations',
        forecast: 'Estimate for this date',
        edit: 'Edit this day',
        future: 'Future dates are read-only.',
        close: 'Close day details',
      },
    },
    privacy: {
      title: 'Privacy',
      description: 'Protect, back up, restore, export, or erase this journal.',
      sections: {
        protection: 'PIN protection',
        portability: 'Backup and export',
      },
      storage: {
        title: 'Stored on this device',
        description:
          'Journal data stays in this browser unless you export a file or erase the local data.',
        downloads:
          'Downloaded backups and exports are outside this app and are not removed by Erase everything.',
      },
      danger: {
        title: 'Permanently erase data',
        description:
          'Erasing permanently removes this journal and its app preferences from this browser.',
      },
    },
    settings: {
      title: 'Settings',
      description: 'Manage estimates, calendar layout, appearance, and language.',
      sections: {
        tracking: 'Tracking and estimates',
        appearance: 'Appearance, language, and calendar',
      },
      about: {
        title: 'About',
        description: 'Learn how estimates and calendar markers work.',
        limitationsTitle: 'What this journal cannot determine',
        limitations:
          'Estimates describe patterns in recorded data. They are not medical advice or a diagnosis.',
      },
    },
    checkIn: {
      title: 'Check in today',
      editTitle: "Edit today's check-in",
      dayTitle: 'Check in for this day',
      editDayTitle: "Edit this day's check-in",
      description: 'Record only what you notice today. Nothing optional is selected for you.',
      optional: {
        show: 'Add note or details',
        hide: 'Hide note and details',
        description: 'Ratings and notes are optional.',
      },
      guidance: {
        chooseObservation: 'Choose at least one observation before saving.',
        startPeriod: 'Light, medium, or heavy flow can start a period.',
        spotting: 'Spotting is recorded separately and does not start a period.',
        activePeriod: 'Saving bleeding for today continues the active period.',
        endPeriod: 'Ending a period is a separate choice. Recording no bleeding does not end it.',
      },
      actions: {
        saveAndDone: 'Save and done',
        saving: 'Saving…',
        startPeriodAndSave: 'Start period and save',
        startingAndSaving: 'Starting period and saving…',
        cancel: 'Cancel',
        close: 'Close check-in',
      },
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
    },
    backup: {
      title: 'Back up or restore your journal',
      description:
        'Encrypted backups stay protected by their backup PIN. Downloaded files are outside this app and are not removed by Erase everything.',
      locked: 'Unlock the local vault before using backup or restore tools.',
      cryptoUnavailable:
        'Encrypted backup and restore are unavailable because secure browser cryptography is not available.',
      encrypted: {
        title: 'Encrypted backup',
        description:
          'Download a portable encrypted copy. It stays protected by the PIN in use now, even if you change the app PIN later.',
        action: 'Export encrypted backup',
        working: 'Preparing encrypted backup…',
        pinRequired: 'Turn on PIN protection before creating an encrypted backup.',
        enablePin: 'Set up PIN protection',
        enablingPin: 'Opening PIN setup…',
      },
      plaintext: {
        title: 'Human-readable export',
        reviewWarning: 'Download human-readable export',
        warningTitle: 'This file contains readable sensitive data',
        warning:
          'Anyone who gets this unencrypted file can read every period date, rating, and private note in it. Store and share it with great care.',
        confirmation:
          'I understand that this export is not encrypted and contains readable sensitive data.',
        action: 'Export readable data',
        working: 'Preparing readable export…',
        cancel: 'Cancel readable export',
        close: 'Close human-readable export dialog',
      },
      restore: {
        title: 'Restore encrypted backup',
        description:
          'Choose an encrypted JSON backup and enter the six-digit PIN that protected that file.',
        warningTitle: 'A verified restore replaces this journal',
        warning:
          'The file and its PIN are verified before anything changes. A successful restore replaces this journal and uses the backup PIN for its lock. Appearance and language stay unchanged.',
        fileLabel: 'Encrypted JSON backup',
        chooseFile: 'Choose backup file',
        noFileSelected: 'No backup file selected.',
        selectedFile: 'Selected backup: {{fileName}}',
        pinLabel: 'Backup PIN',
        pinHint: 'Enter the six-digit PIN used when this backup was created.',
        confirmation: 'I understand that a verified restore replaces my current local journal.',
        action: 'Restore from selected backup',
        working: 'Verifying encrypted backup…',
        clear: 'Cancel restoration from backup',
        close: 'Close restore dialog',
        verifyPin: 'Verify backup PIN',
        verifyingPin: 'Verifying backup PIN...',
        validation: {
          fileRequired: 'Choose an encrypted JSON backup.',
          jsonRequired: 'Choose a file whose name ends in .json.',
          fileTooLarge: 'Choose a backup no larger than {{maximumMegabytes}} MB.',
          invalidBackup: 'Choose a valid encrypted JSON backup created by this app.',
          pinRequired: 'Enter the backup PIN.',
          pinInvalid: 'Enter exactly six digits.',
          verificationFailed: 'The backup or PIN could not be verified. Try again.',
          confirmationRequired: 'Confirm that the current journal will be replaced.',
        },
      },
      feedback: {
        encryptedDownloaded: 'The encrypted backup download has started.',
        plaintextDownloaded: 'The readable export download has started.',
        restored:
          'The encrypted backup was restored. This journal is now protected by the backup PIN.',
        encryptedFailed: 'The encrypted backup could not be created. Your journal was not changed.',
        plaintextFailed: 'The readable export could not be created. Your journal was not changed.',
        restoreFailed:
          'The backup could not be restored. Check the file and backup PIN. Your current journal was not changed.',
      },
    },
    security: {
      title: 'PIN protection',
      description:
        'A PIN encrypts the journal and locks it immediately when the app enters the background.',
      cryptoUnavailable:
        'PIN protection is unavailable because this browser or connection did not pass the secure-cryptography check.',
      protected: {
        status: 'PIN protection is on',
        description:
          'Journal data is encrypted at rest in this browser. The PIN cannot be recovered.',
      },
      unprotected: {
        status: 'PIN protection is off',
        description:
          'Journal data is currently stored without app-level encryption or an access gate.',
        recommendation: 'Set up a PIN',
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
    weekStart: {
      label: 'First day of the week',
      options: {
        system: 'System default',
        monday: 'Monday',
        sunday: 'Sunday',
      },
      systemDefault: 'Your current system default is {{day}}.',
      saving: 'Saving calendar preference…',
      saved: 'Calendar preference saved.',
      failed: 'The calendar preference could not be saved.',
    },
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
      label: 'Select language',
      options: {
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
