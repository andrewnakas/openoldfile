// Retro disk images: Commodore 64 (.d64 1541, .d71 1571, .d81 1581) and
// Amiga (.adf, OFS and FFS). Lists the directory the way the machine showed
// it and extracts files.
//
// D64/D71: 256-byte sectors, variable sectors per track; BAM and disk name at
// 18/0, directory chain from 18/1. Each directory sector holds 8 entries of
// 32 bytes (type, first track/sector, 16-char PETSCII name, size in blocks).
// File data is a sector chain: bytes 0-1 = next track/sector (track 0: byte 1
// is the last used byte), data from byte 2. D81: 40 sectors/track, header at
// 40/0, directory from 40/3.
//
// ADF: 1760 blocks of 512 bytes, root block 880 (big-endian longs): hash
// table of 72 header blocks at 24, name (BCPL string) at 432, hash chain at
// 496, secondary type at 508 (1 root, 2 dir, -3 file). Files: size at 324;
// OFS data blocks chain from offset 16 (24-byte header, 488 data bytes); FFS
// lists raw data blocks in the header (reverse order from 24+71*4) and in
// extension blocks linked at 504.

import { zipSync } from 'fflate';
import { OpenError, el, bytes, formatBytes, routeTo } from '../ui-kit.js';
import { sniff } from '../sniff.js';

// ---------- Commodore ----------------------------------------------------------

const D64_SECTORS = (t) => (t <= 17 ? 21 : t <= 24 ? 19 : t <= 30 ? 18 : 17);
const TYPES = ['DEL', 'SEQ', 'PRG', 'USR', 'REL', 'CBM', 'DIR'];

// PETSCII as shown in the C64's upper-case/graphics set.
function petscii(bytes) {
  let s = '';
  for (const c of bytes) {
    if (c === 0xa0) break; // shifted-space padding
    if (c >= 0x20 && c <= 0x5f) s += String.fromCharCode(c);
    else if (c >= 0xc1 && c <= 0xda) s += String.fromCharCode(c - 0x80);
    else if (c >= 0x61 && c <= 0x7a) s += String.fromCharCode(c - 0x20);
    else s += '?';
  }
  return s;
}

function commodore(b) {
  const isD81 = b.length === 819200 || b.length === 822400;
  const isD71 = b.length === 349696 || b.length === 351062;
  const spt = (t) => (isD81 ? 40 : D64_SECTORS(t > 35 && isD71 ? t - 35 : t));
  const tracks = isD81 ? 80 : isD71 ? 70 : 40;
  const starts = [0];
  for (let t = 1; t <= tracks; t++) starts[t] = (starts[t - 1] || 0) + (t > 1 ? spt(t - 1) : 0);
  const off = (t, s) => {
    if (t < 1 || t > tracks || s >= spt(t)) return -1;
    return (starts[t] + s) * 256;
  };

  const hdrT = isD81 ? 40 : 18;
  const header = off(hdrT, 0);
  const name = petscii(b.subarray(header + (isD81 ? 0x04 : 0x90), header + (isD81 ? 0x14 : 0xa0)));
  const id = petscii(b.subarray(header + (isD81 ? 0x16 : 0xa2), header + (isD81 ? 0x1b : 0xa7)));

  const files = [];
  let t = hdrT, s = isD81 ? 3 : 1;
  const seen = new Set();
  while (t && !seen.has(t * 256 + s)) {
    seen.add(t * 256 + s);
    const o = off(t, s);
    if (o < 0) break;
    for (let e = 0; e < 8; e++) {
      const p = o + e * 32;
      const type = b[p + 2];
      if (!type) continue;
      // GEOS files have an info block (bytes 21-22) and a GEOS file type
      // (24); structure 1 (byte 23) is VLIR, a table of record chains.
      const geos = b[p + 21] !== 0 && b[p + 24] !== 0;
      const entry = b.slice(p + 2, p + 32);
      files.push({
        name: petscii(b.subarray(p + 5, p + 21)),
        type: TYPES[type & 7] || '???',
        closed: !!(type & 0x80),
        blocks: b[p + 30] | (b[p + 31] << 8),
        geos,
        data: geos ? () => geosConvert(b, off, entry) : () => chain(b, off, b[p + 3], b[p + 4])
      });
    }
    t = b[o];
    s = b[o + 1];
  }
  // Free blocks: per-track counts in the BAM (D64: 4 bytes per track from 0x04).
  let free = 0;
  if (!isD81) for (let tr = 1; tr <= 35; tr++) if (tr !== 18) free += b[header + tr * 4];
  return { system: 'c64', name, id, files, free };
}

