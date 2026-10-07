// ZX Spectrum tape images: .tap (raw ROM blocks) and .tzx (the preservation
// format that also records turbo loaders and timing). Lists what is on the
// tape the way the Spectrum announced it ("Program: ELITE"), decodes BASIC
// listings, draws loading screens, and renders the tape back to audio.
//
// TAP: blocks of [length LE16][flag][payload][xor checksum]. A header block
// is 19 bytes with flag 0: type (0 program, 1 number array, 2 character
// array, 3 code), 10-character name, data length, param 1 (autostart line or
// start address), param 2 (program length without variables). The block
// after it (flag 0xFF) carries the data.
//
// TZX ("ZXTape!" 0x1A, version): a list of typed blocks. 0x10 is a TAP block
// with a pause; 0x11/0x14 are the same with custom timings; 0x12/0x13/0x15
// are raw pulses; the 0x2x-0x3x blocks are flow control and text. Every block
// added after v1.10 starts with a 4-byte length, so unknown ones can be
// skipped. Spec: https://worldofspectrum.net/TZXformat.html
//
// Timings are in Z80 T-states at 3.5 MHz. The ROM loader's: pilot pulse 2168
// (8063 of them before a header, 3223 before data), sync 667 + 735, bit 0 two
// pulses of 855, bit 1 two of 1710.

import { OpenError, el, bytes, formatBytes } from '../ui-kit.js';

const CPU = 3500000;
const ROM = { pilot: 2168, sync1: 667, sync2: 735, zero: 855, one: 1710 };

