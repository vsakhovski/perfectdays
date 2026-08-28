import { describe, expect, it } from 'vitest';

import { de } from './locales/de';
import { en } from './locales/en';
import { ru } from './locales/ru';
import { createAppI18n } from './create-i18n';

function flattenMessages(value: unknown, prefix = ''): Map<string, string> {
  const messages = new Map<string, string>();

  if (typeof value === 'string') {
    messages.set(prefix, value);
    return messages;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Translation value at "${prefix}" must be a string or object.`);
  }

  for (const [key, child] of Object.entries(value)) {
    const childPrefix = prefix ? `${prefix}.${key}` : key;

    for (const [messageKey, message] of flattenMessages(child, childPrefix)) {
      messages.set(messageKey, message);
    }
  }

  return messages;
}

function interpolationTokens(message: string): string[] {
  return [...message.matchAll(/\{\{\s*([\w.]+)\s*\}\}/gu)]
    .map((match) => match[1])
    .filter((token): token is string => token !== undefined)
    .sort();
}

describe('translation resources', () => {
  const englishMessages = flattenMessages(en);
  const germanMessages = flattenMessages(de);
  const russianMessages = flattenMessages(ru);
  const russianBaseMessages = new Map(
    [...russianMessages].filter(([key]) => !/_(few|many)$/u.test(key)),
  );

  it('keeps exact key parity across every language', () => {
    for (const messages of [germanMessages, russianBaseMessages]) {
      expect([...messages.keys()].sort()).toEqual([...englishMessages.keys()].sort());
    }
  });

  it('uses only supported Russian plural extensions', () => {
    for (const key of russianMessages.keys()) {
      const match = /^(.*)_(few|many)$/u.exec(key);
      const baseKey = match?.[1];
      if (baseKey === undefined) continue;
      const englishPluralKey = `${baseKey}_other`;
      expect(englishMessages.has(englishPluralKey), `Unexpected Russian plural key ${key}`).toBe(
        true,
      );
      expect(interpolationTokens(russianMessages.get(key) ?? '')).toEqual(
        interpolationTokens(englishMessages.get(englishPluralKey) ?? ''),
      );
    }
  });

  it('contains no empty messages', () => {
    for (const messages of [englishMessages, germanMessages, russianMessages]) {
      for (const message of messages.values()) {
        expect(message.trim()).not.toBe('');
      }
    }
  });

  it('selects Russian singular, paucal, and plural messages', async () => {
    const i18n = await createAppI18n('ru');

    expect(i18n.t(($) => $.tracker.insights.cycles.days, { count: 1 })).toBe('1 день');
    expect(i18n.t(($) => $.tracker.insights.cycles.days, { count: 2 })).toBe('2 дня');
    expect(i18n.t(($) => $.tracker.insights.cycles.days, { count: 5 })).toBe('5 дней');
  });

  it('keeps interpolation placeholders aligned between languages', () => {
    for (const [key, englishMessage] of englishMessages) {
      for (const [language, messages] of [
        ['German', germanMessages],
        ['Russian', russianMessages],
      ] as const) {
        const localizedMessage = messages.get(key);
        expect(localizedMessage, `Missing ${language} message for ${key}`).toBeDefined();
        expect(interpolationTokens(localizedMessage ?? '')).toEqual(
          interpolationTokens(englishMessage),
        );
      }
    }
  });
});