function chain(b, off, t, s) {
  const parts = [];
  const seen = new Set();
  while (t && !seen.has(t * 256 + s)) {
    seen.add(t * 256 + s);
    const o = off(t, s);
    if (o < 0) break;
    const nt = b[o], ns = b[o + 1];
    parts.push(b.subarray(o + 2, nt === 0 ? o + Math.max(2, ns + 1) : o + 256));
    t = nt;
    s = ns;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

// GEOS "Convert" (.cvt) file, the format GEOS tools and emulators import:
//   block 1: the 30-byte directory entry, then a signature, padded to 254
//   block 2: the info block (its 254 data bytes)
//   VLIR files: block 3 is the record table, each (track, sector) pair
//     replaced by (sector count, last-byte index), then every record's
//     sectors, each padded to 254 bytes
//   sequential GEOS files: the data chain follows the info block.
function sectorList(b, off, t, s) {
  const out = [];
  const seen = new Set();
  while (t && !seen.has(t * 256 + s) && out.length < 4096) {
    seen.add(t * 256 + s);
    const o = off(t, s);
    if (o < 0) break;
    out.push(o);
    const nt = b[o], ns = b[o + 1];
    if (!nt) break;
    t = nt;
    s = ns;
  }
  return out;
}

function geosConvert(b, off, entry) {
  const vlir = entry[21] === 1;
  const blocks = [];
  const head = new Uint8Array(254);
  head.set(entry.subarray(0, 30));
  const sig = (vlir ? 'PRG' : 'SEQ') + ' formatted GEOS file V1.0';
  for (let i = 0; i < sig.length; i++) head[30 + i] = sig.charCodeAt(i);
  blocks.push(head);
  const info = off(entry[19], entry[20]);
  blocks.push(info >= 0 ? b.slice(info + 2, info + 256) : new Uint8Array(254));
  if (vlir) {
    const index = off(entry[1], entry[2]);
    const table = new Uint8Array(254);
    const records = [];
    for (let r = 0; r < 127 && index >= 0; r++) {
      const t = b[index + 2 + r * 2], s = b[index + 3 + r * 2];
      if (t === 0) { table[r * 2] = 0; table[r * 2 + 1] = s; continue; } // 00 00 end, 00 FF empty
      const secs = sectorList(b, off, t, s);
      const last = secs.length ? b[secs[secs.length - 1] + 1] : 0;
      table[r * 2] = secs.length;
      table[r * 2 + 1] = last;
      for (const o of secs) records.push(b.slice(o + 2, o + 256));
    }
    blocks.push(table, ...records);
  } else {
    for (const o of sectorList(b, off, entry[1], entry[2])) blocks.push(b.slice(o + 2, o + 256));
  }
  const out = new Uint8Array(blocks.length * 254);
  blocks.forEach((x, i) => out.set(x, i * 254));
  return out;
}

// ---------- Amiga ------------------------------------------------------------------

function amiga(b) {
  if (String.fromCharCode(b[0], b[1], b[2]) !== 'DOS') throw new OpenError('decode', 'This Amiga disk is not an AmigaDOS disk (it may be a game with its own custom format, which only an emulator can run).');
  const ffs = (b[3] & 1) === 1;
  const blocks = b.length / 512;
  const L = (blk, o) => ((b[blk * 512 + o] << 24) | (b[blk * 512 + o + 1] << 16) | (b[blk * 512 + o + 2] << 8) | b[blk * 512 + o + 3]) >>> 0;
  const S = (blk, o) => L(blk, o) | 0;
  const bcpl = (blk, o) => new TextDecoder('latin1').decode(b.subarray(blk * 512 + o + 1, blk * 512 + o + 1 + Math.min(30, b[blk * 512 + o])));
  const valid = (blk) => blk > 1 && blk < blocks;

  const root = Math.floor(blocks / 2);
  const files = [];
  const walk = (dirBlk, prefix, depth) => {
    if (depth > 16) return;
    for (let h = 0; h < 72; h++) {
      let blk = L(dirBlk, 24 + h * 4);
      const seen = new Set();
      while (valid(blk) && !seen.has(blk)) {
        seen.add(blk);
        const name = bcpl(blk, 432);
        const sec = S(blk, 508);
        if (sec === 2) walk(blk, prefix + name + '/', depth + 1);
        else if (sec === -3) {
          const fileBlk = blk;
          files.push({ name: prefix + name, size: L(blk, 324), data: () => readAmigaFile(fileBlk) });
        }
        blk = L(blk, 496);
      }
    }
  };

  function readAmigaFile(hdr) {
    const size = L(hdr, 324);
    const out = new Uint8Array(size);
    let at = 0;
    if (!ffs) {
      let blk = L(hdr, 16);
      const seen = new Set();
      while (valid(blk) && at < size && !seen.has(blk)) {
        seen.add(blk);
        const n = Math.min(L(blk, 12), 488, size - at);
        out.set(b.subarray(blk * 512 + 24, blk * 512 + 24 + n), at);
        at += n;
        blk = L(blk, 16);
      }
    } else {
      let table = hdr;
      const seen = new Set();
      while (valid(table) && at < size && !seen.has(table)) {
        seen.add(table);
        for (let k = 71; k >= 0 && at < size; k--) {
          const blk = L(table, 24 + k * 4);
          if (!valid(blk)) break;
          const n = Math.min(512, size - at);
          out.set(b.subarray(blk * 512, blk * 512 + n), at);
          at += n;
        }
        table = L(table, 504);
      }
    }
    return out.subarray(0, at);
  }

  walk(root, '', 0);
  return { system: 'amiga', name: bcpl(root, 432), files, ffs };
}

// ---------- page ------------------------------------------------------------------

export function readDisk(b, ext) {
  if (ext === 'adf' || (b.length === 901120 || b.length === 1802240)) return amiga(b);
  if ([174848, 175531, 196608, 197376, 349696, 351062, 819200, 822400].includes(b.length) || /^d(64|71|81)$/.test(ext)) return commodore(b);
  throw new OpenError('wrong_type', 'This does not look like a C64 or Amiga disk image (the size does not match any standard disk).');
}

export async function open(file, ui) {
  const disk = readDisk(await bytes(file), ui.ext);
  if (disk.system === 'c64') {
    // The C64's own directory listing: LOAD"$",8 then LIST.
    const lines = [`0 “${disk.name.padEnd(16)}” ${disk.id}`];
    for (const f of disk.files) lines.push(`${String(f.blocks).padEnd(5)}“${f.name}”${' '.repeat(Math.max(1, 17 - f.name.length))}${f.closed ? ' ' : '*'}${f.type}`);
    if (disk.free) lines.push(`${disk.free} BLOCKS FREE.`);
    ui.output.append(el('pre', { class: 'c64-screen' }, lines.join('\n')));
  } else {
    ui.output.append(el('p', { class: 'summary' }, `Amiga ${disk.ffs ? 'FFS' : 'OFS'} disk “${disk.name}”, ${disk.files.length} files`));
  }
  if (!disk.files.length) ui.output.append(el('p', { class: 'note' }, 'The disk has no files in its directory. Many games used their own disk format; those only run in an emulator.'));

  const rows = disk.files.map((f) => {
    const name = disk.system === 'c64' ? f.name + '.' + (f.geos ? 'cvt' : f.type.toLowerCase()) : f.name.split('/').pop();
    const save = el('button', { type: 'button', class: 'link-btn', onclick: () => ui.saveBlob(new Blob([f.data()]), safe(name)) }, 'Save');
    const cell = el('td', { class: 'row-actions' }, save);
    const inner = new File([f.data()], name);
    sniff(inner).then((hit) => { if (hit && hit.slug) cell.prepend(el('button', { type: 'button', class: 'link-btn', onclick: () => routeTo(hit.slug, inner) }, 'Open'), ' '); });
    const size = disk.system === 'c64' ? `${f.blocks} blocks` : formatBytes(f.size);
    return el('tr', {}, el('td', { class: 'path' }, f.name + (disk.system === 'c64' ? '  ' + (f.geos ? 'GEOS ' : '') + f.type : '')), el('td', { class: 'num' }, size), cell);
  });
  if (rows.length) ui.output.append(el('div', { class: 'table-wrap' }, el('table', { class: 'files' }, el('tbody', {}, rows))));
  ui.done();

  if (disk.files.length) ui.action('Download all files (.zip)', () => {
    const tree = {};
    for (const f of disk.files) tree[safe(disk.system === 'c64' ? f.name + '.' + (f.geos ? 'cvt' : f.type.toLowerCase()) : f.name)] = [f.data(), { level: 6 }];
    return new Blob([zipSync(tree)], { type: 'application/zip' });
  }, ui.baseName + '.zip', 'zip');
}

const safe = (n) => n.replace(/[\\:*?"<>|]/g, '_').replace(/^\/+/, '') || 'file';
