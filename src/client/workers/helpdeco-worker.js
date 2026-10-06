// helpdeco (WinHelp decompiler, GPL) compiled to WebAssembly, in a worker.
// In:  { file: File }
// Out: { ok: true, rtf, hpj, images: { name: ArrayBuffer } } | { ok: false, error }
//
// helpdeco keeps state in C globals, so each file gets a fresh module
// instance (the wasm is 133 KB and cached after the first load).

import Module from '../vendor/helpdeco.mjs';
import SplitMrb from '../vendor/splitmrb.mjs';

const latin1 = new TextDecoder('windows-1252');

self.onmessage = async ({ data }) => {
  const log = [];
  try {
    const m = await Module({ locateFile: () => '/vendor/helpdeco/helpdeco.wasm', print: (l) => log.push(l), printErr: (l) => log.push(l) });
    m.FS.mkdir('/w');
    m.FS.chdir('/w');
    const name = 'help.hlp';
    m.FS.writeFile('/w/' + name, new Uint8Array(await data.file.arrayBuffer()));
    try {
      m.callMain([name, '-y']);
    } catch (e) {
      // ExitStatus on a non-zero exit; the output files say how far it got.
    }
    const files = m.FS.readdir('/w').filter((f) => f !== '.' && f !== '..' && f !== name);
    const rtfName = files.find((f) => /\.rtf$/i.test(f));
    if (!rtfName) {
      self.postMessage({ ok: false, error: /not a help|Not a valid|isn't a/i.test(log.join('\n')) ? 'wrong_type' : 'decode', log: log.slice(-5).join('\n') });
      return;
    }
    const images = {};
    const transfer = [];
    // Hotspot (.shg) and multi-resolution (.mrb) pictures: splitmrb turns
    // each into a plain .bmp or .wmf under the same base name.
    const segmented = files.filter((f) => /\.(shg|mrb)$/i.test(f));
    if (segmented.length) {
      try {
        const sm = await SplitMrb({ locateFile: () => '/vendor/helpdeco/splitmrb.wasm', print: () => {}, printErr: () => {} });
        sm.FS.mkdir('/w');
        sm.FS.chdir('/w');
        for (const f of segmented) {
          sm.FS.writeFile('/w/' + f, m.FS.readFile('/w/' + f));
          try { sm.callMain([f]); } catch {}
          const base = f.replace(/\.[^.]+$/, '');
          for (const out of sm.FS.readdir('/w')) {
            if (out.startsWith(base + '.') && /\.(bmp|wmf)$/i.test(out)) {
              const buf = sm.FS.readFile('/w/' + out).buffer;
              // Keyed by the name the RTF refers to (pic.shg), not pic.bmp.
              images[f.toLowerCase()] = buf;
              images[f.toLowerCase() + '#type'] = out.toLowerCase().endsWith('.wmf') ? 'wmf' : 'bmp';
              transfer.push(buf);
            }
          }
        }
      } catch (err) {
        log.push('splitmrb: ' + err);
      }
    }
    for (const f of files) {
      if (images[f.toLowerCase()]) continue;
      if (!/\.(bmp|wmf|png|jpg|gif)$/i.test(f)) continue;
      const buf = m.FS.readFile('/w/' + f).buffer;
      images[f.toLowerCase()] = buf;
      transfer.push(buf);
    }
    const hpjName = files.find((f) => /\.hpj$/i.test(f));
    self.postMessage({
      ok: true,
      rtf: latin1.decode(m.FS.readFile('/w/' + rtfName)),
      hpj: hpjName ? latin1.decode(m.FS.readFile('/w/' + hpjName)) : '',
      images
    }, transfer);
  } catch (err) {
    self.postMessage({ ok: false, error: 'decode', log: String((err && err.message) || err) });
  }
};
