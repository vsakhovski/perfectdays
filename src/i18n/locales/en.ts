export const en = {
  meta: {
    title: 'My Perfect Days',
    description: 'A private, local-first menstrual pattern journal.',
  },
  tracker: {
    onboarding: {
      splash: {
        appName: 'My Perfect Days',
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
        editor: {
          saveStartOnly: 'Save start date only',
          configureStartOnlyDescription:
            'Save this start date without inventing an unknown end date?',
          deleteTitle: 'Remove previous period {{range}}?',
          deleteDescription: 'This removes the previous period from your setup information.',
        },
      },
      fallbacks: {
        title: 'Optional period estimates',
        description:
          'These are used only while there is not enough recorded history. Recorded dates always take priority.',
        cycleLength: 'Usual cycle length in days',
        cycleLengthDescription: 'Optional. Use the minus and plus controls or enter another value.',
        bleedDuration: 'Usual bleeding duration in days',
        bleedDurationDescription:
          'Optional. Use the minus and plus controls or enter another value.',
        notSure: 'Not sure',
        decrease: 'Decrease {{field}}',
        increase: 'Increase {{field}}',
        quickChoices: 'Quick choices for {{field}}',
      },
      orange: {
        daysDescription: 'Use the minus and plus controls or enter from 1 to 14 days.',
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
        futureDate: 'Future dates cannot be added to periods history.',
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
      title: 'Your recorded days and estimates',
      calendarLabel: 'Menstrual pattern calendar',
      outsideMonth: 'Outside the displayed month.',
      future: 'Future date; check-ins are unavailable.',
      markers: {
        recordedRed: 'Recorded period day.',
        predictedRed: 'Predicted period day.',
        predictedStart: 'Most probable start.',
        possibleStart: 'Possible period start.',
        orange: 'Possible pre-period window.',
        green: 'Higher confidence recorded.',
        spotting: 'Spotting recorded.',
        neutral: 'No marker recorded.',
      },
      markerConfidence: {
        predictedRed: 'Predicted period day. Forecast confidence: {{confidence}}.',
        activePredictedRed:
          'Estimated remaining period day based on recorded or usual bleeding duration.',
        orange: 'Possible pre-period window. Forecast confidence: {{confidence}}.',
      },
    },
    forecast: {
      confidence: {
        rough: 'rough',
        low: 'low',
        medium: 'medium',
      },
    },
    insights: {
      cycles: {
        days: '{{count}} days',
        days_one: '{{count}} day',
        days_other: '{{count}} days',
      },
      bleeding: {
        days: '{{count}} days',
        days_one: '{{count}} day',
        days_other: '{{count}} days',
      },
      forecast: {
        unavailable: 'There is no current estimate to explain.',
        confidenceLabel: 'Confidence',
      },
    },
    history: {
      sectionLabel: 'Periods history',
      title: 'Recorded periods',
      description: 'You can review, edit, delete, or add recorded periods here.',
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
      edit: 'Edit dates',
      editLabel: 'Select period starting {{date}}',
      showMore: 'Show more',
      bleedingDuration: 'Bleeding duration: {{count}} days',
      bleedingDuration_one: 'Bleeding duration: {{count}} day',
      bleedingDuration_other: 'Bleeding duration: {{count}} days',
      cycleLength: 'Cycle length: {{count}} days',
      cycleLength_one: 'Cycle length: {{count}} day',
      cycleLength_other: 'Cycle length: {{count}} days',
      cycleChecks: {
        title: 'Needs review',
        description:
          'Cycle checks can point out records that may affect estimates. Your journal is never changed automatically.',
        interval: '{{from}} to {{to}}',
        possibleSplit: {
          title: 'Two periods are very close together',
          description:
            'There are only {{count}} clear days between these periods. Check whether both records are correct.',
          description_zero:
            'There is no clear day between these periods. Check whether both records are correct.',
          description_one:
            'There is only {{count}} clear day between these periods. Check whether both records are correct.',
          description_other:
            'There are only {{count}} clear days between these periods. Check whether both records are correct.',
        },
        possibleMissing: {
          title: 'A period may be missing from the journal',
          description:
            'This interval is about {{count}} times your recent cycle length. Check whether a period was not recorded.',
          chooseDate:
            'Choose the recorded start date in the calendar. No period will be added until you select and confirm both dates.',
        },
        possiblyStaleActive: {
          title: 'Is this period still active?',
          description:
            'This period has been active for {{count}} days. Check whether it is still active or its end date needs correction.',
          description_one:
            'This period has been active for {{count}} day. Check whether it is still active or its end date needs correction.',
          description_other:
            'This period has been active for {{count}} days. Check whether it is still active or its end date needs correction.',
        },
        actions: {
          addMissingPeriod: 'Add missing period',
          reviewActivePeriod: 'Review period dates',
          stillActive: 'It is still active',
          reviewDates: 'Review recorded dates',
          keepAndUse: 'Keep and use in estimates',
          keepAndExclude: 'Keep but exclude from estimates',
          useAgain: 'Use again',
        },
        excluded: {
          title: 'Not used in estimates',
          description:
            'The recorded periods remain in your journal. This cycle length is excluded only from estimate calculations.',
        },
        savedIncluded: 'This cycle length will be used in estimates.',
        savedExcluded: 'This cycle length will not be used in estimates.',
        savedStillActive:
          'This period remains active. This check will return if the record changes.',
        saveFailed: 'The estimate decision could not be saved. Your journal was not changed.',
      },
      estimate: {
        title: 'Next period',
        rangeLabel: 'Estimated start range',
        centralStartLabel: 'Most probable start',
        durationLabel: 'Estimated bleeding duration',
        explanationTitle: 'Why this estimate?',
        explanation:
          'The most probable start uses the middle value of your recent completed cycle lengths. Differences between those cycles determine how wide the estimated date range is. The estimated period length uses the middle value of your completed recorded periods. When there is not enough history, your optional starting estimates are used.',
        basedOnLabel: 'Based on',
        basedOnRecorded: '{{count}} completed cycles',
        basedOnRecorded_one: '{{count}} completed cycle',
        basedOnRecorded_other: '{{count}} completed cycles',
        basedOnReviewed: '{{used}} of {{available}} recent cycles',
        basedOnTypical: 'Your optional starting estimate',
        pendingReview:
          '{{count}} recent cycle needs review and is not currently used in this estimate.',
        pendingReview_one:
          '{{count}} recent cycle needs review and is not currently used in this estimate.',
        pendingReview_other:
          '{{count}} recent cycles need review and are not currently used in this estimate.',
        excluded:
          '{{count}} reviewed cycle is excluded from this estimate. You can change this in Periods history.',
        excluded_one:
          '{{count}} reviewed cycle is excluded from this estimate. You can change this in Periods history.',
        excluded_other:
          '{{count}} reviewed cycles are excluded from this estimate. You can change this in Periods history.',
        reviewRequired:
          'Two recent periods need review before they can anchor a new estimate. Open Periods history to review them.',
        recentCycleLengths: 'Recent cycle lengths',
        recentCycleLengthsValue: '{{lengths}} days',
        estimatedCycleLength: 'Estimated cycle length',
        consistency: {
          unavailable: 'There are not enough recorded cycles yet to describe consistency.',
          consistent: 'Your recent cycles have been fairly consistent.',
          variable: 'Your recent cycle lengths vary, so the estimated date range is wider.',
          highlyVariable:
            'Your recent cycle lengths vary considerably, so the estimated date range is wider.',
        },
        estimatedPeriodLength: 'Estimated period length',
      },
      calendar: {
        label: 'Recorded periods calendar',
        legend: 'Background colors',
        cancel: 'Cancel',
        selectBoundary: 'Select the start and end date for this period.',
        firstBoundary: 'First boundary selected. Select the other boundary.',
        newFirstBoundary: 'New period boundary selected. Select the other boundary.',
        selectEndBoundary: 'Select an end date after the chosen start date.',
        endAfterStart: 'The end date must be after the selected start date.',
        selectedPeriod: 'Period {{range}}',
        emptyDate: '{{date}} is not part of a recorded period',
        emptyDateDescription:
          'Use this date as the start of a new period, then select its end date.',
        addStartingHere: 'Start a new period here',
        selectedStart: 'Selected period start date',
        selectedEnd: 'Selected period end date',
        selectedRange: 'Inside the selected period range',
        saved: 'Period dates updated.',
        added: 'New period added.',
        configure: {
          title: 'Configure period {{range}}',
          description: 'Save these start and end dates for the period?',
          save: 'Save period',
          saving: 'Saving period…',
          cancel: 'Cancel',
        },
      },
      delete: {
        action: 'Delete period',
        label: 'Delete period {{date}}',
        title: 'Delete period {{range}}?',
        description:
          'This removes the complete recorded period. Ratings, notes, and other unrelated daily observations are kept.',
        confirm: 'Delete period',
        deleting: 'Deleting period…',
        cancel: 'Cancel',
        deleted: 'Period deleted.',
      },
      correction: {
        validation: {
          futureDate: 'Period dates cannot be in the future.',
        },
        errors: {
          overlap: 'Those dates overlap another recorded period.',
          activeConflict: 'Another period is already active.',
          missing: 'This period no longer exists. Close the editor and try again.',
          failed: 'The correction could not be saved. Your existing journal was not changed.',
        },
      },
    },
    dayDetail: {
      quickActionsTitle: 'Period',
      periodActions: {
        start: {
          label: 'Start period',
          description: 'The period starts on this day.',
        },
        continue: {
          label: 'Record period day',
          description: 'The period continues on this day.',
        },
        end: {
          label: 'End period here',
          description: 'The period ends on this day.',
        },
        remove: {
          label: 'Remove this period',
          description: 'Remove the complete period while keeping unrelated check-in values.',
        },
      },
      periodEndsBeforeDay: 'Saving None marks the previous day as the last period day.',
      extendPeriod: {
        title: 'Extend the recorded period?',
        startDescription:
          'This check-in leaves {{count}} clear days before the period recorded from {{periodStart}}. Extend that period to start on {{checkInDate}}?',
        startDescription_zero:
          'This check-in is immediately before the period recorded from {{periodStart}}. Extend that period to start on {{checkInDate}}?',
        startDescription_one:
          'This check-in leaves {{count}} clear day before the period recorded from {{periodStart}}. Extend that period to start on {{checkInDate}}?',
        startDescription_other:
          'This check-in leaves {{count}} clear days before the period recorded from {{periodStart}}. Extend that period to start on {{checkInDate}}?',
        endDescription:
          'This check-in leaves {{count}} clear days after the period recorded through {{periodEnd}}. Extend that period through {{checkInDate}}?',
        endDescription_zero:
          'This check-in is immediately after the period recorded through {{periodEnd}}. Extend that period through {{checkInDate}}?',
        endDescription_one:
          'This check-in leaves {{count}} clear day after the period recorded through {{periodEnd}}. Extend that period through {{checkInDate}}?',
        endDescription_other:
          'This check-in leaves {{count}} clear days after the period recorded through {{periodEnd}}. Extend that period through {{checkInDate}}?',
        confirm: 'Extend period and save',
        cancel: 'Cancel',
      },
      historicalPeriodEnd: {
        title: 'Select the last period day',
        description:
          'Starting the period on {{startDate}} would otherwise mark every day through today as part of an active period, which is longer than your current expected length. Select the actual last day.',
        label: 'Period end date',
        confirm: 'Save completed period',
        cancel: 'Cancel',
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
      noteDescription: 'Stored only inside your local journal.',
      removePeriodConfirmation:
        'Remove this complete period? Check-in values unrelated to it will be kept.',
      confirmRemovePeriod: 'Remove period',
      cancelRemovePeriod: 'Keep period',
      deleteEntry: 'Delete saved check-in',
      deleteConfirmation: 'Delete the check-in values for this date?',
      confirmDelete: 'Delete check-in',
      deleting: 'Deleting…',
      cancelDelete: 'Cancel',
      errors: {
        future: 'Future dates cannot contain recorded check-ins.',
        startFlow: 'Choose light, medium, or heavy flow before starting a period.',
        historicalStart:
          'This day is too far from the later recorded period to extend it. Correct the dates in Periods history.',
        noneRequiresPeriodCorrection:
          'None cannot change a completed period or skip later recorded period days. Correct the period dates in Periods history.',
        periodConflict:
          'That period change conflicts with another period. Correct the existing dates first.',
        noActivePeriod: 'There is no active period to continue or end.',
        startLog: 'Remove the period before deleting its start-day check-in.',
        saveFailed: 'The change could not be saved. Your existing journal was left unchanged.',
      },
      status: {
        deleted: 'Check-in deleted.',
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
        history: 'History',
        privacy: 'Privacy',
        settings: 'Settings',
      },
      actions: {
        checkInToday: 'Check in today',
        editTodayCheckIn: "Edit today's check-in",
        checkInFor: 'Check in for {{date}}',
        editCheckInFor: 'Edit check-in for {{date}}',
        lock: 'Lock',
      },
    },
    calendar: {
      navigation: {
        label: 'Calendar month navigation',
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        today: 'Today',
        goToToday: 'Go to today',
      },
      legend: {
        title: 'Background colors',
        recorded: 'Recorded period',
        predicted: 'Estimated period',
        today: 'Today',
      },
      forecast: {
        states: {
          paused: {
            description: 'Recorded days remain visible.',
          },
          variable: {
            description:
              'The estimated start range remains available, but forecast coloring is hidden.',
          },
          late: {
            description: 'The original range stays fixed and is not moved forward automatically.',
          },
        },
      },
      context: {
        navigationLabel: 'Calendar details',
        insights: 'Insights',
        periodHistory: 'Periods history',
      },
      selectedDay: {
        selected: 'Selected calendar day',
      },
    },
    privacy: {
      storage: {
        title: 'Journal data',
        description:
          'Journal data stays on this device unless you export a file or erase the local data.',
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
      cards: {
        theme: 'Theme',
        language: 'Language',
        weekStart: 'First day of the week',
      },
      prePeriod: {
        title: 'Pre-period window',
        description:
          'Highlights the optional days before an estimated period so you can notice and record your own patterns.',
        enabled: 'Show pre-period window in calendar',
        days: 'Number of pre-period days',
      },
      fallbacks: {
        title: 'Usual period estimates',
        description:
          'These optional starting values are used only until your recorded periods provide the same information.',
        cycleLength: 'Usual cycle length',
        bleedDuration: 'Usual bleeding days',
        cycleOverridden:
          'Recorded cycle lengths now determine estimates, so this starting value is no longer used.',
        bleedOverridden:
          'Recorded bleeding durations now determine estimates, so this starting value is no longer used.',
      },
      autoSave: {
        saving: 'Saving automatically…',
        saved: 'Saved automatically.',
        failed: 'The change could not be saved.',
      },
      about: {
        title: 'About',
        version: 'Version {{version}}',
        description:
          'Perfect Days is a private, local-first journal for recording periods, daily observations, and personal estimates.',
        development:
          'It is being developed as an installable web app with offline support and optional on-device encryption.',
        limitationsTitle: 'What this journal cannot determine',
        limitations:
          'Estimates describe patterns in recorded data. They are not medical advice or a diagnosis.',
        authorTitle: 'About the author',
        author:
          'Created by an independent developer. Author details will be added before public release.',
        donate: 'Support development with PayPal',
      },
    },
    checkIn: {
      title: 'Check in today',
      editTitle: "Edit today's check-in",
      dayTitle: 'Check in for this day',
      editDayTitle: "Edit this day's check-in",
      optional: {
        show: 'Add note or details (optional)',
        hide: 'Hide note and details',
      },
      guidance: {
        chooseObservation: 'Choose at least one observation before saving.',
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
      metaTitle: 'Perfect Days — locked',
      metaDescription: 'A private local app is locked.',
      eyebrow: 'Perfect Days',
      title: 'Locked',
      description: 'Enter your six-digit PIN to continue.',
      cryptoUnavailable:
        'PIN unlocking is unavailable in this browser or connection. Your stored data was not changed. Try this app in a supported secure browser before considering a reset.',
      pinLabel: 'PIN',
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
      title: 'Back up or restore',
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
        reviewWarning: 'Download readable export',
        warningTitle: 'This file contains readable sensitive data',
        warning:
          'Anyone who gets this unencrypted file can read every period date, rating, and private note in it. Store and share it with great care. This export cannot be used to restore your journal.',
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
        warningTitle: 'Restored backup will replace current journal',
        warning:
          'The file and its PIN are verified before anything changes. A successful restore replaces this journal and uses the backup PIN for its lock. Appearance and language stay unchanged.',
        fileLabel: 'Encrypted backup file',
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
      },
      unprotected: {
        status: 'PIN protection is off',
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
        ru: 'Русский',
      },
      resolved: {
        en: 'English',
        de: 'German',
        ru: 'Russian',
      },
      current: 'The app is currently displayed in {{language}}.',
    },
  },
} as const;

type WidenTranslationValues<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : WidenTranslationValues<T[Key]>;
};

export type TranslationResource = WidenTranslationValues<typeof en>;
