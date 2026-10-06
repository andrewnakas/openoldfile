// LHA/LZH archives store file names as raw bytes, usually Shift-JIS, and
// 7-Zip mangles anything non-ASCII. This walks the LZH headers (levels 0-2)
// to recover the real names, so the archive engine can relabel 7-Zip's
// output.
//
// Level 0/1: [0] header size, [7..10] packed size, [11..14] original size,
//   [20] level, [21] name length, [22..] name (paths use '\' or 0xFF).
//   Level 1 adds extended headers counted in the packed size.
// Level 2: [0..1] header size (whole header), [7..10] packed, [11..14]
//   original, [20] level, [24..25] first extended header size; extended
//   headers are [size word][type][data]: type 1 = file name, 2 = directory
//   (0xFF-separated).

const sjis = new TextDecoder('shift_jis');
const utf8 = new TextDecoder('utf-8', { fatal: true });

function decodeName(bytes) {
  try { return utf8.decode(bytes); } catch { return sjis.decode(bytes); }
}

export function lzhEntries(b) {
  const out = [];
  const u16 = (o) => b[o] | (b[o + 1] << 8);
  const u32 = (o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  let o = 0;
  // Self-extracting archives: skip to the first "-lh?-" header.
  for (let k = 0; k < Math.min(b.length - 7, 65536); k++) {
    if (b[k + 2] === 0x2d && b[k + 3] === 0x6c && (b[k + 4] === 0x68 || b[k + 4] === 0x7a) && b[k + 6] === 0x2d) { o = k; break; }
  }
  for (let guard = 0; o + 22 < b.length && guard < 100000; guard++) {
    if (b[o] === 0) break;
    const level = b[o + 20];
    const packed = u32(o + 7);
    const size = u32(o + 11);
    let nameBytes = [];
    let dirBytes = [];
    let next;
    if (level === 0 || level === 1) {
      const hsize = b[o];
      const nlen = b[o + 21];
      nameBytes = Array.from(b.subarray(o + 22, o + 22 + nlen));
      next = o + 2 + hsize + packed;
      if (level === 1) {
        // Extended headers follow the base header; their sizes are part of
        // "packed" already, so only parse them for a directory name.
        let ext = o + 2 + hsize;
        let extSize = u16(ext - 2);
        while (extSize > 2 && ext + extSize <= b.length) {
          const type = b[ext];
          if (type === 1) nameBytes = Array.from(b.subarray(ext + 1, ext + extSize - 2));
          if (type === 2) dirBytes = Array.from(b.subarray(ext + 1, ext + extSize - 2));
          ext += extSize;
          extSize = u16(ext - 2);
        }
      }
    } else if (level === 2) {
      const hsize = u16(o);
      let ext = o + 24;
      let extSize = u16(ext);
      ext += 2;
      while (extSize >= 3 && ext + extSize - 2 <= o + hsize) {
        const type = b[ext];
        const data = Array.from(b.subarray(ext + 1, ext + extSize - 2));
        if (type === 1) nameBytes = data;
        if (type === 2) dirBytes = data;
        ext += extSize - 2;
        extSize = u16(ext);
        ext += 2;
      }
      next = o + hsize + packed;
    } else {
      break;
    }
    // Decode before splitting: in Shift-JIS a 0x5C byte can be the second
    // half of a character (表 is 0x95 0x5C), so only a decoded '\\' is a
    // separator. Level 2 directories use 0xFF between parts.
    const parts = [];
    let cur = [];
    for (const c of dirBytes) { if (c === 0xff) { parts.push(cur); cur = []; } else cur.push(c); }
    if (cur.length) parts.push(cur);
    const dirs = parts.filter((x) => x.length).map((x) => decodeName(Uint8Array.from(x)));
    const path = [...dirs, decodeName(Uint8Array.from(nameBytes))].join('/').replace(/\\/g, '/');
    const isDir = String.fromCharCode(b[o + 2], b[o + 3], b[o + 4], b[o + 5], b[o + 6]) === '-lhd-';
    if (!isDir) out.push({ name: path, size });
    if (!(next > o)) break;
    o = next;
  }
  return out;
}

// ASCII bones of a name: non-ASCII runs collapse to '*'.
const skeleton = (s) => s.replace(/[^\x20-\x7e]+/g, '*');

// Relabel 7-Zip's entries with the archive's real names, matching each one
// by uncompressed size and ASCII skeleton.
export function fixLzhNames(entries, archiveBytes) {
  if (!entries.some((e) => /[^\x20-\x7e]/.test(e.path))) return entries;
  const real = lzhEntries(archiveBytes);
  const used = new Set();
  for (const e of entries) {
    const sk = skeleton(e.path);
    const i = real.findIndex((r, k) => !used.has(k) && r.size === e.data.length && skeleton(r.name) === sk);
    const j = i >= 0 ? i : real.findIndex((r, k) => !used.has(k) && r.size === e.data.length && /[^\x20-\x7e]/.test(r.name));
    if (j >= 0) { used.add(j); e.path = real[j].name; }
  }
  return entries;
}
