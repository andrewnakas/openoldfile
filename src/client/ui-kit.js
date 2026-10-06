// Small helpers shared by the engines.

export class OpenError extends Error {
  // type: wrong_type | decode | unsupported_api | memory | codec_load
  constructor(type, message) {
    super(message || type);
    this.name = 'OpenError';
    this.type = type;
  }
}

// Engines are separate bundles with their own copy of OpenError, so
// instanceof fails across them; check the name instead.
export const isOpenError = (err) => !!err && err.name === 'OpenError' && typeof err.type === 'string';

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.flat().filter((c) => c != null));
  return node;
}

export function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export const bytes = async (file) => new Uint8Array(await file.arrayBuffer());

// gunzip with the browser's own decompressor (.emz, .wmz, .taz members).
export async function gunzip(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export const isGzip = (b) => b[0] === 0x1f && b[1] === 0x8b;

// Tabs for multi-part results (sheets in a workbook, pages in a document).
export function tabs(names, onSelect) {
  const bar = el('div', { class: 'tabs', role: 'tablist' });
  const buttons = names.map((name, i) =>
    el('button', {
      type: 'button',
      role: 'tab',
      class: 'tab',
      'aria-selected': i === 0 ? 'true' : 'false',
      onclick: () => {
        buttons.forEach((b, j) => b.setAttribute('aria-selected', j === i ? 'true' : 'false'));
        onSelect(i);
      }
    }, name));
  bar.append(...buttons);
  return bar;
}

// Hand the File to the right page so the visitor doesn't have to pick it
// again. Files can't ride in history state or sessionStorage; the Cache API
// survives the navigation and stays on this device.
export async function routeTo(slug, file) {
  try {
    const cache = await caches.open('handoff');
    await cache.put('/__handoff', new Response(file, { headers: { 'x-name': encodeURIComponent(file.name) } }));
    location.href = `/open/${slug}/#handoff`;
  } catch {
    // Private windows can refuse the Cache API: ask for the file again there.
    location.href = `/open/${slug}/`;
  }
}

export async function takeHandoff(handle) {
  if (location.hash !== '#handoff') return;
  history.replaceState(null, '', location.pathname);
  try {
    const cache = await caches.open('handoff');
    const res = await cache.match('/__handoff');
    if (!res) return;
    await cache.delete('/__handoff');
    const name = decodeURIComponent(res.headers.get('x-name') || 'file');
    const blob = await res.blob();
    handle(new File([blob], name));
  } catch {
    /* fall back to asking for the file */
  }
}
