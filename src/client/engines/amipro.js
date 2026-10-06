// Lotus Ami Pro (.sam) documents, version 4 (Ami Pro 3.x).
//
// A .sam file is text: header sections ([ver], [charset], repeated [tag]
// style records, page layout...) then [edoc], the document stream, closed by
// a line holding only ">". In the stream a blank line ends a paragraph and
// other line breaks are only storage. "@Style@" at a paragraph start names
// its style; inline commands are <+!> <-!> style toggles, <+B> alignment,
// <:f...> font changes, <:p> page break, and <:N/<:F/<:H/<:h containers
// (annotation, footnote, header, footer) that hold their own streams.
// Grammar from the interoperability spec in gadicc/amipro-sam (MIT).

import { el, bytes } from '../ui-kit.js';

const TOGGLES = { '!': 'b', '"': 'i', '#': 'u', ')': 'u', '$': 'u', '&': 'sup', "'": 'sub', '%': 's' };
const ALIGN = { '@': 'left', A: 'right', B: 'center', C: 'justify' };

export function isAmiPro(b) {
  const head = new TextDecoder('latin1').decode(b.subarray(0, 64)).replace(/^﻿/, '');
  return /^\s*\[ver\]\s*[\r\n]+\s*[34]\s*[\r\n]/.test(head);
}

function decode(b) {
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return new TextDecoder('utf-8').decode(b.subarray(3));
  return new TextDecoder('windows-1252').decode(b);
}

// [tag] records: style name, then indented [fnt] (family, size twips, colour,
// flags) and [algn] (flags: 1 left, 2 right, 4 centre, 8 justify).
function parseStyles(lines) {
  const styles = {};
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '[tag]') continue;
    const name = (lines[i + 1] || '').trim();
    const st = { family: '', size: 0, align: 'left' };
    for (let j = i + 2; j < lines.length && !/^\[/.test(lines[j]); j++) {
      const t = lines[j].trim();
      if (t === '[fnt]') {
        st.family = (lines[j + 1] || '').trim();
        st.size = parseInt(lines[j + 2], 10) / 20 || 0;
        const color = parseInt(lines[j + 3], 10) || 0;
        st.color = color ? '#' + [color & 0xff, (color >> 8) & 0xff, (color >> 16) & 0xff].map((c) => c.toString(16).padStart(2, '0')).join('') : '';
      } else if (t === '[algn]') {
        const f = parseInt(lines[j + 1], 10) || 0;
        st.align = f & 8 ? 'justify' : f & 4 ? 'center' : f & 2 ? 'right' : 'left';
      }
    }
    styles[name.toLowerCase()] = st;
  }
  return styles;
}

// Escapes: << <;> <[> </R> </x> <\x> and @@.
function unescapeChunk(s) {
  return s.replace(/@@/g, '@');
}

