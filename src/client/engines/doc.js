// WordPerfect, ClarisWorks/AppleWorks, Works, MacWrite and the other formats
// libwpd/libwps/libmwaw read. Text documents arrive as HTML and are shown in
// a sandboxed frame; spreadsheets and databases as CSV tables; drawings as SVG.

import * as XLSX from 'xlsx';
import { fixMwawFontSizes } from '../mwaw-svg.js';
import { OpenError, el } from '../ui-kit.js';
import { renderPict } from './lib/pict.js';
import { emfToSvg, isEmf } from './lib/emf.js';
import { Renderer as WmfRenderer } from 'rtf.js/dist/WMFJS.bundle.js';

// docconv (libwpd, libwps, libmwaw...) by default; the dlp2 engine passes
// the worker for the drawing, StarOffice and e-book libraries instead.
const DOCCONV = '/js/workers/docconv-worker.js';
const workers = new Map();

function ask(msg, url = DOCCONV) {
  let worker = workers.get(url);
  if (!worker) workers.set(url, (worker = new Worker(url, { type: 'module' })));
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => (data.ok ? resolve(data) : reject(data));
    worker.onerror = () => { workers.delete(url); reject({ error: 'codec_load' }); };
    worker.postMessage(msg);
  });
}
export const convert = (file, password, url) => ask({ file, password }, url);

// ---------- embedded pictures --------------------------------------------------
// librevenge (patched, see native/patches) writes browser-native images as
// <img> and everything else as <span class="oof-object" data-mime data-src>.
// Replace those spans with something a browser can show.

const b64bytes = (dataUrl) => Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));
const canvasUrl = (canvas) => canvas.toDataURL('image/png');

// libmwaw writes patterns and small bitmaps as binary PPM ("P6") under an
// image/pict label.
function ppmToCanvas(b) {
  const head = new TextDecoder('latin1').decode(b.subarray(0, 64));
  const m = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(head);
  if (!m) return null;
  const w = +m[1], h = +m[2];
  const start = m[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const img = c.getContext('2d').createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = b[start + i * 3]; img.data[i * 4 + 1] = b[start + i * 3 + 1]; img.data[i * 4 + 2] = b[start + i * 3 + 2]; img.data[i * 4 + 3] = 255;
  }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

function pictureFor(mime, dataUrl) {
  const b = b64bytes(dataUrl);
  if (/pict/.test(mime)) {
    if (b[0] === 0x50 && b[1] === 0x36) return ppmToCanvas(b) && canvasUrl(ppmToCanvas(b));
    return canvasUrl(renderPict(b));
  }
  if (/emf/.test(mime) || isEmf(b)) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(emfToSvg(b));
  }
  if (/wmf|x-wmf|windows-metafile/.test(mime)) {
    const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    const svg = new WmfRenderer(buf).render({ width: '100%', height: '100%', xExt: 1000, yExt: 1000, mapMode: 8 });
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.querySelectorAll('svg').forEach((s) => s.setAttribute('overflow', 'visible'));
    svg.querySelectorAll('polyline:not([fill]), line:not([fill])').forEach((e) => e.setAttribute('fill', 'none'));
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  }
  return null;
}

// SVG produced by librevenge can embed PPM patterns; swap them for PNG.
function fixSvgImages(svg) {
  return svg.replace(/data:image\/pict;base64,([A-Za-z0-9+/=]+)/g, (m, b64) => {
    const c = ppmToCanvas(b64bytes('x,' + b64));
    return c ? canvasUrl(c) : m;
  });
}

async function resolvePictures(doc) {
  for (const span of doc.querySelectorAll('span.oof-object')) {
    const mime = span.getAttribute('data-mime') || '';
    const src = span.getAttribute('data-src') || '';
    let url = null;
    try {
      if (mime === 'image/mwaw-odg') {
        const r = await ask({ graphic: b64bytes(src) });
        if (r.svg) url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fixSvgImages(fixMwawFontSizes(r.svg)));
      } else {
        url = pictureFor(mime, src);
      }
    } catch (err) {
      console.warn('picture', mime, err);
    }
    if (url) {
      const img = doc.createElement('img');
      img.className = 'oof-picture';
      img.alt = '';
      img.setAttribute('style', (span.getAttribute('style') || '') + 'max-width:100%');
      img.src = url;
      span.replaceWith(img);
    } else {
      span.textContent = '[picture]';
      span.className = 'oof-missing';
      span.removeAttribute('data-src');
    }
  }
}

const MESSAGES = {
  unsupported: 'This file is not a format the document reader recognises. If you know which program made it, tell us via the contact page.',
  parse: 'The file was recognised but could not be read completely. It may be damaged or truncated.',
  crash: 'The document reader hit a problem with this file. It may be damaged, or a variant it does not handle yet.',
  codec_load: null
};

export async function open(file, ui, url = DOCCONV) {
  ui.progress('Loading the document reader (one-time download)…');
  let r;
  try {
    r = await convert(file, undefined, url);
  } catch (e) {
    if (e.error === 'password') {
      const pw = await askPassword(ui.output);
      ui.progress('Opening with password…');
      try { r = await convert(file, pw, url); } catch (e2) { throw toError(e2); }
    } else {
      if (e.error === 'unsupported' && await isModernOffice(file)) throw new OpenError('wrong_type', MODERN_OFFICE);
      throw toError(e);
    }
  }
  if (r.kind === 'html') return showHtml(r.body, ui);
  if (r.kind === 'svg') r.body = fixSvgImages(r.lib === 'libmspub' ? r.body : fixMwawFontSizes(r.body));
  if (r.kind === 'csv') return showSheets(r.body.split('\f'), ui);
  return showSvg(r.body.split('\f'), ui);
}

