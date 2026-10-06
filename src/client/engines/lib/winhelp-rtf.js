// WinHelp RTF (as written by helpdeco) to topics. Kept free of browser-only
// imports so tests can load it in Node.
//
// helpdeco's RTF follows the Help Compiler conventions:
//   \page                     ends a topic
//   {\up #}{\footnote ... ID} topic ID (also $ = title, K = keywords)
//   \uldb text{\v ID}         jump to topic ID (\ul = popup; same here)
//   \{bmc pic.bmp\}           inline picture (also bml/bmr, left/right)
// Only the subset helpdeco writes is handled: fonts, bold/italic/underline,
// sizes, centred paragraphs, indents, tabs, line breaks and simple tables.

// ---------- RTF tokenizer -----------------------------------------------------

function* tokens(rtf) {
  let i = 0;
  const n = rtf.length;
  while (i < n) {
    const c = rtf[i];
    if (c === '{') { yield { t: '{' }; i++; continue; }
    if (c === '}') { yield { t: '}' }; i++; continue; }
    if (c === '\r' || c === '\n') { i++; continue; }
    if (c === '\\') {
      const d = rtf[i + 1];
      if (/[a-z]/i.test(d)) {
        let j = i + 1;
        while (j < n && /[a-z]/i.test(rtf[j])) j++;
        const word = rtf.slice(i + 1, j);
        let k = j;
        if (rtf[k] === '-' || /\d/.test(rtf[k])) {
          k++;
          while (k < n && /\d/.test(rtf[k])) k++;
        }
        const arg = k > j ? parseInt(rtf.slice(j, k), 10) : null;
        if (rtf[k] === ' ') k++;
        yield { t: 'w', word, arg };
        i = k;
        continue;
      }
      if (d === "'") {
        yield { t: 'x', text: String.fromCharCode(parseInt(rtf.substr(i + 2, 2), 16)) };
        i += 4;
        continue;
      }
      const sym = { '~': ' ', '-': '', _: '‑', '{': '{', '}': '}', '\\': '\\' }[d];
      yield { t: 'x', text: sym ?? '' };
      i += 2;
      continue;
    }
    let j = i;
    while (j < n && !'{}\\\r\n'.includes(rtf[j])) j++;
    yield { t: 'x', text: rtf.slice(i, j) };
    i = j;
  }
}

// Windows-1252 bytes come through \'hh as Latin-1 code points; map the
// 0x80-0x9F range to the characters Windows meant.
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const fix1252 = (s) => s.replace(/[\u0080-\u009f]/g, (ch) => CP1252[ch.charCodeAt(0) - 0x80]);

export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- RTF -> topics ---------------------------------------------------------

const SKIP_DEST = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object']);

