// Lotus 1-2-3, Quattro Pro, Works spreadsheets and dBASE tables, read with
// SheetJS. Shown as tables (one tab per sheet) and saved as .xlsx or .csv.

import * as XLSX from 'xlsx';
import * as cptable from 'xlsx/dist/cpexcel.full.mjs';
import { OpenError, el, bytes, tabs } from '../ui-kit.js';

XLSX.set_cptable(cptable); // DOS and Windows code pages in dBASE and Lotus files

// Rendering more rows than this freezes phones; the download has them all.
const MAX_ROWS = 2000;

export async function open(file, ui) {
  const data = await bytes(file);
  let wb;
  try {
    wb = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false });
  } catch (err) {
    throw new OpenError('decode', 'This file could not be read as a spreadsheet. It may be damaged, or saved by a version of ' +
      'the program this viewer does not understand yet.');
  }
  if (ui.ext !== 'dbf') stripLabelPrefixes(wb);
  fixBadDates(wb);
  const names = wb.SheetNames.filter((n) => wb.Sheets[n] && wb.Sheets[n]['!ref']);
  if (!names.length) throw new OpenError('decode', 'The file opened but contains no cells.');

  const view = el('div', { class: 'sheet-view' });
  const show = (i) => view.replaceChildren(renderSheet(wb.Sheets[names[i]]));
  if (names.length > 1) ui.output.append(tabs(names, show));
  ui.output.append(view);
  show(0);
  ui.done();

  ui.action('Download .xlsx', () =>
    new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true })],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  ui.baseName + '.xlsx', 'xlsx');
  ui.action(names.length > 1 ? 'Download .csv (first sheet)' : 'Download .csv', () =>
    new Blob(['﻿' + XLSX.utils.sheet_to_csv(wb.Sheets[names[0]])], { type: 'text/csv' }),
  ui.baseName + '.csv', 'csv');
}

// Lotus and Quattro store a label's alignment as its first character:
// ' left, " right, ^ centre, \\ repeat-fill, | non-printing. SheetJS keeps it.
export function stripLabelPrefixes(wb) {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    for (const key of Object.keys(ws)) {
      const c = ws[key];
      if (key[0] === '!' || !c || c.t !== 's' || typeof c.v !== 'string') continue;
      if (/^['"^\\|]/.test(c.v)) {
        c.v = c.v.slice(1);
        delete c.w;
        delete c.h;
      }
    }
  }
}

// A date serial SheetJS can't turn into a Date (Works writes some as day 0)
// becomes an Invalid Date, which throws in sheet_to_html and in the .xlsx
// writer. Keep the text the program displayed instead.
export function fixBadDates(wb) {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    for (const key of Object.keys(ws)) {
      const c = ws[key];
      if (key[0] === '!' || !c || c.t !== 'd' || !isNaN(c.v)) continue;
      c.t = 's';
      c.v = c.w || '';
      delete c.z;
    }
  }
}

function renderSheet(ws) {
  const range = XLSX.utils.decode_range(ws['!ref']);
  const rows = range.e.r - range.s.r + 1;
  const clipped = rows > MAX_ROWS;
  if (clipped) ws = { ...ws, '!ref': XLSX.utils.encode_range({ s: range.s, e: { r: range.s.r + MAX_ROWS - 1, c: range.e.c } }) };

  const wrap = el('div', { class: 'table-wrap' });
  // sheet_to_html escapes cell text; the markup is SheetJS's own.
  wrap.innerHTML = XLSX.utils.sheet_to_html(ws, { header: '', footer: '' });
  const table = wrap.querySelector('table');
  if (table) {
    table.className = 'sheet';
    // Column letters across the top and row numbers down the side, like the
    // original program.
    const head = el('tr', {}, el('th', {}), ...Array.from({ length: range.e.c - range.s.c + 1 }, (_, i) =>
      el('th', {}, XLSX.utils.encode_col(range.s.c + i))));
    table.prepend(el('thead', {}, head));
    table.querySelectorAll('tbody tr').forEach((tr, i) => tr.prepend(el('th', {}, String(range.s.r + i + 1))));
  }
  const out = el('div', {}, wrap);
  if (clipped) out.append(el('p', { class: 'note' }, `Showing the first ${MAX_ROWS.toLocaleString()} of ${rows.toLocaleString()} rows. The download contains every row.`));
  return out;
}
