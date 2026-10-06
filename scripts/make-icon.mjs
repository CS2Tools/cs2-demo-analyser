import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps', 'desktop', 'build', 'icon.png');

const S = 512;
const SS = 4;
const cx = S / 2;
const cy = S / 2;

const AMBER = [245, 158, 11];
const SKY = [56, 189, 248];
const WHITE = [250, 250, 250];

function roundedRectInside(x, y, r) {
  const qx = Math.abs(x - cx) - (S / 2 - r);
  const qy = Math.abs(y - cy) - (S / 2 - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return outside <= 0;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const GAP = 46;
const LEN = 118;
const ARMS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
].map(([dx, dy]) => [cx + dx * GAP, cy + dy * GAP, cx + dx * (GAP + LEN), cy + dy * (GAP + LEN)]);

function sample(x, y) {
  if (!roundedRectInside(x, y, 96)) return [0, 0, 0, 0];

  const t = y / S;
  let rgb = [28 + (11 - 28) * t, 28 + (11 - 28) * t, 32 + (13 - 32) * t];
  const over = (c, a) => {
    rgb = rgb.map((v, i) => v * (1 - a) + c[i] * a);
  };

  const r = Math.hypot(x - cx, y - cy);

  if (r <= 175) {
    let ang = Math.atan2(y - cy, x - cx) + Math.PI / 2;
    if (ang < 0) ang += Math.PI * 2;
    const frac = ang / (Math.PI * 2);
    if (frac < 0.18) over(AMBER, 0.55 * (1 - frac / 0.18));
  }

  for (const ring of [175, 115]) {
    if (Math.abs(r - ring) <= 5) over(AMBER, 0.28);
  }

  if (ARMS.some(([ax, ay, bx, by]) => segmentDistance(x, y, ax, ay, bx, by) <= 13)) over(AMBER, 1);

  if (Math.hypot(x - (cx + 95), y - (cy - 128)) <= 15) over(SKY, 1);
  if (Math.hypot(x - (cx - 130), y - (cy + 92)) <= 15) over(AMBER, 1);

  if (r <= 16) over(WHITE, 1);

  return [rgb[0], rgb[1], rgb[2], 255];
}

const raw = Buffer.alloc(S * (S * 4 + 1));
for (let py = 0; py < S; py++) {
  const row = py * (S * 4 + 1);
  raw[row] = 0;
  for (let px = 0; px < S; px++) {
    const acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const [r, g, b, a] = sample(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);

        acc[0] += r * a;
        acc[1] += g * a;
        acc[2] += b * a;
        acc[3] += a;
      }
    }
    const o = row + 1 + px * 4;
    const alpha = acc[3] / (SS * SS);
    raw[o] = acc[3] ? Math.round(acc[0] / acc[3]) : 0;
    raw[o + 1] = acc[3] ? Math.round(acc[1] / acc[3]) : 0;
    raw[o + 2] = acc[3] ? Math.round(acc[2] / acc[3]) : 0;
    raw[o + 3] = Math.round(alpha);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
process.stdout.write(`icone gerado: ${OUT} (${png.length} bytes)\n`);