export function parseHelpRtf(rtf) {
  const topics = [];
  let topic = newTopic();
  const stack = [];
  let st = { b: false, i: false, u: false, link: false, v: false, fs: 24, skip: false, foot: false, up: false };
  let para = { center: false, li: 0, intbl: false };
  let html = '';         // current paragraph's HTML
  let linkText = '';     // underlined run waiting for its {\v ID}
  let footText = '';
  let footMark = '';
  let upText = '';
  let table = null;      // { rows: [[cellHtml]], row: [], cell }
  let linkDone = false;  // a {\v ID} group just consumed the pending link

  function newTopic() { return { ids: [], title: '', keywords: [], body: '' }; }

  // Text is collected into runs of identical style, so that one word (or a
  // "{bmc pic.bmp}" picture reference) is never split across elements.
  let run = '';
  let runStyle = null;
  const styleKey = () => `${st.b}|${st.i}|${st.u && !st.link}|${st.fs}`;
  function flushRun() {
    if (!run) return;
    const r = runStyle;
    html += (r.b ? '<b>' : '') + (r.i ? '<i>' : '') + (r.u ? '<u>' : '') + (r.fs !== 24 ? `<span style="font-size:${r.fs / 2}pt">` : '') +
      escapeHtml(fix1252(run)) +
      (r.fs !== 24 ? '</span>' : '') + (r.u ? '</u>' : '') + (r.i ? '</i>' : '') + (r.b ? '</b>' : '');
    run = '';
  }
  const addHtml = (x) => { flushRun(); html += x; };

  function emitText(s) {
    if (st.skip || st.up) {
      if (st.up) upText += s;
      return;
    }
    if (st.foot) { footText += s; return; }
    if (st.v) { flushLink(s); return; }
    if (st.link) { linkText += s; return; }
    const key = styleKey();
    if (run && runStyle.key !== key) flushRun();
    if (!run) runStyle = { key, b: st.b, i: st.i, u: st.u && !st.link, fs: st.fs };
    run += s;
  }

  function flushLink(target) {
    flushRun();
    if (!linkText) return;
    const id = target ? target.replace(/[@>].*$/, '').trim() : '';
    const text = escapeHtml(fix1252(linkText));
    html += id ? `<a href="#" data-topic="${escapeHtml(id.toLowerCase())}">${text}</a>` : text;
    linkText = '';
    linkDone = true;
  }

  function endPara() {
    flushLink('');
    flushRun();
    const style = [para.center ? 'text-align:center' : '', Math.abs(para.li) >= 20 ? `margin-left:${(para.li / 20).toFixed(0)}pt` : ''].filter(Boolean).join(';');
    const p = `<p${style ? ` style="${style}"` : ''}>${html || '&nbsp;'}</p>`;
    if (para.intbl && table) table.cell += p;
    else { endTable(); topic.body += p; }
    html = '';
  }

  function endTable() {
    if (!table) return;
    if (table.row.length) table.rows.push(table.row);
    topic.body += '<table class="hlp-table">' + table.rows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</table>';
    table = null;
  }

  function endTopic() {
    if (html || run) endPara();
    endTable();
    if (topic.body.replace(/<p>&nbsp;<\/p>/g, '').trim() || topic.title) topics.push(topic);
    topic = newTopic();
  }

  let groupStart = false;
  for (const tok of tokens(rtf)) {
    if (tok.t === '{') { stack.push({ ...st }); groupStart = true; continue; }
    if (tok.t === '}') {
      const was = st;
      st = stack.pop() || st;
      if (was.foot && !st.foot) {
        const text = footText.trim();
        if (footMark === '#') topic.ids.push(text.toLowerCase());
        else if (footMark === '$') topic.title = fix1252(text);
        else if (footMark === 'K') topic.keywords.push(...fix1252(text).split(';').map((k) => k.trim()).filter(Boolean));
        footText = '';
      }
      if (was.up && !st.up && !was.foot) { footMark = upText.trim(); upText = ''; }
      // The link run ended with its target; the restored outer state must
      // not keep collecting link text.
      if (linkDone) { st.link = false; linkDone = false; }
      groupStart = false;
      continue;
    }
    const first = groupStart;
    groupStart = false;
    if (tok.t === 'x') { emitText(tok.text); continue; }

    const { word, arg } = tok;
    if (first && (SKIP_DEST.has(word) || word === '*')) { st.skip = true; continue; }
    if (st.skip) continue;
    switch (word) {
      case 'footnote': st.foot = true; footText = ''; break;
      case 'up': if (first) { st.up = true; upText = ''; } break;
      case 'v':
        st.v = arg !== 0;
        if (!st.v && linkDone) { st.link = false; linkDone = false; }
        break;
      case 'uldb': case 'ul': case 'uld': case 'strike':
        if (arg === 0) { st.link = false; st.u = false; break; }
        // \uldb and \strike are jumps, \ul a popup; both open the topic here.
        if (linkText) flushLink('');
        linkDone = false;
        st.link = true;
        break;
      case 'ulnone': st.u = false; st.link = false; break;
      case 'b': st.b = arg !== 0; break;
      case 'i': st.i = arg !== 0; break;
      case 'fs': st.fs = arg || 24; break;
      // helpdeco writes \plain between a link's text and its {\v ID}, so
      // \plain does not end a link.
      case 'plain': st.b = st.i = st.u = false; st.fs = 24; break;
      case 'par': if (!st.foot) endPara(); else footText += ' '; break;
      case 'line': addHtml('<br>'); break;
      case 'tab': emitText('\t'); break;
      case 'page': endTopic(); break;
      case 'pard': para = { center: false, li: 0, intbl: false }; break;
      case 'qc': para.center = true; break;
      case 'li': para.li = arg || 0; break;
      case 'intbl': para.intbl = true; if (!table) table = { rows: [], row: [], cell: '' }; break;
      case 'trowd': if (!table) table = { rows: [], row: [], cell: '' }; break;
      case 'cell': if (table) { flushRun(); if (html) { table.cell += html; html = ''; } table.row.push(table.cell); table.cell = ''; } break;
      case 'row': if (table) { table.rows.push(table.row); table.row = []; } break;
      default: break;
    }
  }
  endTopic();
  return topics;
}