const w16 = (b, p) => b[p] | (b[p + 1] << 8);
const w24 = (b, p) => b[p] | (b[p + 1] << 8) | (b[p + 2] << 16);
const w32 = (b, p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;
const latin = (b) => String.fromCharCode(...b);

// ---------- the Spectrum character set and BASIC tokens -----------------------------

// 0xA3-0xFF. 0xA3/0xA4 are the 128K's SPECTRUM and PLAY (UDGs T and U on a 48K).
const TOKENS = ('SPECTRUM PLAY RND INKEY$ PI FN POINT SCREEN$ ATTR AT TAB VAL$ CODE VAL LEN SIN COS TAN ASN ACS ATN LN EXP INT SQR SGN ABS PEEK IN USR STR$ CHR$ NOT BIN OR AND <= >= <> LINE THEN TO STEP DEF_FN CAT FORMAT MOVE ERASE OPEN_# CLOSE_# MERGE VERIFY BEEP CIRCLE INK PAPER FLASH BRIGHT INVERSE OVER OUT LPRINT LLIST STOP READ DATA RESTORE NEW BORDER CONTINUE DIM REM FOR GO_TO GO_SUB INPUT LOAD LIST LET PAUSE NEXT POKE PRINT PLOT RUN SAVE RANDOMIZE IF CLS DRAW CLEAR RETURN COPY')
  .split(' ').map((t) => t.replace(/_/g, ' '));
// Block graphics 0x80-0x8F: bit 0 top right, 1 top left, 2 bottom right, 3 bottom left.
const BLOCKS = ' ▝▘▀▗▐▚▜▖▞▌▛▄▟▙█';

function zxChar(c) {
  if (c === 0x60) return '£';
  if (c === 0x7f) return '©';
  if (c >= 0x20 && c < 0x80) return String.fromCharCode(c);
  if (c >= 0x80 && c <= 0x8f) return BLOCKS[c - 0x80];
  if (c >= 0x90 && c <= 0xa2) return '\\' + String.fromCharCode(0x41 + c - 0x90); // UDG, as zmakebas writes it
  if (c >= 0xa3) return TOKENS[c - 0xa3];
  return '?';
}

export const zxName = (b) => Array.from(b, zxChar).join('').trimEnd();

// A tokenised BASIC program as LIST printed it. len: program length without
// the variables area (header param 2).
export function basicListing(d, len = d.length) {
  const lines = [];
  let i = 0;
  len = Math.min(len, d.length);
  while (i + 4 <= len) {
    const num = (d[i] << 8) | d[i + 1];
    if (num > 16383) break; // past the program: variables or junk
    const size = w16(d, i + 2);
    i += 4;
    const end = Math.min(i + size, len);
    let out = '';
    let inString = false;
    for (let j = i; j < end; j++) {
      const c = d[j];
      if (c === 0x0d) break;
      if (c === 0x22) inString = !inString;
      if (!inString) {
        if (c === 0x0e) { j += 5; continue; } // hidden 5-byte number after the digits
        if (c >= 0x10 && c <= 0x15) { j += 1; continue; } // INK, PAPER... control + 1 byte
        if (c === 0x16 || c === 0x17) { j += 2; continue; } // AT, TAB control + 2 bytes
      }
      if (c >= 0xa3 && !inString) {
        const tok = TOKENS[c - 0xa3];
        // As the ROM prints them: words get a space after; commands and
        // operators (OR onwards) also get one before, functions do not.
        out += /^[A-Z]/.test(tok) ? (c >= 0xc5 && out && !out.endsWith(' ') ? ' ' : '') + tok + ' ' : tok;
      } else {
        out += zxChar(c);
      }
    }
    lines.push(`${String(num).padStart(4)} ${out.trimEnd()}`);
    i += size;
  }
  return lines.join('\n');
}

// ---------- tape structure ---------------------------------------------------------

const HEADER_TYPES = ['Program', 'Number array', 'Character array', 'Bytes'];
const INFO = { 0: 'Title', 1: 'Publisher', 2: 'Author', 3: 'Year', 4: 'Language', 5: 'Type', 6: 'Price', 7: 'Loader', 8: 'Origin', 0xff: 'Comment' };

function readTap(b) {
  const blocks = [];
  let p = 0;
  while (p + 2 <= b.length) {
    const n = w16(b, p);
    if (p + 2 + n > b.length) throw new OpenError('decode', 'This tape file is cut short: the last block is incomplete.');
    blocks.push({ id: 0x10, pause: 1000, data: b.subarray(p + 2, p + 2 + n) });
    p += 2 + n;
  }
  if (!blocks.length || p !== b.length) throw new OpenError('wrong_type', 'This does not look like a ZX Spectrum .tap file.');
  return { kind: 'TAP', blocks, info: [] };
}

function readTzx(b) {
  const blocks = [];
  const info = [];
  let p = 10;
  let truncated = false;
  while (p < b.length) {
    const id = b[p++];
    const blk = { id };
    let next;
    switch (id) {
      case 0x10: blk.pause = w16(b, p); next = p + 4 + w16(b, p + 2); blk.data = b.subarray(p + 4, next); break;
      case 0x11:
        Object.assign(blk, { pilot: w16(b, p), sync1: w16(b, p + 2), sync2: w16(b, p + 4), zero: w16(b, p + 6), one: w16(b, p + 8), pilots: w16(b, p + 10), used: b[p + 12], pause: w16(b, p + 13) });
        next = p + 18 + w24(b, p + 15); blk.data = b.subarray(p + 18, next); break;
      case 0x12: blk.pulse = w16(b, p); blk.count = w16(b, p + 2); next = p + 4; break;
      case 0x13: blk.pulses = Array.from({ length: b[p] }, (_, k) => w16(b, p + 1 + k * 2)); next = p + 1 + b[p] * 2; break;
      case 0x14:
        Object.assign(blk, { zero: w16(b, p), one: w16(b, p + 2), used: b[p + 4], pause: w16(b, p + 5) });
        next = p + 10 + w24(b, p + 7); blk.data = b.subarray(p + 10, next); break;
      case 0x15:
        Object.assign(blk, { ts: w16(b, p), pause: w16(b, p + 2), used: b[p + 4] });
        next = p + 8 + w24(b, p + 5); blk.samples = b.subarray(p + 8, next); break;
      case 0x18: case 0x19: blk.unsupported = true; next = p + 4 + w32(b, p); break;
      case 0x20: blk.pause = w16(b, p); next = p + 2; break;
      case 0x21: blk.text = latin(b.subarray(p + 1, p + 1 + b[p])); next = p + 1 + b[p]; break;
      case 0x22: case 0x25: case 0x27: next = p; break;
      case 0x23: next = p + 2; break;
      case 0x24: blk.count = w16(b, p); next = p + 2; break;
      case 0x26: next = p + 2 + w16(b, p) * 2; break;
      case 0x28: next = p + 2 + w16(b, p); break;
      case 0x2a: next = p + 4 + w32(b, p); break;
      case 0x2b: blk.level = b[p + 4]; next = p + 4 + w32(b, p); break;
      case 0x30: blk.text = latin(b.subarray(p + 1, p + 1 + b[p])); next = p + 1 + b[p]; break;
      case 0x31: blk.text = latin(b.subarray(p + 2, p + 2 + b[p + 1])); next = p + 2 + b[p + 1]; break;
      case 0x32: {
        next = p + 2 + w16(b, p);
        let q = p + 3;
        for (let k = 0; k < b[p + 2] && q + 2 <= next; k++) {
          info.push([INFO[b[q]] || 'Info', latin(b.subarray(q + 2, q + 2 + b[q + 1])).replace(/\r/g, '\n')]);
          q += 2 + b[q + 1];
        }
        break;
      }
      case 0x33: next = p + 1 + b[p] * 3; break;
      case 0x34: next = p + 8; break;
      case 0x35: next = p + 20 + w32(b, p + 16); break;
      case 0x40: next = p + 3 + w24(b, p); break;
      case 0x5a: next = p + 9; break;
      case 0x16: case 0x17: next = p + 4 + w32(b, p); break; // deprecated C64 blocks
      default: next = p + 4 + w32(b, p);
    }
    if (next > b.length) { truncated = true; break; }
    blocks.push(blk);
    p = next;
  }
  return { kind: `TZX ${b[8]}.${String(b[9]).padStart(2, '0')}`, blocks, info, truncated };
}

export function readTape(b) {
  if (latin(b.subarray(0, 7)) === 'ZXTape!' && b[7] === 0x1a) return describe(readTzx(b));
  return describe(readTap(b));
}

// Pair each header with the data block after it: these are the "files".
function describe(tape) {
  const files = [];
  let pending = null;
  for (const blk of tape.blocks) {
    const d = blk.data;
    if (!d || d.length < 2) continue;
    let xor = 0;
    for (const x of d) xor ^= x;
    const ok = xor === 0;
    if (d[0] === 0 && d.length === 19 && d[1] <= 3) {
      pending = { type: d[1], name: zxName(d.subarray(2, 12)), length: w16(d, 12), param1: w16(d, 14), param2: w16(d, 16) };
      continue;
    }
    const payload = d.subarray(1, d.length - 1);
    files.push({ ...(pending || { type: -1, name: '', length: payload.length }), payload, ok, standard: d[0] === 0xff && !!pending });
    pending = null;
  }
  return { ...tape, files };
}

export function fileLabel(f) {
  if (f.type === 0) return 'Program' + (f.param1 < 10000 ? ` (runs from line ${f.param1})` : '');
  if (f.type === 3) return f.length === 6912 ? 'Screen' : `Bytes at ${f.param1}`;
  if (f.type >= 0) return HEADER_TYPES[f.type];
  return 'Headerless data';
}

// ---------- loading screens --------------------------------------------------------

// 256x192 bitmap in the Spectrum's interleaved order, then 32x24 attributes:
// ink bits 0-2, paper 3-5, bright 6 (flash is ignored).
export function screenPixels(s) {
  const rgba = new Uint8ClampedArray(256 * 192 * 4);
  for (let y = 0; y < 192; y++) {
    const row = ((y & 0xc0) << 5) | ((y & 7) << 8) | ((y & 0x38) << 2);
    for (let cx = 0; cx < 32; cx++) {
      const bits = s[row + cx];
      const attr = s[6144 + (y >> 3) * 32 + cx];
      const v = attr & 0x40 ? 255 : 215;
      for (let k = 0; k < 8; k++) {
        const c = bits & (0x80 >> k) ? attr & 7 : (attr >> 3) & 7;
        const o = (y * 256 + cx * 8 + k) * 4;
        rgba[o] = c & 2 ? v : 0;
        rgba[o + 1] = c & 4 ? v : 0;
        rgba[o + 2] = c & 1 ? v : 0;
        rgba[o + 3] = 255;
      }
    }
  }
  return rgba;
}

function screenCanvas(s) {
  const canvas = el('canvas', { width: 256, height: 192, class: 'zx-screen' });
  canvas.getContext('2d').putImageData(new ImageData(screenPixels(s), 256, 192), 0, 0);
  return canvas;
}

// ---------- audio ------------------------------------------------------------------------

// The tape as a square wave, 8-bit mono. Each pulse flips the level.
export function renderWav(tape, rate = 44100) {
  const k = rate / CPU;
  const chunks = [];
  let buf = new Uint8Array(1 << 20);
  let n = 0;
  let frac = 0;
  let high = false;
  const fill = (count, v) => {
    while (count > 0) {
      const m = Math.min(buf.length - n, count);
      buf.fill(v, n, n + m);
      n += m;
      count -= m;
      if (n === buf.length) { chunks.push(buf); buf = new Uint8Array(1 << 20); n = 0; }
    }
  };
  const span = (t) => { frac += t * k; const c = Math.floor(frac); frac -= c; return c; };
  const pulse = (t) => { high = !high; fill(span(t), high ? 0xc0 : 0x40); };
  const pause = (ms) => {
    if (!ms) return;
    if (high) { fill(Math.round(rate / 1000), 0xc0); high = false; }
    fill(Math.round(ms * rate / 1000), 0x40);
  };
  const bits = (d, zero, one, used = 8) => {
    for (let i = 0; i < d.length; i++) {
      const last = i === d.length - 1 ? used || 8 : 8;
      for (let bit = 0; bit < last; bit++) {
        const t = d[i] & (0x80 >> bit) ? one : zero;
        pulse(t);
        pulse(t);
      }
    }
  };
  const loops = [];
  let skipped = 0;
  for (let i = 0; i < tape.blocks.length; i++) {
    const b = tape.blocks[i];
    switch (b.id) {
      case 0x10:
      case 0x11: {
        const t = b.id === 0x10 ? { ...ROM, pilots: b.data[0] < 128 ? 8063 : 3223, used: 8 } : b;
        for (let p = 0; p < t.pilots; p++) pulse(t.pilot);
        pulse(t.sync1);
        pulse(t.sync2);
        bits(b.data, t.zero, t.one, t.used);
        pause(b.pause);
        break;
      }
      case 0x12: for (let p = 0; p < b.count; p++) pulse(b.pulse); break;
      case 0x13: for (const t of b.pulses) pulse(t); break;
      case 0x14: bits(b.data, b.zero, b.one, b.used); pause(b.pause); break;
      case 0x15:
        for (let s = 0; s < b.samples.length; s++) {
          const last = s === b.samples.length - 1 ? b.used || 8 : 8;
          for (let bit = 0; bit < last; bit++) {
            high = !!(b.samples[s] & (0x80 >> bit));
            fill(span(b.ts), high ? 0xc0 : 0x40);
          }
        }
        pause(b.pause);
        break;
      case 0x20: pause(b.pause || 2000); break; // 0 = "stop the tape": leave a gap
      case 0x24: loops.push({ at: i, left: b.count }); break;
      case 0x25: { const l = loops[loops.length - 1]; if (l && --l.left > 0) i = l.at; else loops.pop(); break; }
      case 0x2b: high = !!b.level; break;
      default: if (b.unsupported) skipped++;
    }
  }
  chunks.push(buf.subarray(0, n));
  const length = chunks.reduce((s, c) => s + c.length, 0);
  const head = new DataView(new ArrayBuffer(44));
  const str = (o, s) => [...s].forEach((ch, j) => head.setUint8(o + j, ch.charCodeAt(0)));
  str(0, 'RIFF'); head.setUint32(4, 36 + length, true); str(8, 'WAVE');
  str(12, 'fmt '); head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 1, true);
  head.setUint32(24, rate, true); head.setUint32(28, rate, true); head.setUint16(32, 1, true); head.setUint16(34, 8, true);
  str(36, 'data'); head.setUint32(40, length, true);
  return { blob: new Blob([head.buffer, ...chunks], { type: 'audio/wav' }), seconds: length / rate, skipped };
}

