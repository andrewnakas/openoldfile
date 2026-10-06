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
  // Sister sites that own neighbouring formats; linked from every footer.
  sisters: [
    { name: 'ExeBrowser', url: 'https://exebrowser.com/', blurb: 'run Windows and DOS programs in your browser' },
    { name: 'macemu', url: 'https://macemu.com/', blurb: 'run classic Mac apps and open StuffIt and BinHex files' }
  ]
};
