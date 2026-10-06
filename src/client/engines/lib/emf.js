// Enhanced Metafile (EMF) to SVG.
//
// Records are replayed against a GDI device-context model: mapping mode,
// window/viewport origin and extent, world transform, pens, brushes, fonts,
// text alignment and colour, a current position, a path under construction
// and a clip rectangle, with SaveDC/RestoreDC. Every coordinate is mapped to
// device pixels here, so the SVG needs no transforms of its own; the viewBox
// is the header's bounds rectangle.
//
// EMF+ (GDI+) records ride inside comments and are ignored: EMF+ files
// written as "dual" carry the same picture as plain GDI records too.
// Bitmaps (StretchDIBits, BitBlt, StretchBlt) are decoded from their DIB
// headers into PNG data URLs with a canvas.

const STOCK = {
  0x80000000: { kind: 'brush', style: 0, color: '#ffffff' }, // WHITE_BRUSH
  0x80000001: { kind: 'brush', style: 0, color: '#c0c0c0' },
  0x80000002: { kind: 'brush', style: 0, color: '#808080' },
  0x80000003: { kind: 'brush', style: 0, color: '#404040' },
  0x80000004: { kind: 'brush', style: 0, color: '#000000' },
  0x80000005: { kind: 'brush', style: 1 }, // NULL_BRUSH
  0x80000006: { kind: 'pen', style: 0, width: 0, color: '#ffffff' },
  0x80000007: { kind: 'pen', style: 0, width: 0, color: '#000000' },
  0x80000008: { kind: 'pen', style: 5 }, // NULL_PEN
  0x8000000a: { kind: 'font', height: -12, face: 'Courier New', weight: 400 },
  0x8000000b: { kind: 'font', height: -12, face: 'Courier New', weight: 400 },
  0x8000000c: { kind: 'font', height: -12, face: 'Arial', weight: 400 },
  0x8000000d: { kind: 'font', height: -16, face: 'Arial', weight: 700 },
  0x8000000e: { kind: 'font', height: -12, face: 'Arial', weight: 400 },
  0x80000010: { kind: 'font', height: -12, face: 'Courier New', weight: 400 },
  0x80000011: { kind: 'font', height: -12, face: 'Arial', weight: 400 }
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v) => (Math.round(v * 100) / 100).toString();
const colorref = (v) => '#' + [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff].map((c) => c.toString(16).padStart(2, '0')).join('');

export function isEmf(b) {
  return b.length >= 88 && b[0] === 1 && b[1] === 0 && b[2] === 0 && b[3] === 0 && String.fromCharCode(b[40], b[41], b[42], b[43]) === ' EMF';
}

