import type { i18n as I18nInstance } from 'i18next';

import type { SupportedLanguage } from '../domain/models';

const DESCRIPTION_META_ID = 'app-description';
const LOCKED_VAULT_STATE = 'locked';

function getDescriptionMeta(): HTMLMetaElement {
  const existingMeta = document.querySelector<HTMLMetaElement>(`#${DESCRIPTION_META_ID}`);

  if (existingMeta) {
    return existingMeta;
  }

  const meta = document.createElement('meta');
  meta.id = DESCRIPTION_META_ID;
  meta.name = 'description';
  document.head.append(meta);
  return meta;
}

export function synchronizeDocumentLanguage(
  instance: I18nInstance,
  language: SupportedLanguage,
): void {
  document.documentElement.lang = language;
  document.documentElement.dir = instance.dir(language);
  const vaultIsLocked = document.documentElement.dataset['vaultState'] === LOCKED_VAULT_STATE;
  document.title = vaultIsLocked
    ? instance.t(($) => $.vault.lock.metaTitle, { lng: language })
    : instance.t(($) => $.meta.title, { lng: language });
  getDescriptionMeta().content = vaultIsLocked
    ? instance.t(($) => $.vault.lock.metaDescription, { lng: language })
    : instance.t(($) => $.meta.description, { lng: language });
}

export function synchronizeDocumentVaultState(
  instance: I18nInstance,
  language: SupportedLanguage,
  locked: boolean,
): void {
  document.documentElement.dataset['vaultState'] = locked ? LOCKED_VAULT_STATE : 'open';
  synchronizeDocumentLanguage(instance, language);
}
