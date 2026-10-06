// The Document Liberation Project libraries (libwpd, libwps, libmwaw via
// native/docconv.cpp) in a worker.
//
// In:  { file: File, password?: string } | { graphic: Uint8Array } (libmwaw drawing -> SVG)
// Out: { ok: true, kind: 'html'|'csv'|'svg', lib, format, body } | { ok: false, error }

import Module from '../vendor/docconv.mjs';

let ready = null;

self.onmessage = async ({ data }) => {
  try {
    ready ??= Module({ locateFile: () => '/vendor/docconv/docconv.wasm' });
    const m = await ready;
    if (data.graphic) {
      m.FS.writeFile('/g', data.graphic);
      const p = m.ccall('oof_decode_graphic', 'number', ['string'], ['/g']);
      const svg = m.UTF8ToString(p);
      m._free(p);
      m.FS.unlink('/g');
      self.postMessage({ ok: true, svg });
      return;
    }
    m.FS.writeFile('/in', new Uint8Array(await data.file.arrayBuffer()));
    const ptr = m.ccall('oof_convert', 'number', ['string', 'string'], ['/in', data.password || '']);
    const out = m.UTF8ToString(ptr);
    m._free(ptr);
    m.FS.unlink('/in');
    const nl = out.indexOf('\n');
    const [kind, a, b] = out.slice(0, nl).split(' ');
    if (kind === 'error') self.postMessage({ ok: false, error: a });
    else self.postMessage({ ok: true, kind, lib: a, format: b, body: out.slice(nl + 1) });
  } catch (err) {
    // An abort leaves the module unusable; start fresh next time.
    ready = null;
    self.postMessage({ ok: false, error: 'crash', detail: String((err && err.message) || err) });
  }
};
