// HTML templates. Every page is static HTML; the tool is enhanced by
// /js/app.js. Text comes from src/formats.mjs.

import { SITE } from './site.mjs';
import { FORMATS, CATEGORIES, PLANNED, ELSEWHERE, UPDATED } from './formats.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dotList = (exts) => exts.map((e) => '.' + e).join(', ');
const extLabel = (f) => '.' + f.exts[0].toUpperCase();

function analytics() {
  if (!SITE.gaId) return '';
  // Consent Mode v2: EEA/UK/CH start denied until the banner choice
  // (js/consent.js); a stored choice is applied before the first hit.
  return `<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500,region:['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','GB','CH']});
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
try{var c=localStorage.getItem('oof_consent');if(c)gtag('consent','update',{analytics_storage:c==='yes'?'granted':'denied'});}catch(e){}
gtag('js',new Date());gtag('config','${SITE.gaId}');
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}"></script>
<script src="/js/consent.js" defer></script>`;
}

function head({ title, desc, path, jsonld = [], preload = [], og = '' }) {
  const url = SITE.origin + path;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
${og ? `<meta property="og:image" content="${SITE.origin}/og/${og}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#f6f1e7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1b1a17" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="/css/style.css">
<link rel="modulepreload" href="/js/app.js">
${preload.map((href) => `<link rel="modulepreload" href="${href}">`).join('\n')}
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
${analytics()}
</head>`;
}

function header() {
  return `<header class="site-header">
  <div class="wrap">
    <a class="logo" href="/"><span class="logo-mark" aria-hidden="true">▤</span> ${SITE.name}</a>
    <nav aria-label="Main">
      <a href="/#formats">All formats</a>
      <a href="/extensions/">Extensions A–Z</a>
      <a href="/about/">About</a>
    </nav>
  </div>
</header>`;
}

function footer() {
  const cols = CATEGORIES.map((c) => {
    const items = FORMATS.filter((f) => f.category === c.id)
      .map((f) => `<li><a href="/open/${f.slug}/">${esc(f.program)} (${esc(extLabel(f))})</a></li>`).join('');
    return `<div><h3><a href="/formats/${c.id}/">${esc(c.name)}</a></h3><ul>${items}</ul></div>`;
  }).join('');
  const sisters = SITE.sisters.map((s) => `<li><a href="${s.url}">${esc(s.name)}</a>: ${esc(s.blurb)}</li>`).join('');
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-cols">${cols}</div>
    <div class="footer-sisters"><h3>Sister sites</h3><ul>${sisters}</ul></div>
    <p class="footer-legal">Files are opened in your browser and never uploaded. <a href="/extensions/">File extensions A–Z</a> · <a href="/about/">About</a> · <a href="/privacy/">Privacy</a> · <a href="/contact/">Contact</a> · <a href="${SITE.source}">Source code</a></p>
  </div>
</footer>`;
}

// No accept= filter: iOS greys out every file whose extension it has no type
// for (all of these formats), so the picker stays open and the engines check
// the bytes instead.
function tool({ accept, prompt, sub }) {
  return `<section class="tool" aria-label="Open a file">
  <label id="drop" class="drop">
    <input id="file" type="file"${accept ? ` accept="${esc(accept)}"` : ''}>
    <span class="drop-main">${prompt}</span>
    <span class="drop-sub">${sub}</span>
    <span class="btn">Choose a file</span>
  </label>
  <p class="privacy-line">🔒 Opened right here in your browser. Nothing is uploaded.</p>
  <div id="status" class="status" role="status" aria-live="polite" hidden></div>
  <div id="actions" class="actions"></div>
  <div id="result" class="result" hidden></div>
  <p id="after" class="after" hidden></p>
</section>`;
}

function faqHtml(faq) {
  return faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n');
}

const faqLd = (faq) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
});

// Home › [category] › [this page], as links and as BreadcrumbList JSON-LD.
function crumbs(trail) {
  const all = [{ name: SITE.name, path: '/' }, ...trail];
  const html = `<nav class="crumbs" aria-label="Breadcrumb">${all.map((c, i) =>
    i === all.length - 1 ? esc(c.name) : `<a href="${c.path}">${esc(c.name)}</a>`).join(' › ')}</nav>`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE.origin + c.path }))
  };
  return { html, ld };
}

const categoryOf = (f) => CATEGORIES.find((c) => c.id === f.category);

function page({ title, desc, path, jsonld, slug = '', body, preload = [], og = '' }) {
  return `${head({ title, desc, path, jsonld, preload, og })}
<body${slug ? ` data-slug="${slug}"` : ''}>
${header()}
<main class="wrap">
${body}
</main>
${footer()}
<script type="module" src="/js/app.js"></script>
</body>
</html>
`;
}

// ---------- format page ------------------------------------------------------

const VERB = { sheet: 'read it', wri: 'read it', xps: 'read it', chm: 'read it', archive: 'see what is inside', metafile: 'see the picture', swf: 'play it', midi: 'play it', tracker: 'play it', realmedia: 'play it', hlp: 'read it', doc: 'read it', wordstar: 'read it', disk: 'see what is on it', pict: 'see the picture', amipro: 'read it', tape: 'see what is on it' };
const SAVES = (o) => !/^(Play|Full screen|Browse)/.test(o);

const orList = (xs) => xs.length > 1 ? xs.slice(0, -1).join(', ') + ' or ' + xs[xs.length - 1] : xs[0];
// The "Convert .X to ..." heading: the spec's convertTo, else ZIP for
// archives, else the outputs without their notes ("Excel (.xlsx)" -> "Excel").
function convertTo(f, saves) {
  if (f.convertTo) return f.convertTo;
  if (f.engine === 'archive' || f.engine === 'disk') return 'ZIP';
  return orList(saves.map((o) => o.replace(/\s*\(.*\)$/, '')));
}

// "your .cwk or .cws file": the first two or three extensions read well;
// the full list is shown under the drop zone.
function extPhrase(exts) {
  const shown = exts.slice(0, exts.length > 3 ? 2 : 3).map((e) => '.' + e);
  return shown.length > 1 ? shown.slice(0, -1).join(', ') + ' or ' + shown[shown.length - 1] : shown[0];
}

function ledeFor(f) {
  const tail = ` No ${f.needs || f.program} needed, and the file never leaves your device.`;
  if (f.engine === 'archive' || f.engine === 'disk') {
    return `Drop your ${extPhrase(f.exts)} file to see what is inside and save the files, one at a time or all together as a .zip.` +
      (f.engine === 'disk' ? ' No emulator or disk tools needed, and the file never leaves your device.' : tail);
  }
  const saves = f.outputs.filter(SAVES);
  const list = saves.join(', ').replace(/, ([^,]*)$/, ' or $1');
  return `Drop your ${extPhrase(f.exts)} file to ${VERB[f.engine]}${saves.length ? ` and save it as ${list}` : ' right here'}.` + tail;
}

export function formatPage(f) {
  const path = `/open/${f.slug}/`;
  const main = extLabel(f);
  const related = f.related.map((s) => FORMATS.find((x) => x.slug === s)).filter(Boolean);
  const cat = categoryOf(f);
  const trail = crumbs([{ name: cat.name, path: `/formats/${cat.id}/` }, { name: f.program, path }]);
  const saves = f.outputs.filter(SAVES);
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: f.h1,
      url: SITE.origin + path,
      description: f.desc,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (runs in a web browser)',
      browserRequirements: 'Requires JavaScript and WebAssembly',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [`Open ${dotList(f.exts)} files`, ...saves.map((o) => 'Save as ' + o), 'No upload: runs entirely in the browser'],
      dateModified: f.updated || UPDATED
    },
    faqLd(f.faq),
    trail.ld
  ];
  const body = `${trail.html}
<h1>${esc(f.h1)}</h1>
<p class="lede">${esc(ledeFor(f))}</p>
${tool({ accept: '', prompt: `Drop your ${esc(main)} file here`, sub: esc(dotList(f.exts)) })}

<section>
<h2>How to open a ${esc(main)} file</h2>
<ol class="steps">
  <li><strong>Drop the file</strong> on the box above, or press <em>Choose a file</em>. On a phone, pick it from Files or Downloads.</li>
  <li><strong>It opens in this tab.</strong> The file is read by code running in your browser; nothing is sent to a server.</li>
  <li>${f.outputs.some(SAVES) ? `<strong>Save a modern copy</strong>: ${esc(f.outputs.filter(SAVES).join(', '))}.` : '<strong>Play it in the page</strong>, full screen if you like.'}</li>
</ol>
</section>

<section>
<h2>What is a ${esc(main)} file?</h2>
<p class="era">${esc(f.era)}</p>
${f.about.map((p) => `<p>${esc(p)}</p>`).join('\n')}
</section>
${saves.length ? `
<section>
<h2>Convert ${esc(main)} to ${esc(convertTo(f, saves))}</h2>
<p>Open the file above, then press the download button for the format you want. The conversion runs in your browser, so it is as fast as your device and works the same on Windows, macOS, ChromeOS, Linux, iPhone and Android. The copy you save opens in today's software.</p>
</section>` : ''}
<section class="faq">
<h2>Questions</h2>
${faqHtml(f.faq)}
</section>

<section>
<h2>Other old formats</h2>
<ul class="related">
${related.map((r) => `<li><a href="/open/${r.slug}/">${esc(r.h1)}</a></li>`).join('\n')}
<li><a href="/formats/${cat.id}/">All ${esc(cat.name.toLowerCase())}</a></li>
<li><a href="/">Open any old file</a></li>
</ul>
</section>`;
  // The page's own viewer loads with the page, so it works offline once the
  // page has loaded (the service worker keeps it for later visits).
  return page({ title: f.title, desc: f.desc, path, jsonld, slug: f.slug, body, preload: [`/js/engines/${f.engine}.js`], og: f.slug });
}

// ---------- home -------------------------------------------------------------

const HOME_FAQ = [
  ['How do I open a file with an extension I don\'t recognise?', 'Drop it on the box at the top of this page. The site reads the first bytes of the file to work out what it really is, whatever its name, and sends it to the right viewer.'],
  ['Are my files uploaded?', 'No. Every viewer runs in your browser using JavaScript and WebAssembly. Once a viewer has been used it is kept on your device, so it keeps working without an internet connection.'],
  ['Which old formats can it open?', `Today: ${FORMATS.map((f) => f.program).filter((v, i, a) => a.indexOf(v) === i).join(', ')}. Next: ${PLANNED.map((p) => p.name).join(', ')}.`],
  ['Does it work on a Mac, Chromebook or phone?', 'Yes. Everything runs in the browser, so it works the same in Chrome, Edge, Firefox and Safari on Windows, macOS, ChromeOS, Linux, iOS and Android.'],
  ['Is it free?', 'Yes, with no sign-up and no limits on the number of files.']
];

export function homePage() {
  const title = 'Open Old Files Online, Free | Legacy File Viewer, No Upload';
  const desc = 'Open old and obsolete file formats in your browser: Lotus 1-2-3, dBASE, Windows Write, CHM, XPS, LZH, ARJ, Flash, MIDI and more. Free, nothing uploaded.';
  const grid = CATEGORIES.map((c) => {
    const cards = FORMATS.filter((f) => f.category === c.id).map((f) =>
      `<li><a class="card" href="/open/${f.slug}/"><span class="card-ext">${esc(f.exts.slice(0, 3).map((e) => '.' + e).join(' '))}</span><span class="card-name">${esc(f.program)}</span></a></li>`).join('\n');
    return `<h3><a href="/formats/${c.id}/">${esc(c.name)}</a></h3><ul class="cards">${cards}</ul>`;
  }).join('\n');
  const planned = PLANNED.map((p) => `<li>${esc(p.name)} <span class="muted">(${esc(dotList(p.exts))})</span></li>`).join('');
  const elsewhere = ELSEWHERE.map((e) => `<li><a href="${e.url}">${esc(e.name)}</a> <span class="muted">(${esc(dotList(e.exts))})</span></li>`).join('');
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.origin + '/' },
    faqLd(HOME_FAQ)
  ];
  const body = `<h1>Open old files online</h1>
<p class="lede">Found a file from the 80s, 90s or 2000s that nothing on your computer will open? Drop it here. The site works out what it is and opens it in your browser, with no software to install and nothing uploaded.</p>
${tool({ accept: '', prompt: 'Drop any old file here', sub: 'We work out the format from its contents' })}

<section id="formats">
<h2>Formats you can open</h2>
${grid}
</section>

<p>Not sure what a file is? See the <a href="/extensions/">A–Z list of old file extensions</a>.</p>

<section class="two-col">
<div>
<h2>Coming next</h2>
<ul class="plain">${planned}</ul>
</div>
<div>
<h2>Mac and DOS files</h2>
<p>Our sister sites run the original software in your browser for these:</p>
<ul class="plain">${elsewhere}</ul>
</div>
</section>

<section class="faq">
<h2>Questions</h2>
${faqHtml(HOME_FAQ)}
</section>`;
  return page({ title, desc, path: '/', jsonld, body, og: 'home' });
}

// ---------- category hubs ------------------------------------------------------

export function categoryPage(c) {
  const path = `/formats/${c.id}/`;
  const list = FORMATS.filter((f) => f.category === c.id);
  const trail = crumbs([{ name: c.name, path }]);
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: c.h1,
      url: SITE.origin + path,
      description: c.desc,
      mainEntity: { '@type': 'ItemList', itemListElement: list.map((f, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.origin}/open/${f.slug}/`, name: f.h1 })) }
    },
    trail.ld
  ];
  const items = list.map((f) => `<li><a class="card" href="/open/${f.slug}/"><span class="card-ext">${esc(dotList(f.exts.slice(0, 4)))}</span><span class="card-name">${esc(f.h1)}</span><span class="card-desc">${esc(f.desc)}</span></a></li>`).join('\n');
  const body = `${trail.html}
<h1>${esc(c.h1)}</h1>
<p class="lede">${esc(c.intro)}</p>
${tool({ accept: '', prompt: 'Drop any old file here', sub: 'We work out the format from its contents' })}
<section>
<h2>${esc(c.name)}</h2>
<ul class="cards cards-wide">
${items}
</ul>
</section>
<section>
<h2>Other kinds of old files</h2>
<ul class="related">
${CATEGORIES.filter((x) => x.id !== c.id).map((x) => `<li><a href="/formats/${x.id}/">${esc(x.h1)}</a></li>`).join('\n')}
<li><a href="/extensions/">Old file extensions A–Z</a></li>
</ul>
</section>`;
  return page({ title: c.title, desc: c.desc, path, jsonld, body, og: 'home' });
}

