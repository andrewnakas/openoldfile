// Identify a file from its first bytes, falling back to the extension.
// Used by the home page to route a dropped file, and by every format page to
// notice a file that belongs on a different page.
//
// Returns { slug } for a format this site opens, { elsewhere } for one a
// sister site owns, { planned } for a format whose page is not built yet, or
// null when nothing matches.

import { CATALOG as FORMATS, ELSEWHERE, PLANNED } from './catalog.js';
import { looksLikeWordStar } from './engines/wordstar.js';
import { isAmiPro } from './engines/amipro.js';

const ascii = (b, start, len) => String.fromCharCode(...b.subarray(start, start + len));

// Magic-byte tests, most specific first. Each returns a slug, an extension
// (prefixed "ext:") to look up in ELSEWHERE/PLANNED, or null.
const TESTS = [
  (b) => (ascii(b, 0, 4) === 'ITSF' ? 'chm' : null),
  (b) => (ascii(b, 0, 4) === 'MSCF' ? 'cab' : null),
  (b) => (b[0] === 0x60 && b[1] === 0xea ? 'arj' : null),
  (b) => (/^-l[hz][0-9a-z ]-$/.test(ascii(b, 2, 5)) ? 'lzh' : null),
  (b) => (b[0] === 0x1f && b[1] === 0x9d ? 'z' : null),
  (b) => (/^[FCZ]WS$/.test(ascii(b, 0, 3)) ? 'swf' : null),
  (b) => (ascii(b, 0, 4) === 'MThd' ? 'mid' : null),
  (b) => (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'RMID' ? 'mid' : null),
  (b) => (ascii(b, 0, 17) === 'Extended Module: ' ? 'mod' : null),
  (b) => (ascii(b, 44, 4) === 'SCRM' ? 'mod' : null),
  (b) => (ascii(b, 0, 4) === 'IMPM' ? 'mod' : null),
  (b) => (/^MMD[0-3]$/.test(ascii(b, 0, 4)) ? 'mod' : null),
  (b) => (b.length > 1084 && /^(M\.K\.|M!K!|FLT[48]|[2-9]CHN|[1-3][0-9]CH|CD81|OKTA)$/.test(ascii(b, 1080, 4)) ? 'mod' : null),
  (b) => (b[0] === 0xd7 && b[1] === 0xcd && b[2] === 0xc6 && b[3] === 0x9a ? 'wmf' : null),
  (b) => ((b[0] === 1 || b[0] === 2) && b[1] === 0 && b[2] === 9 && b[3] === 0 && b[4] === 0 && (b[5] === 1 || b[5] === 3) ? 'wmf' : null),
  (b) => (b[0] === 1 && b[1] === 0 && b[2] === 0 && b[3] === 0 && ascii(b, 40, 4) === ' EMF' ? 'emf' : null),
  (b) => ((b[0] === 0x31 || b[0] === 0x32) && b[1] === 0xbe && b[2] === 0 && b[3] === 0 && b[4] === 0 && b[5] === 0xab ? 'wri' : null),
  (b) => (b[0] === 0 && b[1] === 0 && b[2] === 2 && b[3] === 0 && b[4] === 0x20 && b[5] === 0x51 ? 'wq1' : null), // Quattro DOS
  (b) => (b[0] === 0 && b[1] === 0 && b[2] === 2 && b[3] === 0 && b[4] === 0x01 && b[5] === 0x10 ? 'wq1' : null), // Quattro Windows
  (b) => (b[0] === 0xff && b[1] === 0 && b[2] === 2 && b[3] === 0 && b[4] === 4 && b[5] === 4 ? 'xlr' : null), // Works for Windows .wks
  (b) => (b[0] === 0 && b[1] === 0 && (b[2] === 2 || b[2] === 0x1a) && b[3] === 0 && (b[5] === 4 || b[5] === 0x10) ? 'wk1' : null),
  (b) => (isDbf(b) ? 'dbf' : null),
  (b) => (isAmiPro(b) ? 'sam' : null),
  (b) => (b[0] === 0xff && ascii(b, 1, 3) === 'WPC' ? (b[9] === 0x16 ? 'wpg' : 'wpd') : null), // WordPerfect 5+: document or graphic (file type at 9)
  (b) => (ascii(b, 4, 4) === 'BOBO' ? 'cwk' : null), // ClarisWorks / AppleWorks
  (b) => (b[0] === 0xfe && b[1] === 0x37 && b[2] === 0 && b[3] === 0x23 ? 'macwrite' : null), // Word for Mac 4/5
  (b) => (b[0] === 0 && b[1] === 0x06 && b[2] === 0 ? 'macwrite' : null), // MacWrite 4.5/5
  (b) => (ascii(b, 0, 8) === 'WriteNow' ? 'macwrite' : null),
  // Formats owned elsewhere or not built yet.
  
  (b) => (b[0] === 0x3f && b[1] === 0x5f && b[2] === 3 && b[3] === 0 ? 'hlp' : null),
  (b) => (ascii(b, 0, 4) === 'SIT!' || ascii(b, 0, 8) === 'StuffIt ' ? 'ext:sit' : null),
  (b) => (ascii(b, 0, 64).includes('(This file must be converted with BinHex') ? 'ext:hqx' : null),
  (b) => (ascii(b, 0, 4) === 'PSID' || ascii(b, 0, 4) === 'RSID' ? 'ext:sid' : null),
  (b) => (ascii(b, 0, 4) === '.RMF' || (ascii(b, 0, 3) === '.ra' && b[3] === 0xfd) ? 'rm' : null),
  (b) => (b[0] === 0x4d && b[1] === 0x5a ? 'ext:exe' : null),
  // PICT: no magic, but the version opcode sits at a fixed offset after the
  // optional 512-byte header and the picture size and frame.
  (b) => (((b[522] === 0x00 && b[523] === 0x11 && b[524] === 0x02 && b[525] === 0xff) || (b[522] === 0x11 && b[523] === 0x01)) ? 'pict' : null),
  (b) => (((b[10] === 0x00 && b[11] === 0x11 && b[12] === 0x02 && b[13] === 0xff) || (b[10] === 0x11 && b[11] === 0x01)) ? 'pict' : null),
  // Last: WordStar has no signature, only a statistical shape.
  (b) => (looksLikeWordStar(b) ? 'wordstar' : null)
];

