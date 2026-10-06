// MuPDF (WebAssembly) in a worker: opens XPS/OXPS, renders pages to PNG and
// writes the whole document out as a PDF.
//
// In:  { cmd: 'open', data, magic } | { cmd: 'render', index, width } | { cmd: 'pdf' }
// Out: { ok, ...result } or { ok: false, error }

globalThis.$libmupdf_wasm_Module = { locateFile: () => '/vendor/mupdf/mupdf-wasm.wasm' };
const load = import('mupdf');
let doc = null;

self.onmessage = async ({ data }) => {
  try {
    const mupdf = await load;
    if (data.cmd === 'open') {
      doc = mupdf.Document.openDocument(new Uint8Array(data.data), data.magic);
      const first = doc.loadPage(0).getBounds();
      self.postMessage({ ok: true, pages: doc.countPages(), width: first[2] - first[0], height: first[3] - first[1] });
    } else if (data.cmd === 'render') {
      // Scale each page to the requested pixel width from its own bounds.
      const page = doc.loadPage(data.index);
      const [x0, , x1] = page.getBounds();
      const scale = Math.min(10, data.width / Math.max(1, x1 - x0));
      const pix = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
      const png = pix.asPNG();
      self.postMessage({ ok: true, png: png.buffer, width: pix.getWidth(), height: pix.getHeight() }, [png.buffer]);
      pix.destroy?.();
    } else if (data.cmd === 'pdf') {
      const buffer = new mupdf.Buffer();
      const writer = new mupdf.DocumentWriter(buffer, 'pdf', '');
      for (let i = 0; i < doc.countPages(); i++) {
        const page = doc.loadPage(i);
        const device = writer.beginPage(page.getBounds());
        page.run(device, mupdf.Matrix.identity);
        writer.endPage();
      }
      writer.close();
      const pdf = buffer.asUint8Array().slice();
      self.postMessage({ ok: true, pdf: pdf.buffer }, [pdf.buffer]);
    }
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
