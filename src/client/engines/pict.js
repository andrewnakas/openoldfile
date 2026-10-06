// Standalone Macintosh PICT images (.pict, .pct, .pic), drawn by
// lib/pict.js and saved as PNG.

import { renderPict, findPict } from './lib/pict.js';
import { OpenError, el, bytes } from '../ui-kit.js';

export async function open(file, ui) {
  const data = await bytes(file);
  if (!findPict(data)) throw new OpenError('wrong_type', 'This is not a Macintosh PICT image.');
  let canvas;
  try {
    canvas = renderPict(data);
  } catch (err) {
    console.warn(err);
    throw new OpenError('decode', 'This PICT image could not be drawn. It may be damaged.');
  }
  canvas.className = 'pict-canvas';
  ui.output.append(el('div', { class: 'picture' }, canvas), el('p', { class: 'note' }, `${canvas.width} × ${canvas.height} pixels`));
  ui.done();
  ui.action('Download PNG', () => new Promise((resolve) => canvas.toBlob(resolve, 'image/png')), ui.baseName + '.png', 'png');
  ui.action('Download JPEG', () => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92)), ui.baseName + '.jpg', 'jpg');
}
