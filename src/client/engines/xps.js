// XPS and OpenXPS documents, rendered by MuPDF in a worker. Pages are drawn
// as images as they scroll into view; the whole document converts to PDF.

import { OpenError, el, bytes } from '../ui-kit.js';

function call(worker, msg, transfer = []) {
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => (data.ok ? resolve(data) : reject(new OpenError('decode', 'This document could not be read: ' + data.error)));
    worker.onerror = () => reject(new OpenError('codec_load', 'The document renderer failed to load. Reload the page and try again.'));
    worker.postMessage(msg, transfer);
  });
}

export async function open(file, ui) {
  const worker = new Worker('/js/workers/xps-worker.js', { type: 'module' });
  ui.progress('Loading the XPS renderer…');
  const data = (await bytes(file)).buffer;
  const magic = ui.ext === 'oxps' ? 'application/oxps' : 'application/vnd.ms-xpsdocument';
  const info = await call(worker, { cmd: 'open', data, magic }, [data]);

  // Render pages one at a time (the worker handles one message at a time).
  let queue = Promise.resolve();
  const width = Math.round(Math.min(window.innerWidth, 900) * Math.min(devicePixelRatio || 1, 2));
  const pages = Array.from({ length: info.pages }, (_, i) => {
    const holder = el('div', { class: 'xps-page', style: `aspect-ratio:${info.width}/${info.height}` },
      el('span', { class: 'page-num' }, `Page ${i + 1}`));
    holder.render = () => {
      if (holder.started) return;
      holder.started = true;
      queue = queue.then(async () => {
        const r = await call(worker, { cmd: 'render', index: i, width });
        const img = el('img', { alt: `Page ${i + 1}`, width: r.width, height: r.height, src: URL.createObjectURL(new Blob([r.png], { type: 'image/png' })) });
        holder.style.aspectRatio = `${r.width}/${r.height}`;
        holder.prepend(img);
      }).catch((err) => console.error(err));
    };
    return holder;
  });
  const io = new IntersectionObserver((list) => list.forEach((e) => e.isIntersecting && e.target.render()), { rootMargin: '600px' });
  pages.forEach((p) => io.observe(p));
  ui.output.append(el('p', { class: 'summary' }, `${info.pages} page${info.pages === 1 ? '' : 's'}`), el('div', { class: 'xps-pages' }, pages));
  pages[0].render();
  await queue;
  ui.done();

  ui.action('Download PDF', async () => {
    const r = await (queue = queue.then(() => call(worker, { cmd: 'pdf' })));
    return new Blob([r.pdf], { type: 'application/pdf' });
  }, ui.baseName + '.pdf', 'pdf');
}
