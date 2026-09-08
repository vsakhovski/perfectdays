(() => {
  const storageKey = 'perfect-days:theme';
  let preference = 'light';

  try {
    const storedPreference = globalThis.localStorage.getItem(storageKey);
    if (storedPreference === 'light' || storedPreference === 'dark') {
      preference = storedPreference;
    }
  } catch {
    // Light mode remains a safe fallback when storage is unavailable.
  }

  const resolvedTheme =
    preference === 'system'
      ? globalThis.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference;

  globalThis.document.documentElement.dataset.theme = resolvedTheme;
  globalThis.document
    .querySelector('#app-theme-color')
    ?.setAttribute('content', resolvedTheme === 'dark' ? '#101b1c' : '#f8fbfa');
})();
