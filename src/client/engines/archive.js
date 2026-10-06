// LZH/LHA, ARJ, CAB and Unix .Z archives, extracted by 7-Zip in a worker.
// Lists the files, saves them one at a time or all as a .zip, and offers to
// open any file inside that this site has a viewer for.

import { zipSync } from 'fflate';
import { isOpenError, el, formatBytes, routeTo } from '../ui-kit.js';
import { extract } from './lib/extract.js';
import { sniff } from '../sniff.js';
import { fixLzhNames } from './lib/lzh-names.js';

export async function open(file, ui) {
  let entries = await extractWithPassword(file, ui);
  if (/^(lzh|lha)$/.test(ui.ext) || /^-l[hz].-$/.test(String.fromCharCode(...new Uint8Array(await file.slice(2, 7).arrayBuffer())))) {
    entries = fixLzhNames(entries, new Uint8Array(await file.arrayBuffer()));
  }

  // .Z, .taz and .tar.Z decompress to a single tar: unpack that too.
  if (entries.length === 1 && isTar(entries[0])) {
    ui.progress('Unpacking the tar archive inside…');
    const inner = new File([entries[0].data], entries[0].path.split('/').pop() || 'archive.tar');
    entries = await extract(inner);
  }

  const damaged = entries.partial;
  const total = entries.reduce((n, e) => n + e.data.length, 0);
  if (damaged) ui.output.append(el('p', { class: 'status status-error' }, 'This archive is damaged: some files failed their checksum and may be incomplete or corrupt. Everything that could be recovered is listed below.'));
  ui.output.append(el('p', { class: 'summary' },
    `${entries.length} file${entries.length === 1 ? '' : 's'}, ${formatBytes(total)} uncompressed.`));

  const rows = entries
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => fileRow(e, ui));
  ui.output.append(el('div', { class: 'table-wrap' },
    el('table', { class: 'files' },
      el('thead', {}, el('tr', {}, el('th', {}, 'File'), el('th', { class: 'num' }, 'Size'), el('th', {}))),
      el('tbody', {}, rows))));
  ui.done();

  ui.action('Download all as .zip', () => {
    const tree = {};
    for (const e of entries) tree[e.path] = [e.data, { level: 6 }];
    return new Blob([zipSync(tree)], { type: 'application/zip' });
  }, ui.baseName + '.zip', 'zip');
}

function fileRow(entry, ui) {
  const name = entry.path.split('/').pop();
  const save = el('button', {
    type: 'button',
    class: 'link-btn',
    onclick: () => ui.saveBlob(new Blob([entry.data]), name)
  }, 'Save');
  const cell = el('td', { class: 'row-actions' }, save);
  // Offer "Open" for anything this site can view (an old .wri inside an .lzh).
  const inner = new File([entry.data], name);
  sniff(inner).then((hit) => {
    if (hit && hit.slug) cell.prepend(el('button', { type: 'button', class: 'link-btn', onclick: () => routeTo(hit.slug, inner) }, 'Open'), ' ');
  });
  return el('tr', {}, el('td', { class: 'path' }, entry.path), el('td', { class: 'num' }, formatBytes(entry.data.length)), cell);
}

const isTar = (e) => /\.tar$/i.test(e.path) ||
  (e.data.length > 262 && String.fromCharCode(...e.data.subarray(257, 262)) === 'ustar');

// Ask for the password in the page (not a prompt dialog) and retry.
async function extractWithPassword(file, ui) {
  try {
    ui.progress('Extracting ' + file.name + '…');
    return await extract(file);
  } catch (err) {
    if (!isOpenError(err) || err.type !== 'password') throw err;
  }
  for (;;) {
    ui.progress('');
    const password = await askPassword(ui.output);
    ui.progress('Extracting with password…');
    try {
      return await extract(file, password);
    } catch (err) {
      if (!isOpenError(err) || err.type !== 'password') throw err;
      ui.output.replaceChildren(el('p', { class: 'status status-error' }, 'That password did not work.'));
    }
  }
}

function askPassword(container) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'password', autocomplete: 'off', 'aria-label': 'Archive password' });
    const form = el('form', {
      class: 'password-form',
      onsubmit: (e) => {
        e.preventDefault();
        form.remove();
        resolve(input.value);
      }
    }, el('label', {}, 'This archive is password-protected. Password: ', input), ' ', el('button', { class: 'btn', type: 'submit' }, 'Extract'));
    container.append(form);
    input.focus();
  });
}
