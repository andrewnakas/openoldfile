// Run with: npm test (after npm run build, which generates src/client/catalog.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { sniff } from '../src/client/sniff.js';
import { parseWri, toText } from '../src/client/engines/wri.js';
import { FORMATS } from '../src/formats.mjs';

const fx = (name) => new URL('./fixtures/' + name, import.meta.url);
const file = (name, as = name) => new File([readFileSync(fx(name))], as);

test('sniffer routes each fixture by its bytes, whatever its name', async () => {
  const cases = {
    'Lotus.wk1': 'wk1', 'Lotus123_3.123': 'wk1', 'Lotus123_98.123': 'wk1', 'Works_2.0.wks': 'wk1',
    'QuattroPro.wq1': 'wq1', 'QuattroPro.wb1': 'wq1', 'Works_Windows.wks': 'xlr', 'biblio.dbf': 'dbf',
    'Write_3.1.wri': 'wri', 'example.chm': 'chm', 'test_read_format_lha_lh7.lzh': 'lzh',
    'test_read_format_cab_2.cab': 'cab', 'method1.arj': 'arj', 'stored.arj': 'arj', 'hello.txt.Z': 'z', 'ruffle_test.swf': 'swf',
    'scale.mid': 'mid', 'putty.hlp': 'hlp', 'amipro-synthetic.sam': 'sam', 'WPG1.wpg': 'wpg', 'tdf92789.pct': 'pict', 'ooo25876-2.pct': 'pict', 'OCAPTAIN.WS': 'wordstar', 'TWAINLET.WS': 'wordstar', 'EXAMPLE_WS4.DOC': 'wordstar', 'MacWrite_4.5': 'macwrite', 'WriteNow_4.0': 'macwrite', 'MicrosoftWord_5.0': 'macwrite', 'WP6.wpd': 'wpd', 'ClarisWorks_6.0.cwk': 'cwk', 'test.mod': 'mod', 'visio_import_source.wmf': 'wmf',
    'tdf88163-non-placeable.wmf': 'wmf', 'sine_wave.emf': 'emf', 'sample.xps': 'xps'
  };
  for (const [name, slug] of Object.entries(cases)) {
    // Renamed to .bin so only the bytes can decide (XPS is a zip: needs its name).
    const hit = await sniff(file(name, slug === 'xps' ? name : 'renamed.bin'));
    assert.equal(hit && hit.slug, slug, name);
  }
});

test('sniffer recognises formats owned by sister sites and planned formats', async () => {
  assert.equal((await sniff(file('WP6.wpd', 'x.bin'))).slug, 'wpd');
  assert.equal((await sniff(file('WP5.wp', 'x.bin'))).slug, 'wpd');
  assert.equal((await sniff(file('ClarisWorks_6.0.cwk', 'x.bin'))).slug, 'cwk');
  assert.equal((await sniff(file('fdo59355-1.pub'))).slug, 'pub');
  assert.ok((await sniff(new File(['MZ\x90\x00'], 'setup.exe'))).elsewhere, '.exe goes to exebrowser');
  assert.equal(await sniff(new File(['hello'], 'notes.xyz')), null);
});

test('Write decoder keeps text, fonts, alignment and indents', () => {
  const doc = parseWri(new Uint8Array(readFileSync(fx('Write_3.1.wri'))));
  const text = toText(doc);
  assert.match(text, /Test document for Write conversion/);
  assert.match(text, /center aligned/);
  const indented = doc.paragraphs.find((p) => p.runs.some((r) => r.text.startsWith('This paragraph has left indent')));
  assert.deepEqual([indented.left, indented.right, indented.first], [1080, 360, 1440]); // 0.75", 0.25", 1"
  assert.ok(doc.paragraphs.some((p) => p.align === 'right'));
  assert.ok(doc.paragraphs.some((p) => p.runs.some((r) => r.font === 'Courier New' && r.size === 11)));
  assert.ok(doc.paragraphs.some((p) => p.runs.some((r) => r.pos > 0)), 'superscript');
  assert.equal(doc.paragraphs.filter((p) => p.picture).length, 3);
});

