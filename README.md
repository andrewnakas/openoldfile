# openoldfile.com

Open old and obsolete file formats in the browser. Nothing is uploaded: every
viewer runs locally in JavaScript/WebAssembly. One page per format, each
owning one search intent ("open wk1 file", "open chm file on mac"...).

## Layout

| Path | What |
|---|---|
| `src/formats.mjs` | **The page specs**: one entry per format page (title, H1, description, FAQ, engine). Add a format here. |
| `src/layout.mjs` | HTML templates (home, format page, text pages, JSON-LD) |
| `src/site.mjs` | Site settings: origin, **GA4 ID**, contact email, sister sites |
| `src/client/app.js` | Drop zone, routing, analytics events, error messages |
| `src/client/sniff.js` | Magic-byte detection; routes files to the right page or a sister site |
| `src/client/engines/*.js` | One module per format family, lazy-loaded: `open(file, ui)` |
| `src/client/workers/*.js` | 7-Zip and MuPDF run in workers |
| `scripts/build.mjs` | Builds everything into `public/` (pages, bundles, vendor wasm, sitemap, llms.txt, `_headers`) |
| `test/` | `node --test` suite over real sample files in `test/fixtures/` |

## Commands

    npm install
    npm test          # build + tests
    npm run serve     # http://127.0.0.1:5178

## Engines

| Engine | Formats | Library |
|---|---|---|
| sheet | .wk1 .wk3 .wk4 .123 .wks .wq1 .wb1-3 .qpw .xlr .dbf | SheetJS (Apache-2.0) |
| doc | .wpd .wp (WordPerfect), .wpg, .cwk (ClarisWorks), .wps (Works), .wdb, .pub (Publisher), MacWrite, Word for Mac, WriteNow, Nisus, FullWrite, RagTime, Works for Mac, BeagleWorks, MORE, DOCMaker, Mariner Write, MacPaint, MacDraw, MacDraft, Canvas, SuperPaint, Wingz and ~80 more classic Mac formats (BinHex/MacBinary unwrapped by libmwaw) | libwpd, libwps, libmwaw, libmspub (MPL/LGPL) via `native/docconv.cpp` |
| hlp | .hlp (WinHelp) | helpdeco (GPL-3.0) + own RTF topic parser |
| wri | .wri (pictures via libwps) | written for this site |
| amipro | .sam | written for this site from the gadicc/amipro-sam spec |
| pict | .pict .pct | written for this site (QuickDraw v1/v2) |
| wordstar | .ws .ws4 .ws7 .wsd | written for this site |
| chm | .chm | 7-Zip wasm (LGPL) + own TOC/viewer |
| archive | .lzh .lha .arj .cab .z .taz | 7-Zip wasm |
| disk | .d64 .d71 .d81 (C64), .adf (Amiga OFS/FFS) | written for this site |
| tape | .tzx .tap (ZX Spectrum): files, BASIC listings, loading screens, WAV and TAP export | written for this site |
| xps | .xps .oxps | MuPDF (AGPL-3.0, so this repo's source must be public) |
| swf | .swf | Ruffle (MIT/Apache) |
| midi | .mid .rmi .kar | SpessaSynth (Apache) + GeneralUser GS sound bank |
| tracker | .mod .xm .s3m .it ... | libopenmpt via chiptune3 (BSD/MIT) |
| metafile | .wmf .wmz (rtf.js WMFJS), .emf .emz (own renderer, lib/emf.js) | |
| realmedia | .rm .rmvb .ra | FFmpeg wasm; the 31 MB core loads from jsDelivr at run time |

Files the sniffer can't place on the home page go to the `doc` engine as a
last try, because classic Mac documents usually have no extension. BinHex
(.hqx) files are tried there too before being sent to macemu. Pages for
extensionless Mac formats set `label` in their spec ("Nisus Writer")
instead of relying on `exts`.

`native/build.sh` rebuilds `src/client/vendor/docconv.{mjs,wasm}` and
`helpdeco.{mjs,wasm}` (needs emscripten and boost headers). Both outputs are
committed so deploys need no toolchain.

Known gaps:
- EMF files written by GDI+ with no plain-GDI fallback (EMF+ only) are
  refused with a message; EMF clip regions other than rectangles are
  approximated by their bounds.
- Ami Pro frames, tables and embedded pictures are not shown.
- Embedded OLE objects (other than Paintbrush pictures in Write) appear as
  placeholders.
- Next formats (C64 SID music, Shockwave) need an emulator or a player
  that does not exist as a library yet.
- TZX CSW (0x18) and generalized-data (0x19) blocks are listed but left out
  of the WAV render; jumps and call sequences are ignored.

## Deploying

    npm run deploy

builds and uploads to the `openoldfile` Cloudflare Pages project with
wrangler. It forces IPv4: on this machine's network the IPv6 route to
Cloudflare's upload API times out, which looks like "Failed to upload
files" in wrangler. Live at https://openoldfile.pages.dev until the domain
is attached.

## Analytics events

`convert_start`, `convert_success` (the file opened), `convert_error`
(`error_type`), `file_download` (`target_format`), `route_elsewhere`,
`route_planned`, `route_unknown` (`source_ext`), `feedback` (`source_ext`,
`value` good/bad, from the "Did it open correctly?" buttons), `file_launch`
(opened through the installed app's "Open with"). Register `tool`,
`source_ext`, `target_format` and `error_type` as event-scoped custom
dimensions **on the day GA4 is connected**; GA4 does not backfill.

## Launch checklist

1. ~~Buy openoldfile.com~~ (bought at Namecheap). Add the domain to Cloudflare and switch Namecheap's nameservers to the two Cloudflare gives you.
2. Create a GA4 property in account 355639960, put its ID in `src/site.mjs`, register the custom dimensions above.
3. Cloudflare Pages: the `openoldfile` project already exists (direct upload via `npm run deploy`). Attach `openoldfile.com` and `www.openoldfile.com` under Custom domains once the zone is on Cloudflare.
4. Cloudflare: redirect `www` to the apex (Bulk Redirect or a Redirect Rule) before anything is crawled. Leave "Block AI bots" **off**.
5. Cloudflare Email Routing for `hello@openoldfile.com`.
6. Add the site to Bing Webmaster Tools and Google Search Console; submit `sitemap.xml`; ping IndexNow.
7. Add cross-links from exebrowser.com and macemu.com ("not a program? open the document").
8. Push this repo public (MuPDF is AGPL).

## Pages

Besides one page per format: category hubs at `/formats/<category>/`
(text in `CATEGORIES`), the A–Z extension index at `/extensions/`, and
about/privacy/contact. Sitemap `lastmod` comes from each spec's `updated`
field, else `UPDATED` in `src/formats.mjs`: bump it when a template change
touches every page.

`npm run deploy` ends by pinging IndexNow (`scripts/indexnow.mjs`) with
every sitemap URL; the key file is built from `SITE.indexNowKey`.

## Next formats

Microsoft Reader .lit and Help 2 .hxs (7-Zip opens both; needs sample
files to test), Shockwave (.dcr via dirplayer-rs) and C64 SID music. Pick by Bing keyword data and ChatGPT
landings once the site has traffic.