export function parseAmiPro(b) {
  const text = decode(b);
  const lines = text.split(/\r\n|\n|\r/);
  const start = lines.findIndex((l) => l.trim() === '[edoc]');
  if (start < 0) throw new Error('no [edoc]');
  const styles = parseStyles(lines.slice(0, start));

  const doc = { paragraphs: [], headers: [], footnotes: [] };
  let target = doc.paragraphs;
  const containers = [];
  let para = null;
  const fmt = { b: false, i: false, u: false, sup: false, sub: false, s: false, size: 0, family: '', color: '' };

  const newPara = () => {
    para = { style: '', align: '', runs: [], pageBreak: false };
  };
  const endPara = () => {
    if (para && (para.runs.length || para.pageBreak)) target.push(para);
    para = null;
  };
  const addText = (t) => {
    if (!t) return;
    if (!para) newPara();
    const last = para.runs[para.runs.length - 1];
    const same = last && ['b', 'i', 'u', 'sup', 'sub', 's', 'size', 'family', 'color'].every((k) => last[k] === fmt[k]);
    if (same) last.text += t;
    else para.runs.push({ text: t, ...fmt });
  };

  for (let li = start + 1; li < lines.length; li++) {
    const line = lines[li];
    if (/^\s*>\s*$/.test(line)) {
      // Close the innermost container, or the document stream.
      endPara();
      if (containers.length) {
        target = containers.pop();
        continue;
      }
      break;
    }
    if (!line.trim()) { endPara(); continue; }

    let s = line;
    // Paragraph style at the start of a paragraph.
    if (!para) {
      newPara();
      const m = /^@([^@]+)@/.exec(s);
      if (m) {
        para.style = m[1];
        s = s.slice(m[0].length);
      }
    }
    let i = 0;
    let chunk = '';
    while (i < s.length) {
      const c = s[i];
      if (c !== '<') { chunk += c; i++; continue; }
      if (s[i + 1] === '<') { chunk += '<'; i += 2; continue; }
      // Containers (annotation, footnote, header, footer): the opener's line
      // carries metadata; the container's own stream follows on the next
      // lines and ends at its standalone '>'.
      if (/^<:[NFHh]/.test(s.slice(i, i + 3))) {
        addText(unescapeChunk(chunk));
        chunk = '';
        endPara();
        containers.push(target);
        const kind = s[i + 2];
        target = kind === 'F' ? doc.footnotes : kind === 'N' ? [] : doc.headers;
        i = s.length;
        continue;
      }
      // An inline command or escape: up to the matching '>'.
      const end = s.indexOf('>', i + 1);
      if (end < 0) { chunk += s.slice(i); break; }
      const cmd = s.slice(i + 1, end);
      i = end + 1;
      if (cmd === ';') { chunk += '>'; continue; }
      if (cmd === '[') { chunk += '['; continue; }
      if (cmd === '/R') { chunk += '’'; continue; }
      if (/^\/.$/.test(cmd)) { chunk += new TextDecoder('windows-1252').decode(Uint8Array.of(cmd.charCodeAt(1) + 0x40)); continue; }
      if (/^\\.$/.test(cmd)) { chunk += new TextDecoder('windows-1252').decode(Uint8Array.of(cmd.charCodeAt(1) | 0x80)); continue; }
      addText(unescapeChunk(chunk));
      chunk = '';
      if (/^[+-].$/.test(cmd)) {
        const key = TOGGLES[cmd[1]];
        if (key) fmt[key] = cmd[0] === '+';
        else if (cmd[0] === '+' && ALIGN[cmd[1]]) para.align = ALIGN[cmd[1]];
        continue;
      }
      if (cmd === ':' || cmd === ':f') { Object.assign(fmt, { size: 0, family: '', color: '' }); continue; }
      if (cmd.startsWith(':f')) {
        const parts = cmd.slice(2).split(',');
        const size = parseInt(parts[0], 10);
        if (size > 0) fmt.size = size / 20;
        if (parts[1]) fmt.family = parts[1].replace(/^\d+/, '').trim();
        if (parts.length >= 5) fmt.color = '#' + parts.slice(2, 5).map((v) => Math.max(0, Math.min(255, parseInt(v, 10) || 0)).toString(16).padStart(2, '0')).join('');
        continue;
      }
      if (cmd === ':p') { para.pageBreak = true; continue; }
      // Anything else (dynamic fields, frames, geometry) is not shown.
    }
    addText(unescapeChunk(chunk));
  }
  endPara();
  doc.styles = styles;
  return doc;
}

export const toText = (doc) => doc.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\r\n\r\n');

function render(doc) {
  const page = el('article', { class: 'doc-page' });
  const paraNode = (p) => {
    const st = doc.styles[(p.style || 'body text').toLowerCase()] || {};
    const css = [`text-align:${p.align || st.align || 'left'}`];
    if (st.family) css.push(`font-family:'${st.family.replace(/PS$/, '').replace(/'/g, '')}', serif`);
    if (st.size) css.push(`font-size:${st.size}pt`);
    if (st.color && st.color !== '#000000') css.push(`color:${st.color}`);
    const heading = /title|heading|head/i.test(p.style || '');
    const node = el('p', { style: css.join(';') + (heading ? ';font-weight:bold' : '') });
    for (const r of p.runs) {
      const span = el('span', { style: [r.size ? `font-size:${r.size}pt` : '', r.family ? `font-family:'${r.family.replace(/'/g, '')}'` : '', r.color ? `color:${r.color}` : ''].filter(Boolean).join(';') || null }, r.text);
      let n = span;
      for (const [k, tag] of [['b', 'b'], ['i', 'i'], ['u', 'u'], ['s', 's'], ['sup', 'sup'], ['sub', 'sub']]) if (r[k]) n = el(tag, {}, n);
      node.append(n);
    }
    return node;
  };
  if (doc.headers.length) page.append(el('div', { class: 'doc-header' }, doc.headers.map(paraNode)));
  for (const p of doc.paragraphs) {
    page.append(paraNode(p));
    if (p.pageBreak) page.append(el('hr', { class: 'page-break' }));
  }
  if (doc.footnotes.length) page.append(el('hr'), el('div', { class: 'doc-footnotes' }, doc.footnotes.map(paraNode)));
  return page;
}

export async function open(file, ui) {
  const doc = parseAmiPro(await bytes(file));
  const page = render(doc);
  if (!doc.paragraphs.length) ui.output.append(el('p', { class: 'note' }, 'The document opened but contains no text.'));
  ui.output.append(page);
  ui.done();
  const html = () => `<!doctype html><html><head><meta charset="utf-8"><title>${ui.baseName.replace(/[<&]/g, '')}</title></head><body>${page.innerHTML}</body></html>`;
  ui.action('Download as Word-compatible HTML', () => new Blob([html()], { type: 'text/html' }), ui.baseName + '.html', 'html');
  ui.action('Download as text', () => new Blob([toText(doc)], { type: 'text/plain;charset=utf-8' }), ui.baseName + '.txt', 'txt');
}
