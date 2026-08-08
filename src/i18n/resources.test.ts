import { describe, expect, it } from 'vitest';

import { de } from './locales/de';
import { en } from './locales/en';

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

  it('keeps exact key parity between English and German', () => {
    expect([...germanMessages.keys()].sort()).toEqual([...englishMessages.keys()].sort());
  });

  it('contains no empty messages', () => {
    for (const messages of [englishMessages, germanMessages]) {
      for (const message of messages.values()) {
        expect(message.trim()).not.toBe('');
      }
    }
  });

  it('keeps interpolation placeholders aligned between languages', () => {
    for (const [key, englishMessage] of englishMessages) {
      const germanMessage = germanMessages.get(key);

      expect(germanMessage, `Missing German message for ${key}`).toBeDefined();
      expect(interpolationTokens(germanMessage ?? '')).toEqual(interpolationTokens(englishMessage));
    }
  });
});