export function emfToSvg(b, { dibToUrl = defaultDibToUrl } = {}) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const i32 = (o) => dv.getInt32(o, true);
  const u32 = (o) => dv.getUint32(o, true);
  const i16 = (o) => dv.getInt16(o, true);
  const f32 = (o) => dv.getFloat32(o, true);

  const bounds = { l: i32(8), t: i32(12), r: i32(16), b: i32(20) };
  const devPx = { x: i32(72), y: i32(76) };
  const devMm = { x: i32(80), y: i32(84) };
  const pxPerMm = { x: devPx.x / (devMm.x || 1), y: devPx.y / (devMm.y || 1) };
  const width = bounds.r - bounds.l + 1, height = bounds.b - bounds.t + 1;
  if (width <= 0 || height <= 0 || width > 100000 || height > 100000) throw new Error('bad EMF bounds');

  const out = [];
  const defs = [];
  let clipId = 0;

  let dc = {
    mapMode: 1, wOrg: [0, 0], wExt: [1, 1], vOrg: [0, 0], vExt: [1, 1],
    xf: [1, 0, 0, 1, 0, 0],
    pen: STOCK[0x80000007], brush: STOCK[0x80000000], font: STOCK[0x8000000e],
    textColor: '#000000', bkColor: '#ffffff', bkMode: 2, textAlign: 0, fillMode: 1,
    cur: [0, 0], clip: null
  };
  const stack = [];
  const objects = [];
  let path = null; // array of subpaths, each an array of commands in device coords

  // Logical -> device. Fixed mapping modes use physical units with y up.
  function pageScale() {
    switch (dc.mapMode) {
      case 1: return [1, 1]; // MM_TEXT
      case 2: return [pxPerMm.x / 10, -pxPerMm.y / 10]; // LOMETRIC 0.1 mm
      case 3: return [pxPerMm.x / 100, -pxPerMm.y / 100]; // HIMETRIC
      case 4: return [pxPerMm.x * 0.254, -pxPerMm.y * 0.254]; // LOENGLISH 0.01 in
      case 5: return [pxPerMm.x * 0.0254, -pxPerMm.y * 0.0254]; // HIENGLISH
      case 6: return [pxPerMm.x * 25.4 / 1440, -pxPerMm.y * 25.4 / 1440]; // TWIPS
      case 7: { // ISOTROPIC: same scale both ways
        const sx = dc.vExt[0] / (dc.wExt[0] || 1), sy = dc.vExt[1] / (dc.wExt[1] || 1);
        const s = Math.min(Math.abs(sx), Math.abs(sy));
        return [s * Math.sign(sx || 1), s * Math.sign(sy || 1)];
      }
      default: return [dc.vExt[0] / (dc.wExt[0] || 1), dc.vExt[1] / (dc.wExt[1] || 1)]; // ANISOTROPIC
    }
  }
  function pt(x, y) {
    const [a, bb, c, d, e, f] = dc.xf;
    const wx = a * x + c * y + e, wy = bb * x + d * y + f;
    const [sx, sy] = pageScale();
    return [(wx - dc.wOrg[0]) * sx + dc.vOrg[0] - bounds.l, (wy - dc.wOrg[1]) * sy + dc.vOrg[1] - bounds.t];
  }
  // A length (pen width, font height) in device pixels.
  function len(v, axis = 1) {
    const [a, bb, c, d] = dc.xf;
    const [sx, sy] = pageScale();
    const k = axis === 0 ? Math.hypot(a, bb) * Math.abs(sx) : Math.hypot(c, d) * Math.abs(sy);
    return Math.abs(v) * k;
  }

  function strokeAttrs() {
    const p = dc.pen;
    if (!p || p.style === 5) return 'stroke="none"';
    const w = p.width ? Math.max(0.5, len(p.width, 0)) : 1;
    const dash = { 1: [3, 1], 2: [1, 1], 3: [3, 1, 1, 1], 4: [3, 1, 1, 1, 1, 1] }[p.style & 0xf];
    return `stroke="${p.color}" stroke-width="${num(w)}"` + (dash ? ` stroke-dasharray="${dash.map((d) => num(d * Math.max(w, 1))).join(' ')}"` : '') + ' stroke-linejoin="round"';
  }
  function fillAttrs() {
    const br = dc.brush;
    if (!br || br.style === 1) return 'fill="none"';
    const rule = dc.fillMode === 1 ? 'evenodd' : 'nonzero';
    // Hatched and pattern brushes: their colour at half strength.
    const op = br.style === 2 || br.style === 3 || br.style === 5 ? ' fill-opacity="0.5"' : '';
    return `fill="${br.color || '#808080'}" fill-rule="${rule}"${op}`;
  }
  const clipAttr = () => (dc.clip ? ` clip-path="url(#c${dc.clip})"` : '');
  const emit = (s) => out.push(s);

  function shape(d, fill = true, stroke = true) {
    emit(`<path d="${d}" ${fill ? fillAttrs() : 'fill="none"'} ${stroke ? strokeAttrs() : 'stroke="none"'}${clipAttr()}/>`);
  }
  const ptsPath = (points, close) => points.map((p, k) => `${k ? 'L' : 'M'}${num(p[0])} ${num(p[1])}`).join('') + (close ? 'Z' : '');

  function readPoints(o, count, small) {
    const pts = [];
    for (let k = 0; k < count; k++) pts.push(small ? pt(i16(o + k * 4), i16(o + k * 4 + 2)) : pt(i32(o + k * 8), i32(o + k * 8 + 4)));
    return pts;
  }
  function bezierPath(start, pts) {
    let d = `M${num(start[0])} ${num(start[1])}`;
    for (let k = 0; k + 2 < pts.length; k += 3) d += `C${pts.slice(k, k + 3).map((p) => num(p[0]) + ' ' + num(p[1])).join(' ')}`;
    return d;
  }
  // Open path construction (BeginPath..EndPath) or immediate drawing.
  function addToPath(d) {
    if (path) path.push(d);
    return !!path;
  }

  function ellipseD(l, t, r, bt) {
    const [x0, y0] = pt(l, t), [x1, y1] = pt(r, bt);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    return `M${num(cx - rx)} ${num(cy)}A${num(rx)} ${num(ry)} 0 1 0 ${num(cx + rx)} ${num(cy)}A${num(rx)} ${num(ry)} 0 1 0 ${num(cx - rx)} ${num(cy)}Z`;
  }
  function arcD(o, kind) {
    const [x0, y0] = pt(i32(o), i32(o + 4)), [x1, y1] = pt(i32(o + 8), i32(o + 12));
    const [sx, sy] = pt(i32(o + 16), i32(o + 20)), [ex, ey] = pt(i32(o + 24), i32(o + 28));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
    if (!rx || !ry) return '';
    const a0 = Math.atan2((sy - cy) / ry, (sx - cx) / rx), a1 = Math.atan2((ey - cy) / ry, (ex - cx) / rx);
    const p0 = [cx + rx * Math.cos(a0), cy + ry * Math.sin(a0)], p1 = [cx + rx * Math.cos(a1), cy + ry * Math.sin(a1)];
    // GDI draws arcs counter-clockwise (in y-down device space that is
    // decreasing angle).
    let sweep = a0 - a1;
    if (sweep <= 0) sweep += Math.PI * 2;
    const large = sweep > Math.PI ? 1 : 0;
    let d = `M${num(p0[0])} ${num(p0[1])}A${num(rx)} ${num(ry)} 0 ${large} 0 ${num(p1[0])} ${num(p1[1])}`;
    if (kind === 'chord') d += 'Z';
    if (kind === 'pie') d += `L${num(cx)} ${num(cy)}Z`;
    return d;
  }

  function text(o, wide) {
    // Parameters: bounds (16), iGraphicsMode, exScale, eyScale, then EMRTEXT.
    const t = o + 28;
    let rx = i32(t), ry = i32(t + 4);
    const n = u32(t + 8), offStr = u32(t + 12), options = u32(t + 16), offDx = u32(t + 36);
    if (!n || n > 100000) return;
    let s = '';
    for (let k = 0; k < n; k++) s += wide ? String.fromCharCode(dv.getUint16(o - 8 + offStr + k * 2, true)) : String.fromCharCode(b[o - 8 + offStr + k]);
    // Keep only characters XML allows (no controls, lone surrogates, U+FFFE/F).
    s = s.replace(/[\u0000-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, ' ');
    if (dc.textAlign & 1) { rx = dc.cur[0]; ry = dc.cur[1]; } // TA_UPDATECP
    const f = dc.font || STOCK[0x8000000e];
    const size = Math.max(1, len(f.height || 12, 1) * (f.height < 0 ? 1 : 0.8));
    const [x, y] = pt(rx, ry);
    // Per-character advances give exact positions, as GDI laid them out.
    let xs = null;
    if (offDx && offDx + n * 4 <= u32(o - 4)) {
      xs = [];
      let acc = 0;
      for (let k = 0; k < n; k++) {
        const p = pt(rx + acc, ry);
        xs.push(num(p[0]));
        acc += i32(o - 8 + offDx + k * 4 * (options & 0x2000 ? 2 : 1));
      }
    }
    const h = dc.textAlign & 6; // 0 left, 2 right, 6 centre
    const anchor = h === 6 ? 'middle' : h === 2 ? 'end' : 'start';
    const v = dc.textAlign & 24; // 0 top, 8 bottom, 24 baseline
    const baseline = v === 24 ? 'alphabetic' : v === 8 ? 'text-after-edge' : 'text-before-edge';
    const angle = -(f.escapement || 0) / 10;
    const attrs = [
      `x="${xs && anchor === 'start' ? xs.join(' ') : num(x)}"`, `y="${num(y)}"`,
      `font-family="${esc(f.face || 'Arial')}, Arial, sans-serif"`, `font-size="${num(size)}"`,
      f.weight >= 600 ? 'font-weight="bold"' : '', f.italic ? 'font-style="italic"' : '',
      f.underline || f.strike ? `text-decoration="${f.underline ? 'underline' : ''} ${f.strike ? 'line-through' : ''}"` : '',
      `fill="${dc.textColor}"`, `text-anchor="${anchor}"`, `dominant-baseline="${baseline}"`,
      angle ? `transform="rotate(${num(angle)} ${num(x)} ${num(y)})"` : '', 'xml:space="preserve"'
    ].filter(Boolean).join(' ');
    // Opaque text paints its background box first.
    if (options & 2 || dc.bkMode === 2) {
      const r = { l: i32(t + 20), tt: i32(t + 24), r: i32(t + 28), bt: i32(t + 32) };
      if (options & 2 && r.r > r.l) {
        const [ax, ay] = pt(r.l, r.tt), [bx, by] = pt(r.r, r.bt);
        emit(`<rect x="${num(Math.min(ax, bx))}" y="${num(Math.min(ay, by))}" width="${num(Math.abs(bx - ax))}" height="${num(Math.abs(by - ay))}" fill="${dc.bkColor}"${clipAttr()}/>`);
      }
    }
    emit(`<text ${attrs}${clipAttr()}>${esc(s)}</text>`);
  }

  function bitmap(o, dst, offBmi, cbBmi, offBits, cbBits) {
    if (!cbBmi) return;
    const url = dibToUrl(b.subarray(o - 8 + offBmi, o - 8 + offBmi + cbBmi), b.subarray(o - 8 + offBits, o - 8 + offBits + cbBits));
    if (!url) return;
    const [x0, y0] = pt(dst.x, dst.y), [x1, y1] = pt(dst.x + dst.w, dst.y + dst.h);
    emit(`<image x="${num(Math.min(x0, x1))}" y="${num(Math.min(y0, y1))}" width="${num(Math.abs(x1 - x0))}" height="${num(Math.abs(y1 - y0))}" preserveAspectRatio="none" href="${url}"${clipAttr()}/>`);
  }
  function patBlt(dst, rop) {
    const [x0, y0] = pt(dst.x, dst.y), [x1, y1] = pt(dst.x + dst.w, dst.y + dst.h);
    const fill = rop === 0x00000042 ? '#000000' : rop === 0x00ff0062 ? '#ffffff' : dc.brush && dc.brush.style !== 1 ? dc.brush.color : null;
    if (!fill) return;
    emit(`<rect x="${num(Math.min(x0, x1))}" y="${num(Math.min(y0, y1))}" width="${num(Math.abs(x1 - x0))}" height="${num(Math.abs(y1 - y0))}" fill="${fill}"${clipAttr()}/>`);
  }

  function setClipRect(l, t, r, bt) {
    const [x0, y0] = pt(l, t), [x1, y1] = pt(r, bt);
    defs.push(`<clipPath id="c${++clipId}"><rect x="${num(Math.min(x0, x1))}" y="${num(Math.min(y0, y1))}" width="${num(Math.abs(x1 - x0))}" height="${num(Math.abs(y1 - y0))}"/></clipPath>`);
    dc.clip = clipId;
  }

  let o = 0;
  let guard = 0;
  while (o + 8 <= b.length && guard++ < 1000000) {
    const type = u32(o), size = u32(o + 4);
    if (size < 8 || o + size > b.length) break;
    const p = o + 8; // record parameters
    switch (type) {
      case 1: break; // header
      case 14: o = b.length; continue; // EOF
      case 9: dc.wExt = [i32(p), i32(p + 4)]; break;
      case 10: dc.wOrg = [i32(p), i32(p + 4)]; break;
      case 11: dc.vExt = [i32(p), i32(p + 4)]; break;
      case 12: dc.vOrg = [i32(p), i32(p + 4)]; break;
      case 17: dc.mapMode = u32(p); break;
      case 18: dc.bkMode = u32(p); break;
      case 19: dc.fillMode = u32(p); break;
      case 22: dc.textAlign = u32(p); break;
      case 24: dc.textColor = colorref(u32(p)); break;
      case 25: dc.bkColor = colorref(u32(p)); break;
      case 27: dc.cur = [i32(p), i32(p + 4)]; if (path) path.push(`M${ptStr(dc.cur)}`); break;
      case 54: {
        const to = [i32(p), i32(p + 4)];
        const d = `M${ptStr(dc.cur)}L${ptStr(to)}`;
        if (path) path.push(`L${ptStr(to)}`); else shape(d, false, true);
        dc.cur = to;
        break;
      }
      case 33: stack.push({ ...dc, xf: [...dc.xf] }); break;
      case 34: {
        const rel = i32(p);
        const idx = rel < 0 ? stack.length + rel : rel - 1;
        if (idx >= 0 && idx < stack.length) { dc = stack[idx]; stack.length = idx; }
        break;
      }
      case 35: dc.xf = [f32(p), f32(p + 4), f32(p + 8), f32(p + 12), f32(p + 16), f32(p + 20)]; break;
      case 36: {
        const m = [f32(p), f32(p + 4), f32(p + 8), f32(p + 12), f32(p + 16), f32(p + 20)];
        const mode = u32(p + 24);
        if (mode === 1) dc.xf = [1, 0, 0, 1, 0, 0];
        else if (mode === 2) dc.xf = mul(m, dc.xf);
        else if (mode === 3) dc.xf = mul(dc.xf, m);
        else if (mode === 4) dc.xf = m;
        break;
      }
      case 37: {
        const h = u32(p);
        const obj = h & 0x80000000 ? STOCK[h] : objects[h];
        if (obj) dc[obj.kind] = obj;
        break;
      }
      case 38: objects[u32(p)] = { kind: 'pen', style: u32(p + 4), width: i32(p + 8), color: colorref(u32(p + 16)) }; break;
      case 95: objects[u32(p)] = { kind: 'pen', style: u32(p + 20) & 0xff, width: u32(p + 24), color: colorref(u32(p + 32)) }; break;
      case 39: objects[u32(p)] = { kind: 'brush', style: u32(p + 4), color: colorref(u32(p + 8)) }; break;
      case 93: case 94: objects[u32(p)] = { kind: 'brush', style: 5, color: '#808080' }; break; // DIB / mono pattern brush
      case 82: {
        let face = '';
        for (let k = 0; k < 32; k++) { const c = dv.getUint16(p + 32 + k * 2, true); if (!c) break; face += String.fromCharCode(c); }
        objects[u32(p)] = { kind: 'font', height: i32(p + 4), escapement: i32(p + 12), weight: i32(p + 20), italic: b[p + 24], underline: b[p + 25], strike: b[p + 26], face };
        break;
      }
      case 40: objects[u32(p)] = undefined; break;
      case 3: case 86: case 4: case 87: { // polygon, polyline (32/16-bit)
        const small = type > 80, count = u32(p + 16);
        const pts = readPoints(p + 20, count, small);
        const close = type === 3 || type === 86;
        if (!addToPath(ptsPath(pts, close))) shape(ptsPath(pts, close), close, true);
        break;
      }
      case 6: case 89: { // polylineTo
        const small = type > 80, count = u32(p + 16);
        const pts = readPoints(p + 20, count, small);
        const d = `M${ptStr(dc.cur)}` + pts.map((q) => `L${num(q[0])} ${num(q[1])}`).join('');
        if (!addToPath(pts.map((q) => `L${num(q[0])} ${num(q[1])}`).join(''))) shape(d, false, true);
        const lastRaw = small ? [i16(p + 20 + (count - 1) * 4), i16(p + 22 + (count - 1) * 4)] : [i32(p + 20 + (count - 1) * 8), i32(p + 24 + (count - 1) * 8)];
        if (count) dc.cur = lastRaw;
        break;
      }
      case 2: case 85: case 5: case 88: { // polyBezier, polyBezierTo
        const small = type > 80, count = u32(p + 16);
        const to = type === 5 || type === 88;
        const pts = readPoints(p + 20, count, small);
        const start = to ? pt(dc.cur[0], dc.cur[1]) : pts.shift();
        const d = bezierPath(start, pts);
        if (path) path.push(to ? d.replace(/^M[^C]*/, '') : d); else shape(d, false, true);
        if (count) dc.cur = small ? [i16(p + 20 + (count - 1) * 4), i16(p + 22 + (count - 1) * 4)] : [i32(p + 20 + (count - 1) * 8), i32(p + 24 + (count - 1) * 8)];
        break;
      }
      case 7: case 8: case 90: case 91: { // polyPolyline, polyPolygon
        const small = type >= 90, polys = u32(p + 16);
        const close = type === 8 || type === 91;
        let q = p + 24 + polys * 4;
        let d = '';
        for (let k = 0; k < polys; k++) {
          const c = u32(p + 24 + k * 4);
          d += ptsPath(readPoints(q, c, small), close);
          q += c * (small ? 4 : 8);
        }
        if (!addToPath(d)) shape(d, close, true);
        break;
      }
      case 43: { // rectangle
        const [x0, y0] = pt(i32(p), i32(p + 4)), [x1, y1] = pt(i32(p + 8), i32(p + 12));
        const d = `M${num(x0)} ${num(y0)}H${num(x1)}V${num(y1)}H${num(x0)}Z`;
        if (!addToPath(d)) shape(d);
        break;
      }
      case 44: { // roundRect
        const [x0, y0] = pt(i32(p), i32(p + 4)), [x1, y1] = pt(i32(p + 8), i32(p + 12));
        const rx = len(i32(p + 16), 0) / 2, ry = len(i32(p + 20), 1) / 2;
        emit(`<rect x="${num(Math.min(x0, x1))}" y="${num(Math.min(y0, y1))}" width="${num(Math.abs(x1 - x0))}" height="${num(Math.abs(y1 - y0))}" rx="${num(rx)}" ry="${num(ry)}" ${fillAttrs()} ${strokeAttrs()}${clipAttr()}/>`);
        break;
      }
      case 42: { const d = ellipseD(i32(p), i32(p + 4), i32(p + 8), i32(p + 12)); if (!addToPath(d)) shape(d); break; }
      case 45: { const d = arcD(p, 'arc'); if (d && !addToPath(d)) shape(d, false, true); break; }
      case 55: { const d = arcD(p, 'arc'); if (d && !addToPath(d)) shape(d, false, true); break; } // arcTo (approx.)
      case 46: { const d = arcD(p, 'chord'); if (d && !addToPath(d)) shape(d); break; }
      case 47: { const d = arcD(p, 'pie'); if (d && !addToPath(d)) shape(d); break; }
      case 59: path = []; break; // beginPath
      case 60: break; // endPath: path stays until used
      case 61: if (path) path.push('Z'); break;
      case 62: if (path) { shape(path.join(''), true, false); path = null; } break;
      case 63: if (path) { shape(path.join(''), true, true); path = null; } break;
      case 64: if (path) { shape(path.join(''), false, true); path = null; } break;
      case 67: path = null; break; // selectClipPath: clip not modelled
      case 68: path = null; break; // abortPath
      case 30: setClipRect(i32(p), i32(p + 4), i32(p + 8), i32(p + 12)); break; // intersectClipRect
      case 75: { // extSelectClipRgn: RGN_COPY with no data resets
        const cb = u32(p), mode = u32(p + 4);
        if (mode === 5 && cb === 0) dc.clip = null;
        else if (cb >= 32) {
          // Region bounds (device units) as the clip rectangle.
          const r0 = p + 8 + 16;
          const l = i32(r0), t = i32(r0 + 4), r = i32(r0 + 8), bt = i32(r0 + 12);
          defs.push(`<clipPath id="c${++clipId}"><rect x="${num(l - bounds.l)}" y="${num(t - bounds.t)}" width="${num(r - l)}" height="${num(bt - t)}"/></clipPath>`);
          dc.clip = clipId;
        }
        break;
      }
      case 84: text(p, true); break;
      case 83: text(p, false); break;
      case 81: { // stretchDIBits
        const dst = { x: i32(p + 16), y: i32(p + 20), w: i32(p + 64), h: i32(p + 68) };
        bitmap(p, dst, u32(p + 40), u32(p + 44), u32(p + 48), u32(p + 52));
        break;
      }
      case 76: case 77: { // bitBlt, stretchBlt
        const dst = { x: i32(p + 16), y: i32(p + 20), w: i32(p + 24), h: i32(p + 28) };
        const rop = u32(p + 32);
        const cbBmi = u32(p + 80);
        if (!cbBmi) patBlt(dst, rop);
        else bitmap(p, dst, u32(p + 76), cbBmi, u32(p + 84), u32(p + 88));
        break;
      }
      default: break;
    }
    o += size;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') + out.join('') + '</svg>';

  function ptStr(q) { const [x, y] = pt(q[0], q[1]); return `${num(x)} ${num(y)}`; }
}

function mul(m, n) {
  // m then n (row-vector convention used by GDI XFORMs)
  return [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]
  ];
}

