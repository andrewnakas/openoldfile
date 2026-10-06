// Windows Metafile (.wmf/.wmz) and Enhanced Metafile (.emf/.emz), replayed
// into SVG by rtf.js's WMFJS/EMFJS. Saved as SVG, or as PNG at a chosen size.

import { Renderer as WmfRenderer } from 'rtf.js/dist/WMFJS.bundle.js';
import { emfToSvg } from './lib/emf.js';
import { OpenError, el, bytes, gunzip, isGzip } from '../ui-kit.js';

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const s16 = (b, o) => (u16(b, o) << 16) >> 16;
const s32 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);

export async function open(file, ui) {
  let data = await bytes(file);
  if (isGzip(data)) data = await gunzip(data);

  const isEmf = s32(data, 0) === 1 && String.fromCharCode(...data.subarray(40, 44)) === ' EMF';
  const size = isEmf ? emfSize(data) : wmfSize(data);
  if (!size) throw new OpenError('decode', 'The picture has no size information, so it cannot be drawn.');

  // Fit on screen at up to 1000 px on the long side, keeping the aspect ratio.
  const scale = Math.min(1, 1000 / Math.max(size.w, size.h));
  const w = Math.max(1, Math.round(size.w * scale));
  const h = Math.max(1, Math.round(size.h * scale));
  let svg;
  try {
    if (isEmf) {
      svg = new DOMParser().parseFromString(emfToSvg(data), 'image/svg+xml').documentElement;
      svg.setAttribute('width', w + 'px');
      svg.setAttribute('height', h + 'px');
    } else {
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      svg = new WmfRenderer(buf).render({ width: w + 'px', height: h + 'px', xExt: size.w, yExt: size.h, mapMode: 8 });
    }
  } catch (err) {
    console.warn(err);
    throw new OpenError('decode', 'This metafile uses drawing commands the viewer cannot replay yet.');
  }
  // EMF+-only files (GDI+ output) keep their drawing in comment records,
  // with no plain GDI version to fall back on.
  if (isEmf && !svg.querySelector('path, text, image, rect') && hasEmfPlus(data)) {
    throw new OpenError('decode', 'This EMF file was saved by GDI+ (EMF+) without the usual fallback drawing, which the viewer cannot draw yet.');
  }
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // The renderers nest an <svg> per viewport change, sized to the file's own
  // viewport (often 96×96 logical units), which clips everything outside it.
  svg.querySelectorAll('svg').forEach((s) => s.setAttribute('overflow', 'visible'));
  // WMFJS writes open polylines without fill="none", and SVG fills those black.
  svg.querySelectorAll('polyline:not([fill]), line:not([fill])').forEach((e) => e.setAttribute('fill', 'none'));
  ui.output.append(el('div', { class: 'picture' }, svg),
    el('p', { class: 'note' }, `${Math.round(size.w)} × ${Math.round(size.h)} ${isEmf ? 'pixels' : 'units'}`));
  ui.done();

  const svgText = () => new XMLSerializer().serializeToString(svg);
  ui.action('Download PNG', () => toPng(svgText(), w * 2, h * 2), ui.baseName + '.png', 'png');
  ui.action('Download SVG', () => new Blob([svgText()], { type: 'image/svg+xml' }), ui.baseName + '.svg', 'svg');
}

// An EMR_COMMENT whose payload starts with "EMF+".
function hasEmfPlus(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let o = 0; o + 16 <= b.length;) {
    const type = dv.getUint32(o, true), size = dv.getUint32(o + 4, true);
    if (type === 70 && dv.getUint32(o + 12, true) === 0x2b464d45) return true;
    if (size < 8) break;
    o += size;
  }
  return false;
}

// Placeable WMF header: key, hmf, left, top, right, bottom (int16), inch.
// Without one, the size comes from the first SetWindowExt record.
function wmfSize(b) {
  if (u16(b, 0) === 0xcdd7 && u16(b, 2) === 0x9ac6) {
    const w = Math.abs(s16(b, 10) - s16(b, 6));
    const h = Math.abs(s16(b, 12) - s16(b, 8));
    return w && h ? { w, h } : null;
  }
  const headerWords = u16(b, 2);
  let at = headerWords * 2;
  while (at + 6 <= b.length) {
    const sizeWords = u16(b, at) | (u16(b, at + 2) << 16);
    const fn = u16(b, at + 4);
    if (fn === 0x020c) return { w: Math.abs(s16(b, at + 8)), h: Math.abs(s16(b, at + 6)) }; // SetWindowExt(y, x)
    if (!sizeWords || fn === 0) break;
    at += sizeWords * 2;
  }
  return null;
}

// EMR_HEADER: rclBounds (device pixels) at 8.
function emfSize(b) {
  const w = s32(b, 16) - s32(b, 8) + 1;
  const h = s32(b, 20) - s32(b, 12) + 1;
  return w > 1 && h > 1 ? { w, h } : null;
}

function toPng(svgText, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encode failed'))), 'image/png');
    };
    img.onerror = () => reject(new OpenError('decode', 'The picture could not be converted to PNG.'));
    img.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  });
}