// ---------- extension index ----------------------------------------------------

export function extensionsPage() {
  const path = '/extensions/';
  const rows = [];
  for (const f of FORMATS) for (const e of f.exts) rows.push({ e, what: f.program, href: `/open/${f.slug}/`, label: f.h1 });
  for (const x of ELSEWHERE) for (const e of x.exts) rows.push({ e, what: x.name, href: x.url, label: 'Open on ' + new URL(x.url).hostname });
  for (const x of PLANNED) for (const e of x.exts) rows.push({ e, what: x.name, href: '', label: 'Viewer coming soon' });
  // An extension used by two formats (.wks, .pic...) gets one row per meaning.
  rows.sort((a, b) => a.e.localeCompare(b.e, 'en', { numeric: true }) || a.what.localeCompare(b.what));
  const letterOf = (e) => /[a-z]/.test(e[0]) ? e[0].toUpperCase() : '#';
  const letters = [...new Set(rows.map((r) => letterOf(r.e)))];
  const seen = new Set();
  const table = rows.map((r) => {
    const letter = letterOf(r.e);
    const anchor = seen.has(letter) ? '' : ` id="ext-${letter === '#' ? '0' : letter}"`;
    seen.add(letter);
    return `<tr${anchor}><th scope="row" class="path">.${esc(r.e)}</th><td>${esc(r.what)}</td><td>${r.href ? `<a href="${r.href}">${esc(r.label)}</a>` : `<span class="muted">${esc(r.label)}</span>`}</td></tr>`;
  }).join('\n');
  const title = 'Old File Extensions A–Z: What They Are, How to Open Them';
  const desc = `What made a .${FORMATS[0].exts[0]}, .wpd, .hlp or .lzh file, and how to open it today. ${rows.length} old and obsolete file extensions, each with a free viewer.`;
  const trail = crumbs([{ name: 'File extensions A–Z', path }]);
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Old file extensions A–Z', url: SITE.origin + path, description: desc, dateModified: UPDATED },
    trail.ld
  ];
  const body = `${trail.html}
<h1>Old file extensions A–Z</h1>
<p class="lede">Every extension below comes from a program of the 1980s, 1990s or early 2000s. Find yours to see what made it and where to open it, or drop the file in the box and the site works it out from the contents.</p>
${tool({ accept: '', prompt: 'Drop any old file here', sub: 'We work out the format from its contents' })}
<section>
<h2>Extensions</h2>
<p class="letters">${letters.map((l) => `<a href="#ext-${l === '#' ? '0' : l}">${l}</a>`).join(' ')}</p>
<div class="table-wrap table-tall"><table class="files ext-table">
<thead><tr><th scope="col">Extension</th><th scope="col">What made it</th><th scope="col">Open it</th></tr></thead>
<tbody>
${table}
</tbody></table></div>
</section>
<section>
<h2>Not on the list?</h2>
<p>Drop the file above anyway: the site reads its first bytes, and the document reader knows about 150 formats, many of them from classic Mac programs that saved files with no extension at all. If it still isn't recognised, <a href="/contact/">tell us</a> what program made it and it goes on the list.</p>
</section>`;
  return page({ title, desc, path, jsonld, body, og: 'home' });
}

// ---------- plain pages -----------------------------------------------------------

export function textPage({ path, title, desc, h1, html }) {
  return page({ title, desc, path, jsonld: [], body: `<h1>${esc(h1)}</h1>\n<div class="prose">${html}</div>` });
}

export function notFoundPage() {
  return page({
    title: 'Page not found | ' + SITE.name,
    desc: 'This page does not exist.',
    path: '/404',
    jsonld: [],
    body: `<h1>Page not found</h1>
<p class="lede">That page doesn't exist, but you can still drop any old file here and we'll work out how to open it.</p>
${tool({ accept: '', prompt: 'Drop any old file here', sub: 'We work out the format from its contents' })}`
  }).replace('<head>', '<head>\n<meta name="robots" content="noindex">');
}
