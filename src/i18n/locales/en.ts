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
