// Windows Write (.wri) decoder.
//
// Layout of a Write file (128-byte pages, little-endian):
//   page 0          header: wIdent 0xBE31/0xBE32, fcMac (end of text) and the
//                   page numbers of the tables below
//   128 .. fcMac    the text, Windows-1252, paragraphs end in CR LF
//   pnChar ..       character-run pages (FKPs) — fonts, bold, italic, size
//   pnPara ..       paragraph-run pages — alignment, indents, headers,
//                   picture paragraphs
//   pnFfntb         font-name table
// Each FKP page: dword fcFirst, then 6-byte FODs (dword fcLim, word bfprop)
// from offset 4, and the FOD count in the last byte. bfprop points (from
// offset 4) at a property blob: a length byte then the bytes that differ
// from the defaults.

import { OpenError, el, bytes } from '../ui-kit.js';

const PAGE = 128;
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function parseWri(b) {
  const ident = u16(b, 0);
  if ((ident !== 0xbe31 && ident !== 0xbe32) || u16(b, 4) !== 0xab00) {
    throw new OpenError('wrong_type', 'This is not a Windows Write file. If it came from Microsoft Word for DOS or Works, those formats are on the way.');
  }
  const fcMac = u32(b, 14);
  const pnPara = u16(b, 18);
  const pnFntb = u16(b, 20);
  const pnSep = u16(b, 22);
  const pnFfntb = u16(b, 28);
  const pnMac = u16(b, 96);
  if (fcMac < PAGE || fcMac > b.length) throw new OpenError('decode', 'The file is shorter than its header says. It may be truncated.');

  const pnChar = Math.ceil(fcMac / PAGE);
  const fonts = readFonts(b, pnFfntb, pnMac);
  const charRuns = readRuns(b, pnChar, pnPara, fcMac, readChp);
  const paraEnd = Math.min(...[pnFntb, pnSep, pnFfntb, pnMac].filter((p) => p > pnPara));
  const paraRuns = readRuns(b, pnPara, paraEnd, fcMac, readPap);

  const decoder = new TextDecoder('windows-1252');
  const paragraphs = [];
  for (const para of paraRuns) {
    const p = { ...para.props, runs: [] };
    if (p.picture) {
      paragraphs.push(p);
      continue;
    }
    for (const cr of charRuns) {
      const start = Math.max(cr.start, para.start);
      const end = Math.min(cr.end, para.end);
      if (start >= end) continue;
      let text = decoder.decode(b.subarray(start, end));
      text = text.replace(/\r\n?$/, '').replace(/[\r\n]/g, '')
        .replace(/\x1f/g, '') // optional hyphen
        .replace(/\x01/g, '#'); // page-number field
      if (text) p.runs.push({ text, ...cr.props, font: fonts[cr.props.ftc] || null });
    }
    paragraphs.push(p);
  }
  return { paragraphs, hasOle: ident === 0xbe32 };
}

// Character and paragraph runs share the FKP page structure.
function readRuns(b, firstPage, endPage, fcMac, readProps) {
  const runs = [];
  let lastEnd = PAGE;
  for (let pn = firstPage; pn < endPage && (pn + 1) * PAGE <= b.length; pn++) {
    const base = pn * PAGE;
    const count = b[base + 127];
    for (let i = 0; i < count; i++) {
      const fod = base + 4 + i * 6;
      const fcLim = u32(b, fod);
      const bfprop = u16(b, fod + 4);
      const props = readProps(b, bfprop === 0xffff ? -1 : base + 4 + bfprop);
      const end = Math.min(fcLim, fcMac);
      if (end > lastEnd) runs.push({ start: lastEnd, end, props });
      lastEnd = Math.max(lastEnd, end);
      if (fcLim >= fcMac) return runs;
    }
  }
  // Tables that stop short of fcMac: the rest uses default properties.
  if (lastEnd < fcMac) runs.push({ start: lastEnd, end: fcMac, props: readProps(b, -1) });
  return runs;
}

// CHP struct (byte i sits at at+1+i, after the length byte): [1] bold |
// italic | ftc<<2, [2] half-points, [3] underline, [4] ftc high bits,
// [5] super/subscript position. Bytes past the length keep their defaults.
function readChp(b, at) {
  const p = { bold: false, italic: false, underline: false, ftc: 0, size: 12, pos: 0 };
  if (at < 0) return p;
  const n = b[at];
  const get = (i) => (i <= n ? b[at + i] : undefined);
  const f = get(2);
  if (f !== undefined) {
    p.bold = !!(f & 1);
    p.italic = !!(f & 2);
    p.ftc = f >> 2;
  }
  if (get(3) !== undefined) p.size = get(3) / 2 || 12;
  if (get(4) !== undefined) p.underline = !!(get(4) & 1);
  if (get(5) !== undefined) p.ftc |= (get(5) & 7) << 6;
  if (get(6) !== undefined) p.pos = (get(6) << 24) >> 24;
  return p;
}