test('SheetJS reads every spreadsheet fixture', () => {
  for (const name of ['Lotus.wk1', 'Lotus123_3.123', 'Lotus123_98.123', 'QuattroPro.wb1', 'QuattroPro.wq1', 'Works_2.0.wks', 'Works_Windows.wks', 'biblio.dbf']) {
    const wb = XLSX.read(readFileSync(fx(name)), { type: 'buffer' });
    assert.ok(wb.SheetNames.length > 0 && wb.Sheets[wb.SheetNames[0]]['!ref'], name);
  }
});

test('page specs stay within search-result limits', () => {
  for (const f of FORMATS) {
    assert.ok(f.title.length <= 60, `${f.slug} title is ${f.title.length} chars`);
    assert.ok(f.desc.length <= 160, `${f.slug} description is ${f.desc.length} chars`);
    assert.ok(f.faq.length >= 3, `${f.slug} needs at least 3 FAQ entries`);
  }
});

test('document reader converts WordPerfect, ClarisWorks and Works files', async () => {
  const { default: Module } = await import('../src/client/vendor/docconv.mjs');
  const m = await Module();
  const conv = (name) => {
    m.FS.writeFile('/in', readFileSync(fx(name)));
    const ptr = m.ccall('oof_convert', 'number', ['string', 'string'], ['/in', '']);
    const s = m.UTF8ToString(ptr);
    m._free(ptr);
    return s;
  };
  assert.match(conv('WP6.wpd'), /^html libwpd/);
  assert.match(conv('WP6.wpd').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), /Foo foo/);
  assert.match(conv('ClarisWorks_6.0.cwk').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), /^html libmwaw.*test of different border patterns/);
  assert.match(conv('QuattroPro.wb1'), /^csv libwps/);
  assert.match(conv('Works_4.5.wps'), /^html libwps/);
  assert.match(conv('fdo59355-1.pub'), /^svg libmspub[\s\S]*<svg:svg/);
  assert.match(conv('WPG1.wpg'), /^svg libwpg[\s\S]*<svg:polygon/);
  assert.match(conv('MacWrite_Pro1.0'), /^html libmwaw/);
  // Damaged input fails cleanly rather than aborting the module.
  m.FS.writeFile('/in', readFileSync(fx('Write_3.1.wri')).subarray(0, 5000));
  const p = m.ccall('oof_convert', 'number', ['string', 'string'], ['/in', '']);
  assert.match(m.UTF8ToString(p), /^error /);
});

