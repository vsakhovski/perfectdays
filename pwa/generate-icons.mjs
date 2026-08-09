import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const outputDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
const colors = {
  accent: [135, 54, 90],
  highlight: [240, 164, 194],
  paper: [251, 248, 247],
};

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function colorAt(x, y) {
  const centerDistance = Math.hypot(x - 0.5, y - 0.5);
  const highlightDistance = Math.hypot(x - 0.671875, y - 0.328125);

  if (highlightDistance <= 0.06640625) return colors.highlight;
  if (centerDistance <= 0.16015625) return colors.accent;
  if (centerDistance <= 0.2578125) return colors.paper;
  return colors.accent;
}

function rasterize(size) {
  const samplesPerAxis = 4;
  const data = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;

  for (let y = 0; y < size; y += 1) {
    data[offset] = 0;
    offset += 1;

    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0];

      for (let sampleY = 0; sampleY < samplesPerAxis; sampleY += 1) {
        for (let sampleX = 0; sampleX < samplesPerAxis; sampleX += 1) {
          const color = colorAt(
            (x + (sampleX + 0.5) / samplesPerAxis) / size,
            (y + (sampleY + 0.5) / samplesPerAxis) / size,
          );
          totals[0] += color[0];
          totals[1] += color[1];
          totals[2] += color[2];
        }
      }

      const sampleCount = samplesPerAxis * samplesPerAxis;
      data[offset] = Math.round(totals[0] / sampleCount);
      data[offset + 1] = Math.round(totals[1] / sampleCount);
      data[offset + 2] = Math.round(totals[2] / sampleCount);
      data[offset + 3] = 255;
      offset += 4;
    }
  }

  return data;
}

function createPng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rasterize(size), { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  [192, 512].map((size) =>
    writeFile(resolve(outputDirectory, `app-icon-${String(size)}.png`), createPng(size)),
  ),
);
