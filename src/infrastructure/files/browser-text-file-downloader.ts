import type {
  TextFileDownload,
  TextFileDownloader,
} from '../../application/ports/text-file-downloader';

interface BrowserTextFileDownloaderDependencies {
  readonly document: Document;
  readonly createObjectUrl: (value: Blob) => string;
  readonly revokeObjectUrl: (url: string) => void;
  readonly scheduleRelease: (callback: () => void, delayMilliseconds: number) => void;
}

/**
 * Firefox and WebKit can consume an anchor-backed Blob URL after the synthetic
 * click has returned. Keep it available for a bounded grace period instead of
 * revoking it in the next task.
 */
export const DOWNLOAD_OBJECT_URL_RELEASE_DELAY_MS = 60_000;

function defaultDependencies(): BrowserTextFileDownloaderDependencies {
  return {
    document,
    createObjectUrl: (value) => URL.createObjectURL(value),
    revokeObjectUrl: (url) => {
      URL.revokeObjectURL(url);
    },
    scheduleRelease: (callback, delayMilliseconds) => {
      window.setTimeout(callback, delayMilliseconds);
    },
  };
}

export function createBrowserTextFileDownloader(
  dependencies: BrowserTextFileDownloaderDependencies = defaultDependencies(),
): TextFileDownloader {
  return {
    download: ({ contents, fileName, mimeType }: TextFileDownload) => {
      const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
      const objectUrl = dependencies.createObjectUrl(blob);
      const anchor = dependencies.document.createElement('a');

      try {
        anchor.download = fileName;
        anchor.href = objectUrl;
        anchor.rel = 'noopener';
        anchor.hidden = true;
        dependencies.document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        const releaseObjectUrl = () => {
          dependencies.revokeObjectUrl(objectUrl);
        };

        try {
          dependencies.scheduleRelease(releaseObjectUrl, DOWNLOAD_OBJECT_URL_RELEASE_DELAY_MS);
        } catch {
          // A failed scheduler must not leave a live Blob URL behind indefinitely.
          releaseObjectUrl();
        }
      }
    },
  };
}

export const browserTextFileDownloader = createBrowserTextFileDownloader();
