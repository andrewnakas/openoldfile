// Microsoft Compiled HTML Help (.chm). 7-Zip unpacks the bundle; this module
// builds the table of contents from the .hhc sitemap and shows pages in a
// sandboxed frame with scripts disabled. Internal links, images and
// stylesheets are rewritten to blob: URLs of the unpacked files.

import { zipSync } from 'fflate';
import { OpenError, el } from '../ui-kit.js';
import { extract } from './lib/extract.js';

const MIME = {
  htm: 'text/html', html: 'text/html', css: 'text/css', gif: 'image/gif', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon', webp: 'image/webp'
};
const extOf = (p) => (/\.([a-z0-9]+)$/i.exec(p) || [, ''])[1].toLowerCase();
const norm = (p) => decodeURIComponent(p.replace(/\\/g, '/').replace(/^\/+/, '')).toLowerCase();

export async function open(file, ui) {
  ui.progress('Unpacking ' + file.name + '…');
  const entries = await extract(file);
  const files = new Map(entries.map((e) => [norm(e.path), e]));
  const sys = readSystem(files.get('#system')?.data);
  const pages = entries.filter((e) => /\.html?$/i.test(e.path)).map((e) => norm(e.path));
  if (!pages.length) throw new OpenError('decode', 'This help file contains no pages.');

  const hhcPath = sys.contents ? norm(sys.contents) : [...files.keys()].find((p) => p.endsWith('.hhc'));
  const toc = hhcPath && files.has(hhcPath) ? parseSitemap(decode(files.get(hhcPath).data), hhcPath) : [];
  const start = [sys.defaultTopic && norm(sys.defaultTopic), toc.find((t) => t.local)?.local, 'index.htm', 'index.html', 'default.htm', pages[0]]
    .filter(Boolean).map((p) => p.split('#')[0]).find((p) => files.has(p));

  const viewer = new Viewer(files);
  const tocNode = el('nav', { class: 'chm-toc', 'aria-label': 'Contents' });
  if (toc.length) tocNode.append(renderToc(toc, (p, h) => viewer.show(p, h)));
  else tocNode.append(renderToc(pages.sort().map((p) => ({ name: p, local: p, children: [] })), (p, h) => viewer.show(p, h)));

  if (sys.title) ui.output.append(el('h2', { class: 'chm-title' }, sys.title));
  ui.output.append(el('div', { class: 'chm' }, tocNode, viewer.frame));
  await viewer.show(start);
  ui.done();

  ui.button('Print this page', () => viewer.frame.contentWindow.print());
  ui.action('Download all pages (.zip)', () => {
    const tree = {};
    for (const e of entries) if (!/^[#$]/.test(e.path.split('/').pop())) tree[e.path] = [e.data, { level: 6 }];
    return new Blob([zipSync(tree)], { type: 'application/zip' });
  }, ui.baseName + '.zip', 'zip');
}

class Viewer {
  constructor(files) {
    this.files = files;
    this.urls = new Map();
    // No allow-scripts: help files may carry script, and none of it runs.
    // allow-same-origin lets this page reach in to wire up links;
    // allow-modals lets the print button work.
    this.frame = el('iframe', { class: 'chm-frame', sandbox: 'allow-same-origin allow-modals', title: 'Help page' });
  }

  resolve(base, ref) {
    if (!ref || /^(https?:|mailto:|javascript:|data:|#)/i.test(ref)) return null;
    // ms-its:other.chm::/page.htm and mk:@MSITStore:...::/page.htm
    const its = /::(\/.*)$/.exec(ref);
    if (its) ref = its[1];
    const [path, hash] = ref.split('#');
    const url = new URL(path, 'https://chm.invalid/' + base);
    return { path: norm(url.pathname), hash: hash || '' };
  }

  blobUrl(path) {
    if (this.urls.has(path)) return this.urls.get(path);
    const entry = this.files.get(path);
    if (!entry) return null;
    let data = entry.data;
    if (extOf(path) === 'css') data = this.rewriteCss(decode(data), path);
    const url = URL.createObjectURL(new Blob([data], { type: MIME[extOf(path)] || 'application/octet-stream' }));
    this.urls.set(path, url);
    return url;
  }

  rewriteCss(css, base) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, ref) => {
      const r = this.resolve(base, ref);
      const u = r && this.blobUrl(r.path);
      return u ? `url("${u}")` : m;
    });
  }

  async show(path, hash = '') {
    const entry = this.files.get(path);
    if (!entry) return;
    const doc = new DOMParser().parseFromString(decode(entry.data), 'text/html');
    doc.querySelectorAll('script, object, embed, applet, iframe[src^="javascript"]').forEach((n) => n.remove());
    for (const node of doc.querySelectorAll('[src], [href], [background]')) {
      for (const attr of ['src', 'href', 'background']) {
        const ref = node.getAttribute(attr);
        if (ref == null) continue;
        const r = this.resolve(path, ref);
        if (!r) continue;
        if (node.tagName === 'A' && /\.html?$/.test(r.path)) {
          node.setAttribute('data-chm', r.path + (r.hash ? '#' + r.hash : ''));
          node.setAttribute('href', '#');
        } else {
          const u = this.blobUrl(r.path);
          if (u) node.setAttribute(attr, u);
        }
      }
    }
    doc.querySelectorAll('style').forEach((s) => { s.textContent = this.rewriteCss(s.textContent, path); });
    await new Promise((resolve) => {
      this.frame.onload = resolve;
      this.frame.srcdoc = '<!doctype html>' + doc.documentElement.outerHTML;
    });
    const fdoc = this.frame.contentDocument;
    fdoc.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[data-chm]');
      if (!a) return;
      e.preventDefault();
      const [p, h] = a.getAttribute('data-chm').split('#');
      this.show(p, h);
    });
    if (hash) fdoc.getElementById(hash)?.scrollIntoView() || fdoc.getElementsByName(hash)[0]?.scrollIntoView();
  }
}

