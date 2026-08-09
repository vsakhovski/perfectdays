import { describe, expect, it } from 'vitest';

import {
  browserJournalEnvironment,
  createBrowserJournalId,
  localDateFromDate,
} from './browser-journal-environment';

describe('browser journal environment', () => {
  it('creates a calendar date from local date parts instead of UTC conversion', () => {
    const localDate = new Date(2026, 7, 8, 23, 59, 59);

    expect(localDateFromDate(localDate)).toBe('2026-08-08');
  });

  it('creates distinct non-empty record identifiers', () => {
    const first = createBrowserJournalId();
    const second = createBrowserJournalId();

    expect(first).not.toHaveLength(0);
    expect(second).not.toBe(first);
  });

  it('provides valid current timestamp and date values', () => {
    expect(() => new Date(browserJournalEnvironment.now()).toISOString()).not.toThrow();
    expect(browserJournalEnvironment.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});
