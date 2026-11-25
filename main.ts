// news-image-20261125 — "The World in One Day"
// A program that draws one 1024x1024 image summing up the world's news of
// Wednesday 25 November 2026 and writes it to /output/entry.png.
//
// It uses only the Node standard library: the picture is painted pixel by
// pixel into an RGB buffer (flat vector-style pictograms plus a small 5x7
// bitmap font I drew for the lettering), then encoded as a PNG by hand
// (IHDR / IDAT via zlib deflate / IEND with a table-driven CRC32).
// No network, no randomness, no clock: the same input bytes come out of
// every run, so the two grading runs are byte-identical.
//
// Stories (all events of 25 Nov 2026, checked against the Just Security
// Early Edition for that day and same-day wire summaries):
//   1. Two oil tankers struck mines and caught fire in the Strait of Hormuz.
//   2. Ukrainian drones set the Syzran and Kuibyshev refineries ablaze.
//   3. A Brooklyn jury convicted Huawei of fraud and trade-secret theft.
//   4. Asian stocks tumbled: KOSPI -6.2%, Nikkei -2.8%.
//   5. Australia and Solomon Islands signed a treaty barring foreign bases.
// Also noted in the footer: Shenzhou-24 docked with Tiangong, and
// Colombian police freed the Cartagena supermarket hostages.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const WIDTH = 1024;
const HEIGHT = 1024;

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const PAPER = [245, 241, 232];
const PAPER_ALT = [240, 235, 223];
const NAVY = [16, 30, 51];
const GOLD = [232, 184, 75];
const INK = [16, 30, 51];
const SUBINK = [58, 68, 82];
const TAGRED = [179, 38, 30];
const WHITE = [255, 255, 255];
const RULE = [216, 210, 196];
const FOOTGREY = [201, 206, 214];

type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 bits, written as strings so the
// shape of every letter can be read at a glance. Only the characters the
// image uses are defined: A-Z, 0-9 and a little punctuation.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
};

// ---------------------------------------------------------------------------
// Canvas: a plain RGB buffer with tiny shape helpers.
// ---------------------------------------------------------------------------
const px = new Uint8Array(WIDTH * HEIGHT * 3);

function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}

