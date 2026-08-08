import type { SystemLanguageSource } from '../../application/ports/system-language-source';

export const browserSystemLanguageSource: SystemLanguageSource = {
  read() {
    if (navigator.languages.length > 0) {
      return [...navigator.languages];
    }

    return navigator.language ? [navigator.language] : [];
  },
  subscribe(listener) {
    window.addEventListener('languagechange', listener);

    return () => {
      window.removeEventListener('languagechange', listener);
    };
  },
};
