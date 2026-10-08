// Fix-ups for SVG drawn through librevenge (doc and dlp2 engines).

// librevenge's SVG drawing writer (patched, see native/build.sh) multiplies
// fo:font-size by 72, expecting inches, but every library except libmspub
// passes points: 12 pt text came out as font-size="864" and covered drawings
// in giant black glyphs. Slides come from the presentation writer, which is
// not scaled, so only sizes no real text has (300 and up) are divided back.
export function fixMwawFontSizes(svg) {
  return svg.replace(/font-size="([\d.]+)"/g, (m, n) => (+n >= 300 ? `font-size="${+(n / 72).toFixed(3)}"` : m));
}
