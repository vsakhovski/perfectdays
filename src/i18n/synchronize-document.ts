import type { i18n as I18nInstance } from 'i18next';

import type { SupportedLanguage } from '../domain/models';

const DESCRIPTION_META_ID = 'app-description';

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
  document.title = instance.t(($) => $.meta.title, { lng: language });
  getDescriptionMeta().content = instance.t(($) => $.meta.description, { lng: language });
}
