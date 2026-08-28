import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = resolve(rootDirectory, 'dist');

async function readText(...segments) {
  return readFile(resolve(rootDirectory, ...segments), 'utf8');
}

async function readDistText(...segments) {
  return readFile(resolve(distDirectory, ...segments), 'utf8');
}

function pngDimensions(buffer) {
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    'icon must have a PNG signature',
  );
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('the production document uses only external scripts and registers the PWA', async () => {
  const html = await readDistText('index.html');
  const inlineScript = /<script\b(?![^>]*\bsrc=)[^>]*>/i;

  assert.doesNotMatch(html, inlineScript);
  assert.match(html, /<script[^>]+src="\/theme-init\.js"/i);
  assert.match(html, /<script[^>]+src="\/registerSW\.js"/i);
  assert.match(html, /<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/i);
});

test('the neutral manifest has installable, maskable raster icons', async () => {
  const manifest = JSON.parse(await readDistText('manifest.webmanifest'));

  assert.equal(manifest.id, '/');
  assert.equal(manifest.name, 'My Perfect Days');
  assert.equal(manifest.short_name, 'My Perfect Days');
  assert.equal(manifest.lang, 'und');
  assert.equal(manifest.description, undefined);
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#87365a');
  assert.equal(manifest.background_color, '#fbf8f7');

  for (const size of [192, 512]) {
    const source = `/icons/app-icon-${String(size)}.png`;
    const icon = manifest.icons.find((candidate) => candidate.src === source);
    assert.deepEqual(icon, {
      src: source,
      sizes: `${String(size)}x${String(size)}`,
      type: 'image/png',
      purpose: 'any maskable',
    });

    const png = await readFile(resolve(distDirectory, source.slice(1)));
    assert.deepEqual(pngDimensions(png), { width: size, height: size });
  }
});

test('the service worker precaches only local static shell assets', async () => {
  const serviceWorker = await readDistText('sw.js');
  const viteConfig = await readText('vite.config.ts');
  const precachedUrls = [...serviceWorker.matchAll(/\burl:"([^"]+)"/g)].map((match) => match[1]);

  assert.ok(precachedUrls.length >= 7, 'expected a non-empty static precache manifest');
  assert.equal(new Set(precachedUrls).size, precachedUrls.length, 'precache URLs must be unique');
  assert.ok(precachedUrls.includes('index.html'));
  assert.ok(precachedUrls.includes('theme-init.js'));
  assert.ok(precachedUrls.includes('icons/app-icon-192.png'));
  assert.ok(precachedUrls.includes('icons/app-icon-512.png'));
  assert.ok(precachedUrls.some((url) => /^assets\/.+\.js$/.test(url)));
  assert.ok(precachedUrls.some((url) => /^assets\/.+\.css$/.test(url)));

  for (const url of precachedUrls) {
    assert.doesNotMatch(url, /^(?:https?:)?\/\//);
    assert.doesNotMatch(url, /(?:^|\/)api(?:\/|$)/);
    assert.notEqual(url, '_headers');
  }

  assert.match(viteConfig, /registerType:\s*'autoUpdate'/);
  assert.match(viteConfig, /injectRegister:\s*'script-defer'/);
  assert.match(viteConfig, /clientsClaim:\s*true/);
  assert.match(viteConfig, /skipWaiting:\s*true/);
  assert.match(serviceWorker, /clientsClaim\(\)/);
  assert.match(serviceWorker, /skipWaiting\(\)/);
  assert.match(viteConfig, /runtimeCaching:\s*\[\]/);
  assert.match(viteConfig, /navigateFallbackDenylist:\s*\[\/\^\\\/api/);
  assert.doesNotMatch(viteConfig, /\burlPattern\s*:/);
});

test('static-host and preview security policies stay aligned and CSP-compatible', async () => {
  const sourceHeaders = await readText('public', '_headers');
  const builtHeaders = await readDistText('_headers');
  const viteConfig = await readText('vite.config.ts');
  const headerCsp = sourceHeaders.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
  const previewCsp = viteConfig.match(/const CONTENT_SECURITY_POLICY = `([^`]*)`;/)?.[1];

  assert.equal(builtHeaders, sourceHeaders);
  assert.equal(headerCsp, previewCsp);
  assert.match(sourceHeaders, /Vite preview serves the file but does not apply its route-specific/);
  assert.match(headerCsp, /script-src 'self'/);
  assert.doesNotMatch(headerCsp, /script-src[^;]*'unsafe-inline'/);
  assert.match(headerCsp, /style-src-attr 'none'/);
  assert.doesNotMatch(headerCsp, /'unsafe-inline'/);
  assert.match(headerCsp, /worker-src 'self'/);
  assert.match(headerCsp, /connect-src 'self'/);
  assert.match(sourceHeaders, /^\s*X-Frame-Options:\s*DENY$/m);
  assert.match(sourceHeaders, /^\s*X-Content-Type-Options:\s*nosniff$/m);
  assert.match(sourceHeaders, /\/sw\.js\s+Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(
    sourceHeaders,
    /\/manifest\.webmanifest[\s\S]*Content-Type: application\/manifest\+json/,
  );
});
