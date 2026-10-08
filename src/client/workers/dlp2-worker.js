// The second set of Document Liberation Project libraries (libcdr, libvisio,
// libstaroffice, libe-book... via native/dlp2.cpp) in a worker.
//
// In:  { file: File, password?: string }
// Out: { ok: true, kind: 'html'|'csv'|'svg', lib, format, body } | { ok: false, error }

import Module from '../vendor/dlp2.mjs';

let ready = null;

self.onmessage = async ({ data }) => {
  try {
    ready ??= Module({ locateFile: () => '/vendor/dlp2/dlp2.wasm' });
    const m = await ready;
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