// PAP struct (same offsets rule): [1] justification, [4] right, [6] left and
// [8] first-line indents (signed twips), [16] running-head code (bit 4 =
// picture paragraph, bits 1-2 = header/footer).
function readPap(b, at) {
  const p = { align: 'left', picture: false, header: false, right: 0, left: 0, first: 0 };
  if (at < 0) return p;
  const n = b[at];
  const jc = n >= 2 ? b[at + 2] : 0;
  p.align = ['left', 'center', 'right', 'justify'][jc & 3];
  const s16 = (i) => (i + 1 <= n ? (u16(b, at + i) << 16) >> 16 : 0);
  p.right = s16(5);
  p.left = s16(7);
  p.first = s16(9);
  const rhc = n >= 17 ? b[at + 17] : 0;
  p.picture = !!(rhc & 0x10);
  p.header = !p.picture && (rhc & 0x06) !== 0;
  return p;
}

function readFonts(b, pnFfntb, pnMac) {
  const names = [];
  if (!pnFfntb || pnFfntb >= pnMac) return names;
  let at = pnFfntb * PAGE;
  const count = u16(b, at);
  at += 2;
  while (names.length < count && at + 3 < b.length) {
    const cb = u16(b, at);
    if (cb === 0) break;
    if (cb === 0xffff) { // continued on the next page
      at = (Math.floor(at / PAGE) + 1) * PAGE;
      continue;
    }
    let end = at + 3;
    while (end < at + 2 + cb && b[end]) end++;
    names.push(new TextDecoder('windows-1252').decode(b.subarray(at + 3, end)));
    at += 2 + cb;
  }
  return names;
}

// ---------- rendering -------------------------------------------------------

const cssFont = (name) => name ? `'${name.replace(/'/g, '')}', serif` : '';

function paragraphNode(p) {
  if (p.picture) {
    if (p.url) return el('p', { style: `text-align:${p.align}` }, el('img', { src: p.url, alt: '', class: 'wri-img' }));
    return el('p', { class: 'wri-picture' }, '[picture]');
  }
  const pt = (twips) => (twips / 20).toFixed(1) + 'pt';
  const style = [`text-align:${p.align}`];
  if (p.left) style.push('margin-left:' + pt(p.left));
  if (p.right) style.push('margin-right:' + pt(p.right));
  if (p.first) style.push('text-indent:' + pt(p.first));
  const node = el('p', { style: style.join(';') });
  if (!p.runs.length) node.append(el('br'));
  for (const r of p.runs) {
    let span = el('span', { style: [r.font ? `font-family:${cssFont(r.font)}` : '', `font-size:${r.size}pt`].filter(Boolean).join(';') }, r.text);
    if (r.bold) span = el('b', {}, span);
    if (r.italic) span = el('i', {}, span);
    if (r.underline) span = el('u', {}, span);
    if (r.pos > 0) span = el('sup', {}, span);
    if (r.pos < 0) span = el('sub', {}, span);
    node.append(span);
  }
  return node;
}

export function toText(doc) {
  return doc.paragraphs.map((p) => (p.picture ? '[picture]' : p.runs.map((r) => r.text).join(''))).join('\r\n');
}

export async function open(file, ui) {
  const doc = parseWri(await bytes(file));
  // Pictures (bitmaps, metafiles, Paintbrush objects) come from libwps,
  // which reads them in the same order as the picture paragraphs.
  const pictures = doc.paragraphs.filter((p) => p.picture);
  if (pictures.length) {
    ui.progress('Loading pictures…');
    try {
      const { pictureUrls } = await import(`/js/engines/${'doc'}.js`);
      const urls = await pictureUrls(file);
      pictures.forEach((p, i) => { p.url = urls[i] || null; });
    } catch (err) {
      console.warn('pictures', err);
    }
  }
  const page = el('article', { class: 'doc-page' });
  const headers = doc.paragraphs.filter((p) => p.header);
  if (headers.length) page.append(el('div', { class: 'doc-header' }, headers.map(paragraphNode)));
  page.append(...doc.paragraphs.filter((p) => !p.header).map(paragraphNode));
  ui.output.append(page);
  ui.done();

  const html = () => '<!doctype html><html><head><meta charset="utf-8"><title>' +
    ui.baseName.replace(/[<&]/g, '') + '</title></head><body>' + page.innerHTML + '</body></html>';
  ui.action('Download as Word-compatible HTML', () => new Blob([html()], { type: 'text/html' }), ui.baseName + '.html', 'html');
  ui.action('Download as text', () => new Blob([toText(doc)], { type: 'text/plain;charset=utf-8' }), ui.baseName + '.txt', 'txt');
  ui.button('Print or save as PDF', () => printNode(page, ui.baseName));
}

// Print just the document, not the page around it.
function printNode(node, title) {
  const frame = el('iframe', { style: 'position:fixed;width:0;height:0;border:0' });
  document.body.append(frame);
  const d = frame.contentDocument;
  d.open();
  d.write('<!doctype html><html><head><meta charset="utf-8"><title></title></head><body></body></html>');
  d.close();
  d.title = title;
  d.body.append(d.importNode(node, true));
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1000);
}
