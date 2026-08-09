const DEFAULT_E2E_PORT = 4173;

export function getE2EPort(): number {
  const value = process.env['E2E_PORT'];
  if (value === undefined) return DEFAULT_E2E_PORT;

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError('E2E_PORT must be an integer from 1 to 65535.');
  }
  return port;
}

export function getE2EBaseUrl(): string {
  return `http://127.0.0.1:${String(getE2EPort())}`;
}
