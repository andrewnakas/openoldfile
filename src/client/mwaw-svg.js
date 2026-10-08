// Fix-ups for SVG drawn by libmwaw through librevenge (doc engine).

// librevenge's SVG writer multiplies fo:font-size by 72, expecting inches,
// but libmwaw passes points: 12 pt text came out as font-size="864" and
// covered drawings in giant black glyphs. libmspub passes inches and is fine.
export function fixMwawFontSizes(svg) {
  return svg.replace(/font-size="([\d.]+)"/g, (m, n) => `font-size="${+(n / 72).toFixed(3)}"`);
}