// DIB (BITMAPINFOHEADER + palette, then bits) -> PNG data URL via canvas.
export function defaultDibToUrl(bmi, bits) {
  if (typeof document === 'undefined' || bmi.length < 40) return null;
  const dv = new DataView(bmi.buffer, bmi.byteOffset, bmi.byteLength);
  const hsize = dv.getUint32(0, true);
  const w = dv.getInt32(4, true), hRaw = dv.getInt32(8, true);
  const bpp = dv.getUint16(14, true), compression = dv.getUint32(16, true);
  const h = Math.abs(hRaw), topDown = hRaw < 0;
  if (!w || !h || w > 10000 || h > 10000) return null;
  // JPEG/PNG passthrough (BI_JPEG 4, BI_PNG 5).
  if (compression === 4 || compression === 5) {
    let s = '';
    for (let i = 0; i < bits.length; i++) s += String.fromCharCode(bits[i]);
    return `data:image/${compression === 4 ? 'jpeg' : 'png'};base64,${btoa(s)}`;
  }
  if (compression !== 0 && compression !== 3) return null;
  const used = dv.getUint32(32, true) || (bpp <= 8 ? 1 << bpp : 0);
  const pal = [];
  for (let i = 0; i < used && hsize + i * 4 + 3 < bmi.length; i++) {
    const q = hsize + i * 4;
    pal.push([bmi[q + 2], bmi[q + 1], bmi[q]]);
  }
  const stride = Math.ceil((w * bpp) / 32) * 4;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const row = (topDown ? y : h - 1 - y) * stride;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, bl = 0;
      if (bpp === 24) { const q = row + x * 3; bl = bits[q]; g = bits[q + 1]; r = bits[q + 2]; }
      else if (bpp === 32) { const q = row + x * 4; bl = bits[q]; g = bits[q + 1]; r = bits[q + 2]; }
      else if (bpp === 16) { const v = bits[row + x * 2] | (bits[row + x * 2 + 1] << 8); r = ((v >> 10) & 31) * 8; g = ((v >> 5) & 31) * 8; bl = (v & 31) * 8; }
      else { const bitPos = x * bpp; const idx = (bits[row + (bitPos >> 3)] >> (8 - bpp - (bitPos & 7))) & ((1 << bpp) - 1); [r, g, bl] = pal[idx] || [0, 0, 0]; }
      const k = (y * w + x) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = bl; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
