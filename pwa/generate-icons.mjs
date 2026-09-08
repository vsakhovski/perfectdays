import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconPath = resolve(rootDirectory, 'public/icons/app-icon.svg');
const outputDirectory = resolve(rootDirectory, 'public/icons');
const installIconVersion = 'v10';
const iconMarkup = await readFile(iconPath, 'utf8');
const browser = await chromium.launch({ headless: true });

try {
  await Promise.all(
    [192, 512].map(async (size) => {
      const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: { height: size, width: size },
      });

      try {
        await page.setContent(`
          <!doctype html>
          <style>
            html, body, svg { block-size: 100%; inline-size: 100%; margin: 0; }
            body { background: transparent; overflow: hidden; }
          </style>
          ${iconMarkup}
        `);
        const png = await page.screenshot({
          animations: 'disabled',
          omitBackground: true,
          type: 'png',
        });
        await writeFile(
          resolve(outputDirectory, `app-icon-${installIconVersion}-${String(size)}.png`),
          png,
        );
      } finally {
        await page.close();
      }
    }),
  );
} finally {
  await browser.close();
}