test('WinHelp decompiles to linked topics', async () => {
  const { default: Module } = await import('../src/client/vendor/helpdeco.mjs');
  const { parseHelpRtf } = await import('../src/client/engines/lib/winhelp-rtf.js');
  const m = await Module({ print: () => {}, printErr: () => {} });
  m.FS.mkdir('/w');
  m.FS.chdir('/w');
  m.FS.writeFile('/w/h.hlp', readFileSync(fx('putty.hlp')));
  try { m.callMain(['h.hlp', '-y']); } catch {}
  const topics = parseHelpRtf(new TextDecoder('windows-1252').decode(m.FS.readFile('/w/h.rtf')));
  assert.ok(topics.length > 400);
  assert.equal(topics[1].title, 'Chapter 1: Introduction to PuTTY');
  const ids = new Set(topics.flatMap((t) => t.ids));
  const links = topics.flatMap((t) => [...t.body.matchAll(/data-topic="([^"]+)"/g)].map((x) => x[1]));
  assert.ok(links.length > 600);
  assert.equal(links.filter((l) => !ids.has(l)).length, 0, 'every link resolves to a topic');
});

test('WordStar decoder restores text and styles', async () => {
  const { parseWordStar, toText } = await import('../src/client/engines/wordstar.js');
  const doc = parseWordStar(new Uint8Array(readFileSync(fx('OCAPTAIN.WS'))));
  assert.match(toText(doc), /O Captain! my Captain! our fearful trip is done,/);
  assert.ok(doc.paragraphs.some((p) => p.runs.some((r) => r.b && /O CAPTAIN! MY CAPTAIN!/.test(r.text))));
  assert.ok(doc.paragraphs.some((p) => p.runs.some((r) => r.i && /Walt Whitman/.test(r.text))));
  assert.match(toText(parseWordStar(new Uint8Array(readFileSync(fx('EXAMPLE_WS4.DOC'))))), /When, in disgrace with fortune and men's eyes,/);
});

test('disk images: Amiga ADF files and a C64 directory', async () => {
  const { readDisk } = await import('../src/client/engines/disk.js');
  const adf = readDisk(new Uint8Array(readFileSync(fx('aros-boot.adf'))), 'adf');
  assert.equal(adf.name, 'AROS Kickstart');
  const install = adf.files.find((f) => f.name === 'C/Install');
  const data = install.data();
  assert.equal(data.length, install.size);
  assert.deepEqual([...data.slice(0, 4)], [0, 0, 3, 0xf3], 'Amiga executable hunk header');

  // A minimal 1541 image: BAM at 18/0, one directory sector at 18/1, one PRG
  // whose single data sector is 1/0.
  const d = new Uint8Array(174848);
  const off = (t, s) => { let n = 0; for (let x = 1; x < t; x++) n += x <= 17 ? 21 : x <= 24 ? 19 : x <= 30 ? 18 : 17; return (n + s) * 256; };
  const bam = off(18, 0);
  d[bam] = 18; d[bam + 1] = 1;
  const name = (o, s) => { for (let i = 0; i < 16; i++) d[o + i] = i < s.length ? s.charCodeAt(i) : 0xa0; };
  name(bam + 0x90, 'TEST DISK');
  d[bam + 0xa2] = 0x31; d[bam + 0xa3] = 0x41;
  const dir = off(18, 1);
  d[dir] = 0; d[dir + 1] = 0xff;
  d[dir + 2] = 0x82; d[dir + 3] = 1; d[dir + 4] = 0; name(dir + 5, 'HELLO'); d[dir + 30] = 1;
  const sec = off(1, 0);
  d[sec] = 0; d[sec + 1] = 5; d.set([0x01, 0x08, 0x60, 0x00], sec + 2);
  const c64 = readDisk(d, 'd64');
  assert.equal(c64.name, 'TEST DISK');
  assert.equal(c64.files[0].name, 'HELLO');
  assert.equal(c64.files[0].type, 'PRG');
  assert.deepEqual([...c64.files[0].data()], [0x01, 0x08, 0x60, 0x00]);
});

test('PICT renderer draws real pictures and survives hostile ones', async () => {
  await import('./helpers/dom-canvas.mjs');
  const { renderPict } = await import('../src/client/engines/lib/pict.js');
  const inkRatio = (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { n++; if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) ink++; }
    return ink / n;
  };
  for (const name of ['tdf92789.pct', 'ooo25876-2.pct', 'clipping-problem.pct', 'inch-size.pct']) {
    const c = renderPict(new Uint8Array(readFileSync(fx(name))));
    assert.ok(inkRatio(c) > 0.01, `${name} drew something`);
  }
  // LibreOffice's crash and hang regressions: must return (or throw) fast.
  for (const name of ['exception-1.pct', 'hang-1.pct']) {
    const t = Date.now();
    try { renderPict(new Uint8Array(readFileSync(fx(name)))); } catch {}
    assert.ok(Date.now() - t < 3000, `${name} finished quickly`);
  }
});

test('LZH: Japanese (Shift-JIS) file names survive extraction', async () => {
  const { default: SevenZip } = await import('7z-wasm');
  const { fixLzhNames } = await import('../src/client/engines/lib/lzh-names.js');
  const archive = readFileSync(fx('test_read_format_lha_filename_cp932.lzh'));
  const sz = await SevenZip({ print: () => {}, printErr: () => {} });
  sz.FS.writeFile('/a.lzh', archive);
  sz.FS.mkdir('/o');
  try { sz.callMain(['x', '/a.lzh', '-o/o', '-y', '-bd', '-p']); } catch {}
  // 7-Zip splits 表 (0x95 0x5C) at the 0x5C, so walk folders as the worker does.
  const walk = (d, out = []) => {
    for (const n of sz.FS.readdir(d)) {
      if (n === '.' || n === '..') continue;
      const p = d + '/' + n;
      if (sz.FS.isDir(sz.FS.stat(p).mode)) walk(p, out); else out.push({ path: p.slice(3), data: sz.FS.readFile(p) });
    }
    return out;
  };
  const entries = walk('/o');
  const names = fixLzhNames(entries, new Uint8Array(archive)).map((e) => e.path).sort();
  assert.deepEqual(names, ['漢字.txt', '表.txt']);
});

test('ARJ archives extract (methods 1-4 and stored) and damage is detected', async () => {
  const { default: SevenZip } = await import('7z-wasm');
  for (const [name, ok] of [['method1.arj', true], ['method4.arj', true], ['stored.arj', true], ['wrongcrc32.arj', false]]) {
    const log = [];
    const sz = await SevenZip({ print: (l) => log.push(l), printErr: (l) => log.push(l) });
    sz.FS.writeFile('/a.arj', readFileSync(fx(name)));
    sz.FS.mkdir('/o');
    try { sz.callMain(['x', '/a.arj', '-o/o', '-y', '-bd', '-p']); } catch {}
    assert.equal(sz.FS.stat('/o/LICENSE').size, 11357, name);
    // The same test the worker uses to flag a partial extraction.
    assert.equal(/ERROR|Data Error|CRC Failed/i.test(log.join('\n')), !ok, name);
  }
  // Emscripten's exit(2) on the damaged archive sets Node's exit code.
  process.exitCode = 0;
});

test('EMF renderer: charts keep their text, unsupported files do not hang', async () => {
  await import('./helpers/dom-canvas.mjs');
  const { emfToSvg } = await import('../src/client/engines/lib/emf.js');
  const sine = emfToSvg(new Uint8Array(readFileSync(fx('sine_wave.emf'))));
  assert.equal((sine.match(/<text/g) || []).length, 22, 'axis labels');
  assert.match(sine, /stroke="#0000ff"/, 'the blue sine curve');
  assert.doesNotMatch(sine, /NaN|Infinity/);
  const mail = emfToSvg(new Uint8Array(readFileSync(fx('computer_mail.emf'))));
  assert.ok((mail.match(/<path/g) || []).length > 10, 'the icon EMFJS refused to draw');
});

test('WinHelp parser keeps picture references and styles intact', async () => {
  const { parseHelpRtf } = await import('../src/client/engines/lib/winhelp-rtf.js');
  const rtf = '{\\rtf1\\ansi{\\up #}{\\footnote\\pard\\plain{\\up #} T1}\n\\pard\\tab Click \\{bmc bm0.bmp\\} then \\b bold\\b0 .\n\\par \\page\n}';
  const [t] = parseHelpRtf(rtf);
  assert.deepEqual(t.ids, ['t1']);
  assert.match(t.body, /\{bmc bm0\.bmp\}/);
  assert.match(t.body, /<b>bold<\/b>/);
  assert.match(t.body, /\tClick/);
});

test('Ami Pro reader: text, styles, inline commands, footnotes', async () => {
  const { parseAmiPro, toText } = await import('../src/client/engines/amipro.js');
  assert.match(toText(parseAmiPro(new Uint8Array(readFileSync(fx('amipro-synthetic.sam'))))), /NATIVE SMOKE DOCUMENT[\s\S]*INVENTED CONTENT ONLY/);
  const sam = '[ver]\r\n\t4\r\n[edoc]\r\n@Title@Annual <+!>Report<-!>\r\n\r\nH<+\'>2<-\'>O, a<<b, line\r\ncontinues.\r\n\r\n<:F1\r\nA footnote.\r\n>\r\n>\r\n';
  const d = parseAmiPro(new TextEncoder().encode(sam));
  assert.equal(d.paragraphs[0].style, 'Title');
  assert.ok(d.paragraphs[0].runs.some((r) => r.b && r.text === 'Report'));
  assert.equal(d.paragraphs[1].runs.map((r) => r.text).join(''), 'H2O, a<b, linecontinues.');
  assert.ok(d.paragraphs[1].runs.some((r) => r.sub && r.text === '2'));
  assert.deepEqual(d.footnotes.map((p) => p.runs.map((r) => r.text).join('')), ['A footnote.']);
});

// A synthetic tape: a BASIC loader and a loading screen, as .tap and .tzx.
function makeTape() {
  const block = (flag, payload) => {
    const d = Uint8Array.from([flag, ...payload, 0]);
    d[d.length - 1] = d.subarray(0, -1).reduce((x, y) => x ^ y, 0);
    return d;
  };
  const header = (type, name, len, p1, p2) => block(0, [type, ...name.padEnd(10).split('').map((c) => c.charCodeAt(0)), len & 255, len >> 8, p1 & 255, p1 >> 8, p2 & 255, p2 >> 8]);
  // 10 BORDER 0: LOAD ""SCREEN$   (0 followed by its hidden 5-byte number)
  const line = [0xe7, 0x30, 0x0e, 0, 0, 0, 0, 0, 0x3a, 0xef, 0x22, 0x22, 0xaa, 0x0d];
  const prog = [0, 10, line.length, 0, ...line];
  const screen = new Uint8Array(6912);
  screen.fill(0xff, 0, 32); // top pixel row of the first third: ink
  screen.fill(0x07 | (1 << 3), 6144); // white ink on blue paper
  const blocks = [header(0, 'loader', prog.length, 10, prog.length), block(0xff, prog), header(3, 'screen', 6912, 16384, 32768), block(0xff, screen)];
  const tap = Buffer.concat(blocks.flatMap((d) => [Buffer.from([d.length & 255, d.length >> 8]), Buffer.from(d)]));
  const info = [0x32, 0, 0, 1, 0, 9, ...Buffer.from('Test Tape')];
  info[1] = info.length - 3;
  const tzx = Buffer.concat([Buffer.from('ZXTape!\x1a\x01\x14', 'latin1'), Buffer.from(info),
    ...blocks.flatMap((d) => [Buffer.from([0x10, 0xe8, 0x03, d.length & 255, d.length >> 8]), Buffer.from(d)])]);
  return { tap: new Uint8Array(tap), tzx: new Uint8Array(tzx) };
}

test('ZX Spectrum tapes: files, BASIC listing, screen, WAV and TZX to TAP', async () => {
  const { readTape, basicListing, screenPixels, renderWav, canTap, toTap, fileLabel } = await import('../src/client/engines/tape.js');
  const { tap, tzx } = makeTape();
  assert.equal((await sniff(new File([tap], 'x.bin'))).slug, 'tzx');
  assert.equal((await sniff(new File([tzx], 'x.bin'))).slug, 'tzx');
  for (const raw of [tap, tzx]) {
    const t = readTape(raw);
    assert.deepEqual(t.files.map((f) => [f.name, fileLabel(f), f.ok]), [['loader', 'Program (runs from line 10)', true], ['screen', 'Screen', true]]);
    assert.equal(basicListing(t.files[0].payload, t.files[0].param2), '  10 BORDER 0: LOAD ""SCREEN$');
    const px = screenPixels(t.files[1].payload);
    assert.deepEqual([...px.subarray(0, 4)], [215, 215, 215, 255], 'ink is white');
    assert.deepEqual([...px.subarray(256 * 4, 256 * 4 + 4)], [0, 0, 215, 255], 'second row is blue paper');
  }
  const t = readTape(tzx);
  assert.equal(t.kind, 'TZX 1.20');
  assert.deepEqual(t.info, [['Title', 'Test Tape']]);
  assert.ok(canTap(t));
  assert.deepEqual(new Uint8Array(await toTap(t).arrayBuffer()), tap);
  const wav = renderWav(t);
  // Pilots 2 x 5 s + 2 x 2 s, 4 x 1 s pauses, and the mostly-zero screen at
  // ROM speed (a 0 bit is 1710 T-states): about 27 s.
  assert.ok(wav.seconds > 40 && wav.seconds < 52, `${wav.seconds} s`);
  const head = new Uint8Array(await wav.blob.slice(0, 12).arrayBuffer());
  assert.equal(String.fromCharCode(...head.subarray(8, 12)), 'WAVE');
});