// dBASE has no signature, so check that the header is self-consistent:
// a known version byte, a plausible last-update date, and a header length
// that is a whole number of 32-byte field descriptors plus terminator.
function isDbf(b) {
  if (b.length < 68) return false;
  const versions = [0x02, 0x03, 0x04, 0x05, 0x30, 0x31, 0x32, 0x43, 0x63, 0x83, 0x8b, 0xcb, 0xf5, 0xfb];
  if (!versions.includes(b[0])) return false;
  const month = b[2], day = b[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const headerLen = b[8] | (b[9] << 8);
  const recordLen = b[10] | (b[11] << 8);
  if (headerLen < 65 || recordLen < 1) return false;
  // Visual FoxPro adds a 263-byte backlink after the terminator.
  const fields = b[0] === 0x30 || b[0] === 0x31 || b[0] === 0x32 ? headerLen - 263 : headerLen;
  return (fields - 33) % 32 === 0 || (fields - 32) % 32 === 0;
}

export function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
}

function byExt(ext) {
  if (!ext) return null;
  const f = FORMATS.find((x) => x.exts.includes(ext));
  if (f) return { slug: f.slug };
  const e = ELSEWHERE.find((x) => x.exts.includes(ext));
  if (e) return { elsewhere: e };
  const p = PLANNED.find((x) => x.exts.includes(ext));
  if (p) return { planned: p };
  return null;
}

// Extensions shared by two pages: the bytes decide, and the extension only
// breaks ties (a Works .wks and a Lotus .wks look the same to a user).
// Disk images have no signature; their exact size gives them away.
const D64_SIZES = [174848, 175531, 196608, 197376, 349696, 351062, 819200, 822400];

export async function sniff(file) {
  if (D64_SIZES.includes(file.size) && /^(d64|d71|d81|bin|img|)$/.test(extOf(file.name))) return { slug: 'd64' };
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const ext = extOf(file.name);
  if ((file.size === 901120 || file.size === 1802240) && ascii(head, 0, 3) === 'DOS') return { slug: 'adf' };
  for (const test of TESTS) {
    const hit = test(head);
    if (!hit) continue;
    if (hit.startsWith('ext:')) return byExt(hit.slice(4));
    // A gzip-wrapped metafile or an OLE/zip container has no magic of its own
    // above; those fall through to the extension below.
    return { slug: hit };
  }
  // Containers whose type depends on what is inside: trust the extension.
  return byExt(ext);
}
