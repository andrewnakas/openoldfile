// Shared controller for every page: the drop zone, routing a file to the
// right engine, the result area, downloads and analytics.
//
// A format page carries data-slug on <body>; the home page has none and
// routes whatever is dropped. Engines live in /js/engines/<name>.js and export
//   open(file, ui) -> Promise<void>
// throwing OpenError(type, message) for anything the visitor should see.

import { sniff, extOf } from './sniff.js';
import { CATALOG } from './catalog.js';
import { isOpenError, routeTo, takeHandoff } from './ui-kit.js';

const $ = (sel, root = document) => root.querySelector(sel);

const pageSlug = document.body.dataset.slug || '';
const spec = CATALOG.find((f) => f.slug === pageSlug) || null;

// ---------- analytics ---------------------------------------------------------
// Event names match the other sites (convert_start / convert_success /
// convert_error) so the GA4 reports and custom dimensions carry over:
// tool, source_ext, target_format, error_type. Register them as event-scoped
// custom dimensions the day this ships; GA4 does not backfill.

function track(name, params = {}) {
  if (typeof window.gtag === 'function') window.gtag('event', name, { tool: pageSlug || 'home', ...params });
}

// ---------- ui handed to engines ------------------------------------------------

function makeUi(file) {
  const result = $('#result');
  const status = $('#status');
  const actions = $('#actions');
  result.replaceChildren();
  actions.replaceChildren();
  result.hidden = false;
  let succeeded = false;

  const ui = {
    file,
    ext: extOf(file.name),
    output: result,
    progress(text) {
      status.textContent = text;
      status.hidden = !text;
    },
    // Offer a file to save. A save is tracked as file_download; the funnel's
    // success is the file opening at all (engines call ui.done() once it is
    // on screen), so copying or just reading counts.
    action(label, makeBlob, filename, targetFormat) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = label;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          const blob = await makeBlob();
          saveBlob(blob, filename);
          track('file_download', { source_ext: ui.ext, target_format: targetFormat });
        } catch (err) {
          fail(err);
        } finally {
          btn.disabled = false;
        }
      });
      actions.append(btn);
      return btn;
    },
    button(label, onClick, cls = 'btn btn-secondary') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = cls;
      btn.textContent = label;
      btn.addEventListener('click', onClick);
      actions.append(btn);
      return btn;
    },
    done() {
      if (succeeded) return;
      succeeded = true;
      ui.progress('');
      track('convert_success', { source_ext: ui.ext, target_format: 'view' });
    },
    saveBlob,
    baseName: file.name.replace(/\.[^.]+$/, '') || 'file'
  };
  return ui;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---------- errors ----------------------------------------------------------------

function classify(err) {
  if (isOpenError(err)) return err.type;
  const msg = String((err && err.message) || err);
  if (/memory|allocation|RangeError: Array buffer/i.test(msg)) return 'memory';
  if (/not supported|is not defined|WebAssembly|AudioWorklet/i.test(msg)) return 'unsupported_api';
  if (/Failed to fetch|NetworkError|Load failed|import/i.test(msg)) return 'codec_load';
  return 'decode';
}

const ERROR_TEXT = {
  wrong_type: null, // engine supplies its own message
  memory: 'Your browser ran out of memory opening this file. Try a desktop browser, or close other tabs and try again.',
  unsupported_api: 'This browser is missing a feature the viewer needs. A current version of Chrome, Edge, Firefox or Safari will work.',
  codec_load: 'Part of the viewer failed to download. Check your connection and reload the page; once loaded it works offline.',
  decode: 'This file could not be read. It may be damaged, or a variant of the format the viewer does not handle yet.'
};

function fail(err) {
  const type = classify(err);
  console.error(err);
  track('convert_error', { source_ext: extOf(currentFile?.name), error_type: type });
  const box = $('#status');
  box.hidden = false;
  box.className = 'status status-error';
  box.textContent = (isOpenError(err) && err.message) || ERROR_TEXT[type] || ERROR_TEXT.decode;
}

// ---------- routing a file ----------------------------------------------------------

let currentFile = null;

async function handle(file) {
  currentFile = file;
  const status = $('#status');
  status.className = 'status';
  const found = await sniff(file);

  // Home page, or a file that belongs on another page: send it there.
  if (!spec || (found && found.slug && found.slug !== spec.slug && !spec.exts.includes(extOf(file.name)))) {
    if (found && found.slug) return routeTo(found.slug, file);
  }
  if (found && found.elsewhere) return explain(file, found);
  if (found && found.planned && !spec) return explain(file, found);
  // Nothing recognised the bytes: the document reader knows ~150 more
  // formats (most classic Mac files have no extension), so let it try.
  if (!spec) return run(file, 'doc', null, () => explain(file, null));
  return run(file, spec.engine, spec.fallback);
}

// fallback: a second engine to try when the first cannot read the file
// (Write files that are really Word for DOS, Works spreadsheets SheetJS
// rejects...). onUnsupported: what to do when nothing recognises it.
async function run(file, engineName, fallback, onUnsupported) {
  track('convert_start', { source_ext: extOf(file.name), engine: engineName });
  let ui = makeUi(file);
  ui.progress('Opening ' + file.name + '…');
  try {
    const engine = await import(`/js/engines/${engineName}.js`);
    await engine.open(file, ui);
  } catch (err) {
    const unreadable = isOpenError(err) && (err.type === 'wrong_type' || err.type === 'decode');
    if (fallback && unreadable) {
      track('engine_fallback', { source_ext: extOf(file.name), engine: engineName, fallback });
      return run(file, fallback, null, null).catch(() => fail(err));
    }
    if (onUnsupported && isOpenError(err) && err.type === 'wrong_type') {
      ui.progress('');
      $('#result').hidden = true;
      return onUnsupported();
    }
    fail(err);
  }
}

function explain(file, found) {
  const status = $('#status');
  status.hidden = false;
  status.className = 'status status-info';
  status.replaceChildren();
  const ext = extOf(file.name);
  if (found && found.elsewhere) {
    const a = document.createElement('a');
    a.href = found.elsewhere.url;
    a.textContent = 'Open it on ' + new URL(found.elsewhere.url).hostname;
    status.append(`This is a ${found.elsewhere.name}. Our sister site opens these by running the original software in your browser. `, a);
    track('route_elsewhere', { source_ext: ext });
  } else if (found && found.planned) {
    status.append(`This looks like a ${found.planned.name}. A viewer for it is being built and will appear on this site soon.`);
    track('route_planned', { source_ext: ext });
  } else {
    status.append(`We don't recognise ${ext ? 'this .' + ext + ' file' : 'this file'} yet. `,
      'Tell us what made it via the contact page and it goes on the list.');
    track('route_unknown', { source_ext: ext || '(none)' });
  }
}

// ---------- drop zone -------------------------------------------------------------------

function wireDropZone() {
  const zone = $('#drop');
  const input = $('#file');
  if (!zone || !input) return;
  input.addEventListener('change', () => input.files[0] && handle(input.files[0]));
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f) handle(f);
  });
  // Dropping anywhere on the page works too: people miss the box.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    if (zone.contains(e.target)) return;
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handle(f);
  });
}

wireDropZone();
takeHandoff(handle);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