// TZX -> TAP keeps only standard-speed blocks; anything else would be lost.
export function canTap(tape) {
  return tape.kind !== 'TAP' && tape.blocks.some((b) => b.id === 0x10) && tape.blocks.every((b) => b.id === 0x10 || !(b.data || b.samples || b.pulses || b.pulse || b.unsupported));
}

export function toTap(tape) {
  const parts = [];
  for (const b of tape.blocks) {
    if (b.id !== 0x10) continue;
    parts.push(new Uint8Array([b.data.length & 0xff, b.data.length >> 8]), b.data);
  }
  return new Blob(parts, { type: 'application/octet-stream' });
}

// ---------- page --------------------------------------------------------------------------

export async function open(file, ui) {
  const tape = readTape(await bytes(file));
  const out = ui.output;
  const title = tape.info.find(([k]) => k === 'Title');
  out.append(el('p', { class: 'summary' }, `ZX Spectrum tape (${tape.kind}), ${tape.blocks.length} blocks, ${tape.files.length} ${tape.files.length === 1 ? 'file' : 'files'}` + (title ? `: ${title[1]}` : '')));
  if (tape.info.length) {
    out.append(el('dl', { class: 'tape-info' }, tape.info.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])));
  }
  if (tape.truncated) out.append(el('p', { class: 'note' }, 'The file ends in the middle of a block, so the end of the tape is missing.'));

  const screens = tape.files.filter((f) => f.type === 3 && f.length === 6912 && f.payload.length >= 6912);
  for (const s of screens) out.append(el('figure', { class: 'zx-figure' }, screenCanvas(s.payload), el('figcaption', { class: 'note' }, `Loading screen “${s.name}”`)));

  const rows = tape.files.map((f, i) => {
    const name = (f.name || `block${i + 1}`).replace(/[\\/:*?"<>|]/g, '_');
    return el('tr', {},
      el('td', { class: 'path' }, f.name ? `“${f.name}”` : '—'),
      el('td', {}, fileLabel(f) + (f.ok ? '' : ' · checksum error')),
      el('td', { class: 'num' }, formatBytes(f.payload.length)),
      el('td', { class: 'row-actions' }, el('button', { type: 'button', class: 'link-btn', onclick: () => ui.saveBlob(new Blob([f.payload]), name + (f.type === 0 ? '.bas.bin' : '.bin')) }, 'Save')));
  });
  if (rows.length) {
    out.append(el('div', { class: 'table-wrap' }, el('table', { class: 'files tape-files' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'Type'), el('th', { class: 'num' }, 'Size'), el('th', {}))),
      el('tbody', {}, rows))));
  } else {
    out.append(el('p', { class: 'note' }, 'No standard ROM blocks on this tape: it uses a custom (turbo) loader. Its audio can still be saved as WAV for an emulator or a real Spectrum.'));
  }

  const programs = tape.files.filter((f) => f.type === 0);
  const listings = programs.map((f) => ({ name: f.name, text: basicListing(f.payload, f.param2) }));
  listings.forEach((l, i) => {
    const d = el('details', { class: 'tape-listing', open: i === 0 }, el('summary', {}, `BASIC listing: “${l.name}”`), el('pre', { class: 'doc-mono zx-listing' }, l.text || '(empty)'));
    out.append(d);
  });
  ui.done();

  ui.action('Download tape audio (.wav)', () => {
    const { blob } = renderWav(tape);
    return blob;
  }, ui.baseName + '.wav', 'wav');
  if (canTap(tape)) ui.action('Convert to .tap', () => toTap(tape), ui.baseName + '.tap', 'tap');
  if (listings.length) {
    ui.action('Download BASIC listing (.txt)', () => new Blob([listings.map((l) => `REM ${l.name}\n${l.text}\n`).join('\n')], { type: 'text/plain;charset=utf-8' }), ui.baseName + '.bas.txt', 'txt');
  }
  if (screens.length) {
    ui.action('Download loading screen (.png)', () => new Promise((resolve) => {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 384;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(out.querySelector('canvas.zx-screen'), 0, 0, 512, 384);
      c.toBlob(resolve, 'image/png');
    }), ui.baseName + '.png', 'png');
  }
}
