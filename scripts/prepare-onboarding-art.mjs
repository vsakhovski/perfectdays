/* global Image, document */
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Pass the five generated PNGs in this order. Originals are left untouched.
const splitEstimates = process.argv[2] === '--period-estimates';
const scenes = splitEstimates
  ? ['bleeding', 'cycle']
  : ['welcome', 'history', 'estimates', 'window', 'privacy'];
const inputs = process.argv.slice(splitEstimates ? 3 : 2);
if (inputs.length !== scenes.length) throw new Error(`Provide PNG paths for: ${scenes.join(', ')}`);
const output = resolve('public/onboarding');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const [index, scene] of scenes.entries()) {
    const png = await readFile(inputs[index]);
    const data = await page.evaluate(
      async (source) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = Math.round((640 * image.height) / image.width);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/webp', 0.86).split(',')[1];
      },
      `data:image/png;base64,${png.toString('base64')}`,
    );
    await writeFile(resolve(output, `${scene}-v1.webp`), Buffer.from(data, 'base64'));
  }
} finally {
  await browser.close();
}
