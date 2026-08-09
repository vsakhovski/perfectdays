import { createServer } from 'vite';

import { getE2EBaseUrl, getE2EPort } from './runtime-config';

const E2E_HOST = '127.0.0.1';
const E2E_PORT = getE2EPort();
const E2E_URL = getE2EBaseUrl();

async function serverIsAvailable(): Promise<boolean> {
  try {
    const response = await fetch(E2E_URL);
    return response.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  if (await serverIsAvailable()) {
    return () => Promise.resolve();
  }

  const server = await createServer({
    logLevel: 'error',
    server: {
      host: E2E_HOST,
      port: E2E_PORT,
      strictPort: true,
    },
  });

  await server.listen();

  return async () => {
    await server.close();
  };
}
