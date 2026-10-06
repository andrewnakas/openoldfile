// WinHelp (.hlp). helpdeco (in a worker) decompiles the file back to the RTF
// and project file it was compiled from; this module turns that RTF into
// browsable topics.
//
// The RTF parsing lives in lib/winhelp-rtf.js.

import { OpenError, el, bytes } from '../ui-kit.js';
import { parseHelpRtf, escapeHtml } from './lib/winhelp-rtf.js';
import { Renderer as WmfRenderer } from 'rtf.js/dist/WMFJS.bundle.js';

// ---------- viewer ---------------------------------------------------------------------

function wmfUrl(buf) {
  try {
    const svg = new WmfRenderer(buf).render({ width: '100%', height: '100%', xExt: 1000, yExt: 1000, mapMode: 8 });
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.querySelectorAll('svg').forEach((s) => s.setAttribute('overflow', 'visible'));
    svg.querySelectorAll('polyline:not([fill]), line:not([fill])').forEach((e) => e.setAttribute('fill', 'none'));
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  } catch {
    return null;
  }
}

function call(file) {
  const worker = new Worker('/js/workers/helpdeco-worker.js', { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => { worker.terminate(); data.ok ? resolve(data) : reject(data); };
    worker.onerror = () => { worker.terminate(); reject({ error: 'codec_load' }); };
    worker.postMessage({ file });
  });
}

export async function open(file, ui) {
  const head = await bytes(file.slice(0, 4));
  if (!(head[0] === 0x3f && head[1] === 0x5f && head[2] === 3 && head[3] === 0)) {
    throw new OpenError('wrong_type', 'This is not a WinHelp file. If it is a newer .chm help file, open it on the CHM page.');
  }
  ui.progress('Decompiling the help file…');
  let r;
  try {
    r = await call(file);
  } catch (e) {
    if (e.error === 'codec_load') throw new OpenError('codec_load', 'The help file reader failed to load. Reload the page and try again.');
    console.warn(e.log);
    throw new OpenError('decode', 'This help file could not be decompiled. It may be damaged or compressed in a way the reader does not handle.');
  }
  const topics = parseHelpRtf(r.rtf);
  if (!topics.length) throw new OpenError('decode', 'The help file opened but contains no readable topics.');

  // Pictures by the name the RTF uses: bitmaps as they are, metafiles drawn
  // to SVG (splitmrb output carries its real type in name#type).
  const images = new Map();
  for (const [name, buf] of Object.entries(r.images)) {
    if (name.endsWith('#type')) continue;
    const type = r.images[name + '#type'] || name.split('.').pop();
    let url = null;
    if (type === 'wmf') url = wmfUrl(buf);
    else if (/^(bmp|png|jpg|gif)$/.test(type)) url = URL.createObjectURL(new Blob([buf], { type: type === 'jpg' ? 'image/jpeg' : 'image/' + type }));
    if (url) images.set(name, url);
  }
  const byId = new Map();
  topics.forEach((t, i) => t.ids.forEach((id) => byId.set(id, i)));
  const titleOf = (t, i) => t.title || `Topic ${i + 1}`;
  const hpjTitle = /^\s*TITLE\s*=\s*(.+)$/im.exec(r.hpj)?.[1]?.trim();

  const pane = el('article', { class: 'hlp-topic doc-page' });
  const list = el('ul');
  const search = el('input', { type: 'search', placeholder: 'Search topics', 'aria-label': 'Search topics', class: 'hlp-search' });
  const items = topics.map((t, i) => {
    const a = el('a', { href: '#', onclick: (e) => { e.preventDefault(); show(i); } }, titleOf(t, i));
    const li = el('li', {}, a);
    li.dataset.text = (titleOf(t, i) + ' ' + t.keywords.join(' ')).toLowerCase();
    return li;
  });
  list.append(...items);
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    items.forEach((li) => { li.hidden = q && !li.dataset.text.includes(q); });
  });

  function show(i) {
    const t = topics[i];
    // Pictures: \{bmc name.bmp\} became literal "{bmc name.bmp}" text.
    const body = t.body.replace(/\{bm[clr]t? ([^}]+)\}/gi, (m, name) => {
      const url = images.get(name.trim().toLowerCase());
      return url ? `<img src="${url}" alt="">` : '';
    });
    // Most topics repeat their title as the first line; add a heading only
    // when they don't.
    const firstLine = /^<p[^>]*>(.*?)<\/p>/.exec(body)?.[1].replace(/<[^>]+>/g, '').trim();
    const heading = t.title && firstLine !== t.title.trim() ? `<h2>${escapeHtml(t.title)}</h2>` : '';
    pane.innerHTML = heading + body;
    items.forEach((li, j) => li.classList.toggle('current', j === i));
    pane.scrollTop = 0;
  }
  pane.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-topic]');
    if (!a) return;
    e.preventDefault();
    const i = byId.get(a.dataset.topic);
    if (i != null) show(i);
  });

  if (hpjTitle) ui.output.append(el('h2', { class: 'chm-title' }, hpjTitle));
  ui.output.append(el('p', { class: 'summary' }, `${topics.length} topics`),
    el('div', { class: 'chm' }, el('nav', { class: 'chm-toc', 'aria-label': 'Topics' }, search, list), pane));
  show(0);
  ui.done();

  ui.action('Download as one HTML file', () => {
    const doc = topics.map((t, i) => `<section id="t${i}"><h2>${escapeHtml(titleOf(t, i))}</h2>${t.body}</section>`).join('\n<hr>\n');
    return new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(hpjTitle || ui.baseName)}</title></head><body>${doc}</body></html>`], { type: 'text/html' });
  }, ui.baseName + '.html', 'html');
  ui.action('Download the decompiled RTF', () => new Blob([r.rtf], { type: 'application/rtf' }), ui.baseName + '.rtf', 'rtf');
}
