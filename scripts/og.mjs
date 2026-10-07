// Social preview cards (1200x630 PNG), one per page, drawn with
// @napi-rs/canvas. Called by build.mjs; if the canvas package is missing the
// build carries on without cards.

export async function makeOgImages(pages, outDir) {
  let createCanvas;
  try {
    ({ createCanvas } = await import('@napi-rs/canvas'));
  } catch {
    console.warn('! @napi-rs/canvas not installed: no social cards');
    return false;
  }
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  mkdirSync(outDir, { recursive: true });
  for (const p of pages) {
    const c = createCanvas(1200, 630);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f6f1e7';
    ctx.fillRect(0, 0, 1200, 630);
    // Floppy-disk mark, as in the favicon.
    ctx.fillStyle = '#1d5c8c';
    roundRect(ctx, 80, 80, 150, 160, 16);
    ctx.fillStyle = '#e9e1cf';
    ctx.fillRect(110, 80, 90, 55);
    ctx.fillStyle = '#1d5c8c';
    ctx.fillRect(170, 90, 18, 36);
    ctx.fillStyle = '#f6f1e7';
    roundRect(ctx, 110, 165, 90, 55, 6);
    ctx.fillStyle = '#6b6558';
    ctx.font = '600 34px sans-serif';
    ctx.fillText('OpenOldFile.com', 270, 140);
    ctx.font = '28px sans-serif';
    ctx.fillText('Old files opened in your browser. Nothing uploaded.', 270, 190);
    ctx.fillStyle = '#1d5c8c';
    ctx.font = 'bold 64px monospace';
    ctx.fillText(p.badge, 80, 360);
    ctx.fillStyle = '#23211c';
    ctx.font = 'bold 56px sans-serif';
    wrap(ctx, p.headline, 80, 450, 1040, 66, 2);
    writeFileSync(join(outDir, p.slug + '.png'), c.toBuffer('image/png'));
  }
  return true;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = w;
      if (++lines >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
}

// App icons for the manifest: installing the site as an app (and with it
// "Open with" for old formats) needs PNG icons, not just the SVG favicon.
export async function makeIcons(svgPath, outDir) {
  let createCanvas, loadImage;
  try {
    ({ createCanvas, loadImage } = await import('@napi-rs/canvas'));
  } catch {
    return false;
  }
  const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  mkdirSync(outDir, { recursive: true });
  const img = await loadImage(readFileSync(svgPath));
  for (const size of [192, 512]) {
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f6f1e7';
    ctx.fillRect(0, 0, size, size);
    // Maskable icons keep their content inside the central 80%.
    const pad = size * 0.12;
    ctx.drawImage(img, pad, pad, size - 2 * pad, size - 2 * pad);
    writeFileSync(join(outDir, `icon-${size}.png`), c.toBuffer('image/png'));
  }
  return true;
}
