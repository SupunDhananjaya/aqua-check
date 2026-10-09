// Generates build/icon.ico — a water-drop app icon — using only Node built-ins.
//
// Node's zlib is enough to deflate raw RGBA scanlines into valid PNG chunks, and
// an .ico is just a directory header followed by those PNGs, so no image
// dependency is needed for a one-off asset. Run with `npm run make-icon`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.ico');

/** Windows picks whichever of these fits the surface it is drawing. */
const SIZES = [16, 32, 48, 64, 128, 256];

/** Tailwind sky-600, the app's primary colour. */
const COLOR = [2, 132, 199];

/** Supersampling factor per axis, for anti-aliased edges. */
const SAMPLES = 4;

// --- PNG encoding ----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A PNG chunk: length, type, data, then a CRC over type+data. */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // Bytes 10-12 stay zero: deflate compression, adaptive filtering, no interlacing.

  // Each scanline is prefixed with its filter type; 0 means "none".
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y += 1) {
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- The drop --------------------------------------------------------------

// A teardrop is the union of a circle and the cone of tangent lines from the
// apex above it, which keeps the silhouette smooth where the two meet.
const CENTER_Y = 0.3;
const RADIUS = 0.56;
const APEX_Y = -0.88;

const APEX_DISTANCE = CENTER_Y - APEX_Y;
const TANGENT_LENGTH = Math.sqrt(APEX_DISTANCE ** 2 - RADIUS ** 2);
const CONE_COSINE = TANGENT_LENGTH / APEX_DISTANCE;

/** Normalised coordinates, x and y both spanning -1 to 1 with y pointing down. */
function isInsideDrop(x, y) {
  if (x ** 2 + (y - CENTER_Y) ** 2 <= RADIUS ** 2) return true;

  const dy = y - APEX_Y;
  if (dy <= 0) return false;

  const distance = Math.sqrt(x ** 2 + dy ** 2);
  return distance <= TANGENT_LENGTH && dy / distance >= CONE_COSINE;
}

function renderDrop(size) {
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const nx = ((x + (sx + 0.5) / SAMPLES) / size) * 2 - 1;
          const ny = ((y + (sy + 0.5) / SAMPLES) / size) * 2 - 1;
          if (isInsideDrop(nx, ny)) hits += 1;
        }
      }

      const offset = (y * size + x) * 4;
      rgba[offset] = COLOR[0];
      rgba[offset + 1] = COLOR[1];
      rgba[offset + 2] = COLOR[2];
      rgba[offset + 3] = Math.round((hits / SAMPLES ** 2) * 255);
    }
  }

  return rgba;
}

// --- ICO container ---------------------------------------------------------

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach(({ size, png }, index) => {
    const at = index * 16;
    // 256 does not fit in a byte and is recorded as 0 — the one quirk of the format.
    directory[at] = size >= 256 ? 0 : size;
    directory[at + 1] = size >= 256 ? 0 : size;
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map((image) => image.png)]);
}

const images = SIZES.map((size) => ({ size, png: encodePng(size, renderDrop(size)) }));

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, buildIco(images));

console.log(`Wrote ${OUTPUT} (${SIZES.join(', ')} px)`);
