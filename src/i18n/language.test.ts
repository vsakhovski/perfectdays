import { describe, expect, it } from 'vitest';

import { isLanguagePreference, resolveLanguage } from './language';

describe('language resolution', () => {
  it('uses an explicit supported preference', () => {
    expect(resolveLanguage('de', ['en-US'])).toBe('de');
  });

  it('matches supported base language tags in device priority order', () => {
    expect(resolveLanguage('system', ['fr-FR', 'de-AT', 'en-US'])).toBe('de');
  });

  it('falls back to English for unsupported or empty device languages', () => {
    expect(resolveLanguage('system', ['fr-FR'])).toBe('en');
    expect(resolveLanguage('system', [])).toBe('en');
  });

  it('recognizes only persisted language preference values', () => {
    expect(isLanguagePreference('system')).toBe(true);
    expect(isLanguagePreference('en')).toBe(true);
    expect(isLanguagePreference('de')).toBe(true);
    expect(isLanguagePreference('de-DE')).toBe(false);
    expect(isLanguagePreference('unknown')).toBe(false);
  });
});