// Bresenham line, drawn w pixels thick by stamping small squares.
function drawLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  const half = Math.floor(w / 2);
  for (;;) {
    fillRect(x - half, y - half, w, w, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(text: string, x: number, y: number, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT['?'];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === '1') {
          fillRect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(text: string, y: number, scale: number, c: RGB): void {
  drawText(text, Math.floor((WIDTH - textWidth(text, scale)) / 2), y, scale, c);
}

// Greedy word wrap: lines of at most maxWidth pixels at the given scale.
function wrapText(text: string, maxWidth: number, scale: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const trial = line === '' ? word : line + ' ' + word;
    if (textWidth(trial, scale) <= maxWidth) {
      line = trial;
    } else {
      if (line !== '') lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

// ---------------------------------------------------------------------------
// Icons: flat pictograms, one per story, drawn in a 128x128 square.
// ---------------------------------------------------------------------------
function iconShip(x: number, y: number): void {
  fillRect(x, y, 128, 128, [14, 110, 140]);
  // containers on deck
  fillRect(x + 20, y + 50, 22, 24, WHITE);
  fillRect(x + 48, y + 50, 22, 24, WHITE);
  fillRect(x + 76, y + 50, 22, 24, WHITE);
  fillRect(x + 100, y + 58, 10, 16, WHITE);
  // hull, wider at the top
  fillRect(x + 10, y + 76, 108, 8, WHITE);
  fillRect(x + 16, y + 84, 96, 8, WHITE);
  fillRect(x + 24, y + 92, 80, 6, WHITE);
  // waves
  fillRect(x + 12, y + 106, 104, 4, WHITE);
  fillRect(x + 28, y + 114, 72, 4, WHITE);
}

function iconDrone(x: number, y: number): void {
  fillRect(x, y, 128, 128, [61, 74, 92]);
  // arms to the four rotors
  drawLine(x + 54, y + 58, x + 30, y + 36, 4, WHITE);
  drawLine(x + 74, y + 58, x + 98, y + 36, 4, WHITE);
  drawLine(x + 54, y + 68, x + 30, y + 90, 4, WHITE);
  drawLine(x + 74, y + 68, x + 98, y + 90, 4, WHITE);
  // rotor discs with hubs
  for (const [rx, ry] of [[28, 34], [100, 34], [28, 92], [100, 92]] as const) {
    fillCircle(x + rx, y + ry, 10, WHITE);
    fillCircle(x + rx, y + ry, 3, [61, 74, 92]);
  }
  // body and camera eye
  fillRect(x + 54, y + 54, 20, 18, WHITE);
  fillRect(x + 61, y + 59, 6, 6, [61, 74, 92]);
}

function iconCourt(x: number, y: number): void {
  fillRect(x, y, 128, 128, [122, 31, 43]);
  // stepped pediment
  fillRect(x + 44, y + 28, 40, 8, WHITE);
  fillRect(x + 36, y + 36, 56, 8, WHITE);
  fillRect(x + 28, y + 44, 72, 8, WHITE);
  // three columns
  fillRect(x + 30, y + 56, 10, 38, WHITE);
  fillRect(x + 59, y + 56, 10, 38, WHITE);
  fillRect(x + 88, y + 56, 10, 38, WHITE);
  // base
  fillRect(x + 22, y + 96, 84, 8, WHITE);
  fillRect(x + 16, y + 104, 96, 6, WHITE);
}

function iconChart(x: number, y: number): void {
  fillRect(x, y, 128, 128, [140, 29, 24]);
  // axes
  fillRect(x + 20, y + 22, 4, 82, WHITE);
  fillRect(x + 20, y + 100, 88, 4, WHITE);
  // falling line: 28,44 -> 52,60 -> 76,72 -> 100,92
  drawLine(x + 28, y + 44, x + 52, y + 60, 5, WHITE);
  drawLine(x + 52, y + 60, x + 76, y + 72, 5, WHITE);
  drawLine(x + 76, y + 72, x + 100, y + 92, 5, WHITE);
  // arrowhead at the end
  fillRect(x + 92, y + 88, 16, 5, WHITE);
  fillRect(x + 97, y + 93, 6, 12, WHITE);
}

function iconTreaty(x: number, y: number): void {
  fillRect(x, y, 128, 128, [31, 107, 74]);
  // page
  fillRect(x + 34, y + 24, 60, 78, WHITE);
  // lines of text on the page
  fillRect(x + 42, y + 36, 44, 4, [31, 107, 74]);
  fillRect(x + 42, y + 48, 44, 4, [31, 107, 74]);
  fillRect(x + 42, y + 60, 30, 4, [31, 107, 74]);
  // seal and ribbons
  fillCircle(x + 84, y + 86, 12, GOLD);
  fillRect(x + 80, y + 96, 6, 14, GOLD);
  fillRect(x + 90, y + 96, 6, 14, GOLD);
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------
interface Story {
  tag: string;
  headline: string;
  sub: string;
  icon: (x: number, y: number) => void;
}

const STORIES: Story[] = [
  {
    tag: 'MIDDLE EAST',
    headline: 'TWO TANKERS HIT MINES IN HORMUZ',
    sub: "IRAN SAYS TWO OIL TANKERS STRUCK MINES AND CAUGHT FIRE IN THE STRAIT OF HORMUZ.",
    icon: iconShip,
  },
  {
    tag: 'UKRAINE WAR',
    headline: 'DRONES HIT TWO RUSSIAN REFINERIES',
    sub: 'UKRAINIAN DRONES SET THE SYZRAN AND KUIBYSHEV REFINERIES ABLAZE IN SAMARA.',
    icon: iconDrone,
  },
  {
    tag: 'UNITED STATES',
    headline: 'US JURY CONVICTS HUAWEI',
    sub: 'BROOKLYN JURY FINDS HUAWEI GUILTY OF FRAUD AND TRADE-SECRET THEFT.',
    icon: iconCourt,
  },
  {
    tag: 'MARKETS',
    headline: 'ASIAN STOCKS TUMBLE',
    sub: "SOUTH KOREA'S KOSPI FALLS 6.2% AND JAPAN'S NIKKEI 2.8% AS AI SHARES SLIDE.",
    icon: iconChart,
  },
  {
    tag: 'PACIFIC',
    headline: 'AUSTRALIA-SOLOMONS TREATY SIGNED',
    sub: 'CANBERRA PACT BARS ANY FOREIGN MILITARY BASE IN SOLOMON ISLANDS.',
    icon: iconTreaty,
  },
];

// ---------------------------------------------------------------------------
// Layout: masthead, five story rows, footer.
// ---------------------------------------------------------------------------
function render(): void {
  fillRect(0, 0, WIDTH, HEIGHT, PAPER);

  // Masthead
  fillRect(0, 0, WIDTH, 148, NAVY);
  drawTextCentered('THE WORLD IN ONE DAY', 30, 6, WHITE);
  drawTextCentered('WEDNESDAY - 25 NOVEMBER 2026', 96, 3, GOLD);
  fillRect(0, 148, WIDTH, 4, GOLD);

  // Story rows
  const blockH = 160;
  const textX = 164;
  const textW = WIDTH - textX - 16;
  STORIES.forEach((story, i) => {
    const y0 = 152 + i * blockH;
    fillRect(0, y0, WIDTH, blockH, i % 2 === 0 ? WHITE : PAPER_ALT);
    story.icon(16, y0 + 16);
    drawText(story.tag, textX, y0 + 18, 2, TAGRED);
    const headLines = wrapText(story.headline, textW, 4);
    headLines.forEach((line, li) => {
      drawText(line, textX, y0 + 44 + li * 30, 4, INK);
    });
    const subY = y0 + 44 + headLines.length * 30 + 6;
    const subLines = wrapText(story.sub, textW, 3);
    subLines.forEach((line, li) => {
      drawText(line, textX, subY + li * 24, 3, SUBINK);
    });
    fillRect(0, y0 + blockH - 1, WIDTH, 1, RULE);
  });

  // Footer
  const footY = 152 + STORIES.length * blockH;
  fillRect(0, footY, WIDTH, HEIGHT - footY, NAVY);
  drawTextCentered(
    'ALSO: SHENZHOU-24 DOCKS WITH TIANGONG - COLOMBIA HOSTAGES FREED IN CARTAGENA',
    footY + 14,
    2,
    WHITE,
  );
  drawTextCentered(
    'COMPILED FROM WIRE REPORTS - JUST SECURITY EARLY EDITION - 25 NOV 2026',
    footY + 42,
    2,
    FOOTGREY,
  );
}

// ---------------------------------------------------------------------------
// PNG encoding: signature, IHDR, IDAT (zlib), IEND. CRC32, table-driven.
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(): Buffer {
  const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  for (let y = 0; y < HEIGHT; y++) {
    raw[y * (1 + WIDTH * 3)] = 0; // filter: none
    raw.set(px.subarray(y * WIDTH * 3, (y + 1) * WIDTH * 3), y * (1 + WIDTH * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
render();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePng());
