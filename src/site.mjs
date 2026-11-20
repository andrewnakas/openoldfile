// Site-wide settings.

export const SITE = {
  name: 'OpenOldFile',
  origin: 'https://openoldfile.com',
  // GA4 measurement ID for the openoldfile.com property (account 355639960).
  // Empty = no analytics tag on the pages.
  gaId: 'G-DQ57CLVDWG',
  // Shown on the contact and privacy pages. Route it with Cloudflare Email
  // Routing before launch.
  email: 'hello@openoldfile.com',
  // Public source (AGPL-3.0, required by the MuPDF-based XPS viewer).
  source: 'https://github.com/andrewnakas/openoldfile',
  // IndexNow key (Bing, Yandex, Seznam...): served as /<key>.txt and sent by
  // scripts/indexnow.mjs after each deploy. Not a secret.
  indexNowKey: 'e2f96172c3d9016c150b4a985a8d1405',
  // Sister sites that own neighbouring formats; linked from every footer.
  sisters: [
    { name: 'ExeBrowser', url: 'https://exebrowser.com/', blurb: 'run Windows and DOS programs in your browser' },
    { name: 'macemu', url: 'https://macemu.com/', blurb: 'run classic Mac apps and open StuffIt and BinHex files' },
    { name: 'Decomp Games', url: 'https://decompgames.com/', blurb: 'play decompilations, source ports and engine recreations of classic games' }
  ],
  // The wider family of no-upload file tools, each owning a different kind of
  // file. Footer only, brand name as the link text, one plain line each.
  tools: [
    { name: 'PDFToolBench', url: 'https://pdftoolbench.com/', blurb: 'PDF tools: merge, split, compress' },
    { name: 'FreeBookConvert', url: 'https://freebookconvert.com/', blurb: 'ebook and document converter' },
    { name: 'ShrinkVideo', url: 'https://shrinkvideo.com/', blurb: 'compress and convert video' },
    { name: 'AudioSaw', url: 'https://audiosaw.com/', blurb: 'audio converter and cutter' },
    { name: 'Kiln', url: 'https://editkiln.com/', blurb: 'photo, vector and video editors' },
    { name: 'FixHEIC', url: 'https://fixheic.com/', blurb: 'open iPhone HEIC photos' },
    { name: 'FreePhotoConvert', url: 'https://freephotoconvert.com/', blurb: 'convert image formats' },
    { name: 'unrarit', url: 'https://unrarit.com/', blurb: 'open RAR files' },
    { name: 'extract7z', url: 'https://extract7z.com/', blurb: 'open 7Z, ZIP and more' }
  ]
};
