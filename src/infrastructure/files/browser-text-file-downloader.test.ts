import { describe, expect, it, vi } from 'vitest';

import {
  createBrowserTextFileDownloader,
  DOWNLOAD_OBJECT_URL_RELEASE_DELAY_MS,
} from './browser-text-file-downloader';

describe('createBrowserTextFileDownloader', () => {
  it('downloads JSON through a short-lived object URL', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const createObjectUrl = vi.fn<(value: Blob) => string>(() => 'blob:private-export');
    const revokeObjectUrl = vi.fn<(url: string) => void>();
    let release: (() => void) | undefined;
    let releaseDelay: number | undefined;
    const downloader = createBrowserTextFileDownloader({
      document,
      createObjectUrl,
      revokeObjectUrl,
      scheduleRelease: (callback, delayMilliseconds) => {
        release = callback;
        releaseDelay = delayMilliseconds;
      },
    });

    downloader.download({
      contents: '{"formatVersion":1}',
      fileName: 'private-journal-backup.json',
      mimeType: 'application/json',
    });

    expect(createObjectUrl).toHaveBeenCalledOnce();
    const blob = createObjectUrl.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe('application/json;charset=utf-8');
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    expect(releaseDelay).toBe(DOWNLOAD_OBJECT_URL_RELEASE_DELAY_MS);

    release?.();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:private-export');
  });

  it('still removes the anchor and eventually revokes its URL when click fails', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Synthetic click failure.');
    });
    const revokeObjectUrl = vi.fn();
    let release: (() => void) | undefined;
    const downloader = createBrowserTextFileDownloader({
      document,
      createObjectUrl: () => 'blob:failed-export',
      revokeObjectUrl,
      scheduleRelease: (callback, delayMilliseconds) => {
        expect(delayMilliseconds).toBe(DOWNLOAD_OBJECT_URL_RELEASE_DELAY_MS);
        release = callback;
      },
    });

    expect(() => {
      downloader.download({
        contents: '{}',
        fileName: 'private-journal-export.json',
        mimeType: 'application/json',
      });
    }).toThrow('Synthetic click failure.');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    release?.();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:failed-export');
  });

  it('revokes immediately if bounded cleanup cannot be scheduled', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const revokeObjectUrl = vi.fn();
    const downloader = createBrowserTextFileDownloader({
      document,
      createObjectUrl: () => 'blob:scheduler-failed',
      revokeObjectUrl,
      scheduleRelease: () => {
        throw new Error('Synthetic scheduler failure.');
      },
    });

    expect(() => {
      downloader.download({
        contents: '{}',
        fileName: 'private-journal-export.json',
        mimeType: 'application/json',
      });
    }).not.toThrow();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:scheduler-failed');
  });
});
