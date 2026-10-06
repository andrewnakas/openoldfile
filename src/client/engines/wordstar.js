// WordStar for CP/M and DOS (3.x to 7) documents.
//
// WordStar text is ASCII with the high bit used as a flag (the last letter
// of each word in 3.x, soft spaces and soft returns in all versions), plus
// one-byte print controls that toggle styles:
//   ^B 0x02 bold   ^S 0x13 underline   ^Y 0x19 italic   ^D 0x04 double strike
//   ^T 0x14 superscript   ^V 0x16 subscript   ^X 0x18 strikeout
//   0x0D 0x0A hard return (paragraph end)   0x8D 0x0A soft return (wrap)
//   0x1B c 0x1C  extended character c (WordStar 4+, code page 437)
//   0x1D ... 0x1D  WordStar 5+ embedded command (font changes etc.), skipped
// Lines starting with "." are dot commands (.pa page break, .he header...).
// WordStar 5+ files begin with a 128-byte header (0x1D 0x7D).

import { el, bytes } from '../ui-kit.js';

const CP437_HIGH = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const cp437 = (c) => (c < 0x80 ? String.fromCharCode(c) : CP437_HIGH[c - 0x80]);

const TOGGLES = { 0x02: 'b', 0x04: 'b', 0x13: 'u', 0x19: 'i', 0x14: 'sup', 0x16: 'sub', 0x18: 's' };

// Heuristic used by the sniffer: plenty of high-bit letters right before a
// space (3.x word ends) or soft returns, and almost no NUL bytes.
export function looksLikeWordStar(b) {
  const n = Math.min(b.length, 4096);
  if (n < 64) return false;
  let nul = 0, softEnds = 0, softCr = 0, toggles = 0, words = 0;
  for (let i = 0; i < n; i++) {
    const c = b[i];
    if (c === 0) nul++;
    if (c === 0x20) words++;
    if (c >= 0xe1 && c <= 0xfa && (b[i + 1] === 0x20 || b[i + 1] === 0x0d || b[i + 1] === 0x8d)) softEnds++;
    if (c === 0x8d && b[i + 1] === 0x0a) softCr++;
    if (c === 0x02 || c === 0x13 || c === 0x19) toggles++;
  }
  if (nul > n / 50) return false;
  return (words > 20 && softEnds / words > 0.15) || softCr > 3 || (b[0] === 0x1d && b[1] === 0x7d && (softCr + toggles) > 0);
}

export function parseWordStar(b) {
  let i = b[0] === 0x1d && b[1] === 0x7d ? 128 : 0;
  const paras = [];
  const headers = [];
  const style = { b: false, u: false, i: false, sup: false, sub: false, s: false };
  let runs = [];
  let text = '';
  let atLineStart = true;

  const flush = () => {
    if (!text) return;
    runs.push({ text, ...style });
    text = '';
  };
  const endPara = (pageBreak = false) => {
    flush();
    paras.push({ runs, pageBreak });
    runs = [];
  };

  while (i < b.length) {
    const c = b[i];
    if (c === 0x1a) break; // ^Z: end of file
    // Dot commands occupy a whole line.
    if (atLineStart && (c & 0x7f) === 0x2e) {
      let j = i;
      while (j < b.length && b[j] !== 0x0a) j++;
      const line = Array.from(b.subarray(i, j), (x) => String.fromCharCode(x & 0x7f)).join('').replace(/\r$/, '');
      const cmd = line.slice(1, 3).toLowerCase();
      if (cmd === 'pa') endPara(true);
      else if (/^(he|h[1-5]|fo|f[1-5])$/.test(cmd)) headers.push(line.slice(3).trim().replace(/#/g, '').trim());
      i = j + 1;
      continue;
    }
    atLineStart = false;
    if (c === 0x0d && b[i + 1] === 0x0a) { endPara(); i += 2; atLineStart = true; continue; }
    if (c === 0x8d) {
      // Soft return: the line wrapped here; join with a space.
      if (!/\s$/.test(text)) text += ' ';
      i += b[i + 1] === 0x0a ? 2 : 1;
      atLineStart = true;
      continue;
    }
    if (c === 0x0a) { i++; atLineStart = true; continue; }
    if (c === 0x0c) { endPara(true); i++; continue; }
    if (c === 0x1b && b[i + 2] === 0x1c) { text += cp437(b[i + 1]); i += 3; continue; }
    if (c === 0x1d) {
      const end = b.indexOf(0x1d, i + 1);
      i = end === -1 ? b.length : end + 1;
      continue;
    }
    if (TOGGLES[c]) { flush(); style[TOGGLES[c]] = !style[TOGGLES[c]]; i++; continue; }
    if (c === 0x09) { text += '\t'; i++; continue; }
    if (c === 0x0f) { text += ' '; i++; continue; }
    if (c < 0x20) { i++; continue; }
    text += String.fromCharCode(c & 0x7f);
    i++;
  }
  endPara();
  while (paras.length && !paras[paras.length - 1].runs.length) paras.pop();
  return { paragraphs: paras, headers };
}

export const toText = (doc) => doc.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\r\n');

function render(doc) {
  const page = el('article', { class: 'doc-page doc-mono' });
  if (doc.headers.length) page.append(el('div', { class: 'doc-header' }, doc.headers.join(' · ')));
  for (const p of doc.paragraphs) {
    const node = el('p');
    if (!p.runs.length) node.append(el('br'));
    for (const r of p.runs) {
      let n = document.createTextNode(r.text);
      for (const [k, tag] of [['b', 'b'], ['i', 'i'], ['u', 'u'], ['s', 's'], ['sup', 'sup'], ['sub', 'sub']]) {
        if (r[k]) n = el(tag, {}, n);
      }
      node.append(n);
    }
    page.append(node);
    if (p.pageBreak) page.append(el('hr', { class: 'page-break' }));
  }
  return page;
}

export async function open(file, ui) {
  const doc = parseWordStar(await bytes(file));
  const page = render(doc);
  ui.output.append(page);
  ui.done();
  const html = () => `<!doctype html><html><head><meta charset="utf-8"><title>${ui.baseName.replace(/[<&]/g, '')}</title><style>p{white-space:pre-wrap;font-family:"Courier New",monospace;margin:0}</style></head><body>${page.innerHTML}</body></html>`;
  ui.action('Download as Word-compatible HTML', () => new Blob([html()], { type: 'text/html' }), ui.baseName + '.html', 'html');
  ui.action('Download as text', () => new Blob([toText(doc)], { type: 'text/plain;charset=utf-8' }), ui.baseName + '.txt', 'txt');
}