// PowerPoint 97 and later write OLE files that the old PowerPoint page
// cannot read, but that every current presentation program opens.
const MODERN_OFFICE = 'This is a PowerPoint 97 or later presentation, not an old one. Current PowerPoint, Google Slides, Keynote and LibreOffice Impress all open it directly.';
async function isModernOffice(file) {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && /\.(ppt|pps|pot)$/i.test(file.name);
}

function toError(e) {
  if (e.error === 'password') return new OpenError('password', 'That password did not work.');
  if (e.error === 'codec_load') return new OpenError('codec_load', 'The document reader failed to download. Reload the page and try again.');
  return new OpenError(e.error === 'unsupported' ? 'wrong_type' : 'decode', MESSAGES[e.error] || MESSAGES.crash);
}

async function showHtml(html, ui) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script').forEach((n) => n.remove());
  ui.progress('Drawing pictures…');
  await resolvePictures(doc);
  const text = doc.body.innerText || doc.body.textContent || '';
  if (!text.trim()) ui.output.append(el('p', { class: 'note' }, 'The document opened but contains no text.'));
  // Paper look inside the frame, whatever styles the document brings.
  doc.head.insertAdjacentHTML('afterbegin', '<meta charset="utf-8"><style>.oof-missing{color:#888;font:italic 10pt sans-serif}html{background:#fff}body{max-width:7.5in;margin:24px auto;padding:0 16px;font-family:"Times New Roman",serif;color:#111;overflow-wrap:break-word}table{border-collapse:collapse}td{vertical-align:top}</style>');
  const source = '<!doctype html>' + doc.documentElement.outerHTML;
  const frame = el('iframe', { class: 'doc-frame', sandbox: 'allow-same-origin allow-modals', title: 'Document' });
  frame.srcdoc = source;
  frame.addEventListener('load', () => {
    // Grow to the content so the page scrolls, not the frame.
    const h = frame.contentDocument?.documentElement.scrollHeight;
    if (h) frame.style.height = Math.min(h + 24, 20000) + 'px';
  });
  ui.output.append(frame);
  ui.done();

  ui.action('Download as Word-compatible HTML', () => new Blob([source], { type: 'text/html' }), ui.baseName + '.html', 'html');
  ui.action('Download as text', () => new Blob([text], { type: 'text/plain;charset=utf-8' }), ui.baseName + '.txt', 'txt');
  ui.button('Print or save as PDF', () => frame.contentWindow.print());
}

function showSheets(csvs, ui) {
  const wb = XLSX.utils.book_new();
  csvs.forEach((csv, i) => {
    const ws = XLSX.read(csv, { type: 'string', raw: true }).Sheets.Sheet1;
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet' + (i + 1));
  });
  const wrap = el('div', { class: 'table-wrap' });
  wrap.innerHTML = XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[0]], { header: '', footer: '' });
  wrap.querySelector('table')?.classList.add('sheet');
  ui.output.append(wrap);
  ui.done();
  ui.action('Download .xlsx', () => new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]), ui.baseName + '.xlsx', 'xlsx');
  ui.action('Download .csv', () => new Blob(['﻿' + csvs[0]], { type: 'text/csv' }), ui.baseName + '.csv', 'csv');
}

function showSvg(pages, ui) {
  const urls = pages.map((svg) => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
  // Print every page, one per sheet, from a frame holding just the pages.
  ui.button('Print or save as PDF', () => {
    const frame = el('iframe', { style: 'position:fixed;width:0;height:0;border:0' });
    document.body.append(frame);
    const d = frame.contentDocument;
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:0}img{display:block;width:100%;page-break-after:always}</style></head><body></body></html>');
    d.close();
    urls.forEach((src) => d.body.append(Object.assign(d.createElement('img'), { src })));
    setTimeout(() => { frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000); }, 300);
  });
  ui.output.append(el('div', { class: 'xps-pages' }, urls.map((src, i) => el('div', { class: 'xps-page' }, el('img', { src, alt: `Page ${i + 1}` })))));
  ui.done();
  ui.action('Download PNG' + (pages.length > 1 ? ' (page 1)' : ''), () => svgToPng(urls[0]), ui.baseName + '.png', 'png');
  ui.action('Download SVG' + (pages.length > 1 ? ' (page 1)' : ''), () => new Blob([pages[0]], { type: 'image/svg+xml' }), ui.baseName + '.svg', 'svg');
}

// Rasterise a page at twice its size (MacPaint art and drawings people want
// as an ordinary picture), on white like the paper it was drawn for.
async function svgToPng(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = Math.min(2, 8000 / Math.max(img.naturalWidth, img.naturalHeight, 1));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale) || 1;
  c.height = Math.round(img.naturalHeight * scale) || 1;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

function askPassword(container) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'password', autocomplete: 'off', 'aria-label': 'Document password' });
    const form = el('form', { class: 'password-form', onsubmit: (e) => { e.preventDefault(); form.remove(); resolve(input.value); } },
      el('label', {}, 'This document is password-protected. Password: ', input), ' ', el('button', { class: 'btn', type: 'submit' }, 'Open'));
    container.append(form);
    input.focus();
  });
}

// The pictures of a document, in order, as displayable URLs (null where a
// picture could not be drawn). Used by the Write reader, whose own decoder
// handles the text and leaves the pictures to libwps.
export async function pictureUrls(file) {
  const r = await convert(file);
  if (r.kind !== 'html') return [];
  const doc = new DOMParser().parseFromString(r.body, 'text/html');
  await resolvePictures(doc);
  return [...doc.querySelectorAll('img.oof-picture, .oof-missing')].map((n) => (n.tagName === 'IMG' ? n.getAttribute('src') : null));
}
