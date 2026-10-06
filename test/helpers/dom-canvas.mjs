// Just enough of the browser for lib/pict.js to run under node --test:
// document.createElement('canvas'), Path2D and ImageData from @napi-rs/canvas.
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';

globalThis.Path2D ??= Path2D;
globalThis.ImageData ??= ImageData;
globalThis.document ??= {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error('only canvas is shimmed');
    const c = createCanvas(1, 1);
    return c;
  }
};
