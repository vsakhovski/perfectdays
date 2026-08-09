export interface TextFileDownload {
  readonly contents: string;
  readonly fileName: string;
  readonly mimeType: 'application/json';
}

/** Browser-independent boundary for handing an already serialized file to the user. */
export interface TextFileDownloader {
  readonly download: (file: TextFileDownload) => void;
}