// Pages declare their charset in a meta tag when they declare one at all;
// old help files are otherwise Windows-1252.
function decode(bytes) {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  const m = /charset\s*=\s*["']?([\w-]+)/i.exec(head);
  try {
    return new TextDecoder(m ? m[1] : 'windows-1252').decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

// #SYSTEM: dword version, then records of (word code, word length, data).
// 0 = contents file, 2 = default topic, 3 = title.
export function readSystem(data) {
  const out = {};
  if (!data || data.length < 4) return out;
  const str = (a, b) => new TextDecoder('windows-1252').decode(data.subarray(a, b)).replace(/\0.*$/s, '');
  let at = 4;
  while (at + 4 <= data.length) {
    const code = data[at] | (data[at + 1] << 8);
    const len = data[at + 2] | (data[at + 3] << 8);
    const body = at + 4;
    if (code === 0) out.contents = str(body, body + len);
    else if (code === 2) out.defaultTopic = str(body, body + len);
    else if (code === 3) out.title = str(body, body + len);
    at = body + len;
  }
  return out;
}

// The .hhc sitemap: nested <UL> of <LI><OBJECT type="text/sitemap"> with
// <param name="Name"> and <param name="Local">.
// Local paths are relative to the .hhc file's own folder.
export function parseSitemap(html, base = '') {
  const resolveLocal = (local) => {
    const [path, hash] = local.replace(/^.*::/, '').split('#');
    const url = new URL(path, 'https://chm.invalid/' + base);
    return norm(url.pathname) + (hash ? '#' + hash : '');
  };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (ul) => [...ul.children].filter((n) => n.tagName === 'LI').map((li) => {
    const obj = li.querySelector(':scope > object');
    const param = (name) => obj?.querySelector(`param[name="${name}" i]`)?.getAttribute('value') || '';
    const sub = li.querySelector(':scope > ul') || (li.nextElementSibling?.tagName === 'UL' ? li.nextElementSibling : null);
    const local = param('Local');
    return { name: param('Name') || local, local: local ? resolveLocal(local) : '', children: sub ? walk(sub) : [] };
  });
  // Old compilers emit <UL> siblings after <LI> instead of nesting them.
  const top = doc.body.querySelector('ul');
  return top ? walk(top) : [];
}

function renderToc(items, onPick) {
  const ul = el('ul');
  for (const item of items) {
    const li = el('li');
    if (item.local) li.append(el('a', { href: '#', onclick: (e) => { e.preventDefault(); const [p, h] = item.local.split('#'); onPick(p, h); } }, item.name));
    else li.append(el('span', {}, item.name));
    if (item.children.length) li.append(renderToc(item.children, onPick));
    ul.append(li);
  }
  return ul;
}
