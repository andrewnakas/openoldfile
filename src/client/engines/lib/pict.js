// Macintosh QuickDraw PICT (version 1 and 2) renderer, onto a 2D canvas.
//
// A PICT file is an optional 512-byte application header, then:
//   picSize (word), picFrame (rect: top, left, bottom, right), then opcodes.
// Version 1 uses 1-byte opcodes; version 2 starts with 0x0011 0x02FF and uses
// 2-byte opcodes aligned to even offsets. Covered: lines, rects, round rects,
// ovals, arcs, polygons, text, pen/fill patterns (as grey levels), RGB and
// classic colours, and all four bitmap opcodes (BitsRect, PackBitsRect,
// DirectBitsRect and their region variants, regions ignored). Opcodes that
// are not drawn are skipped by their documented length, so unknown content
// degrades instead of failing.

const OLD_COLORS = { 33: '#000', 30: '#fff', 205: '#f00', 341: '#0f0', 409: '#00f', 273: '#0ff', 137: '#f0f', 69: '#ff0' };

export function findPict(b) {
  // With or without the 512-byte header: look for the version opcode.
  for (const base of [512, 0]) {
    if (b.length < base + 12) continue;
    const v1 = b[base + 10] === 0x11 && b[base + 11] === 0x01;
    const v2 = b[base + 10] === 0x00 && b[base + 11] === 0x11 && b[base + 12] === 0x02 && b[base + 13] === 0xff;
    if (v1 || v2) return { base, version: v2 ? 2 : 1 };
  }
  return null;
}

export function renderPict(b, { maxSize = 2000 } = {}) {
  const found = findPict(b);
  if (!found) throw new Error('not a PICT');
  const { base, version } = found;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const s16 = (o) => dv.getInt16(o);
  const u16 = (o) => dv.getUint16(o);
  const u32 = (o) => dv.getUint32(o);
  const rect = (o) => ({ top: s16(o), left: s16(o + 2), bottom: s16(o + 4), right: s16(o + 6) });

  let frame = rect(base + 2);
  let pos = base + 10;

  // Version 2 extended header (0x0C00) can give the real resolution.
  let width = frame.right - frame.left, height = frame.bottom - frame.top;
  if (width <= 0 || height <= 0 || width > 20000 || height > 20000) throw new Error('bad PICT frame');
  const scale = Math.min(4, maxSize / Math.max(width, height), Math.max(1, 800 / Math.max(width, height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-frame.left, -frame.top);
  ctx.lineCap = 'butt';
  ctx.imageSmoothingEnabled = false;

  const st = {
    fg: '#000', bk: '#fff', pen: { x: 1, y: 1 }, penPat: 1, fillPat: 1, bkPat: 0,
    loc: { x: 0, y: 0 }, txSize: 12, txFace: 0, txFont: 0, fontName: '', oval: { x: 0, y: 0 },
    lastRect: null, lastRRect: null, lastOval: null, lastArc: null, lastPoly: null, origin: { x: 0, y: 0 }
  };
  // An 8x8 pattern becomes a grey of the same ink density.
  const patDensity = (o) => {
    let ones = 0;
    for (let i = 0; i < 8; i++) for (let v = b[o + i]; v; v >>= 1) ones += v & 1;
    return ones / 64;
  };
  const mix = (density) => {
    const fg = hexToRgb(st.fg), bk = hexToRgb(st.bk);
    const c = fg.map((f, i) => Math.round(f * density + bk[i] * (1 - density)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };

  const strokeShape = (path) => {
    ctx.save();
    ctx.strokeStyle = mix(st.penPat);
    ctx.lineWidth = Math.max(st.pen.x, st.pen.y);
    ctx.stroke(path);
    ctx.restore();
  };
  const fillShape = (path, density, color) => {
    ctx.save();
    ctx.fillStyle = color || mix(density);
    ctx.fill(path, 'evenodd');
    ctx.restore();
  };
  const shapeOp = (verb, path) => {
    // 0 frame, 1 paint, 2 erase, 3 invert, 4 fill
    if (verb === 0) strokeShape(path);
    else if (verb === 1) fillShape(path, st.penPat);
    else if (verb === 2) fillShape(path, 0, st.bk);
    else if (verb === 3) { ctx.save(); ctx.globalCompositeOperation = 'difference'; fillShape(path, 1, '#fff'); ctx.restore(); }
    else if (verb === 4) fillShape(path, st.fillPat);
  };
  // Frames are stroked inside the rect, like QuickDraw's pen hanging down-right.
  const rectPath = (r, inset) => { const p = new Path2D(); p.rect(r.left + inset, r.top + inset, r.right - r.left - 2 * inset, r.bottom - r.top - 2 * inset); return p; };
  const ovalPath = (r, inset) => {
    const p = new Path2D();
    const rx = (r.right - r.left) / 2 - inset, ry = (r.bottom - r.top) / 2 - inset;
    if (rx > 0 && ry > 0) p.ellipse(r.left + (r.right - r.left) / 2, r.top + (r.bottom - r.top) / 2, rx, ry, 0, 0, Math.PI * 2);
    return p;
  };
  const rrectPath = (r, inset) => {
    const p = new Path2D();
    const w = r.right - r.left - 2 * inset, h = r.bottom - r.top - 2 * inset;
    if (w > 0 && h > 0) p.roundRect(r.left + inset, r.top + inset, w, h, [Math.min(st.oval.x / 2, w / 2), Math.min(st.oval.y / 2, h / 2)].map((v) => Math.max(0, v)));
    return p;
  };
  const arcPath = (r, start, extent, inset, wedge) => {
    const p = new Path2D();
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const rx = (r.right - r.left) / 2 - inset, ry = (r.bottom - r.top) / 2 - inset;
    if (rx <= 0 || ry <= 0) return p;
    // QuickDraw angles: 0 = 12 o'clock, clockwise, in degrees.
    const a0 = ((start - 90) * Math.PI) / 180, a1 = ((start + extent - 90) * Math.PI) / 180;
    if (wedge) p.moveTo(cx, cy);
    p.ellipse(cx, cy, rx, ry, 0, Math.min(a0, a1), Math.max(a0, a1));
    if (wedge) p.closePath();
    return p;
  };
  const polyPath = (o) => {
    const size = u16(o);
    const p = new Path2D();
    const n = (size - 10) / 4;
    for (let i = 0; i < n; i++) {
      const y = s16(o + 10 + i * 4), x = s16(o + 12 + i * 4);
      if (i) p.lineTo(x + 0.5, y + 0.5); else p.moveTo(x + 0.5, y + 0.5);
    }
    return { path: p, size };
  };
  const text = (str) => {
    ctx.save();
    ctx.fillStyle = st.fg;
    const weight = st.txFace & 1 ? 'bold ' : '';
    const italic = st.txFace & 2 ? 'italic ' : '';
    const family = st.fontName || ['Geneva', 'Chicago', 'New York', 'Monaco', 'Venice', 'London', 'Athens', 'San Francisco', 'Toronto', 'Cairo', 'Los Angeles', 'Times', 'Helvetica', 'Courier', 'Symbol'][st.txFont] || 'Geneva';
    ctx.font = `${italic}${weight}${st.txSize || 12}px "${family}", Helvetica, Arial, sans-serif`;
    ctx.fillText(str, st.loc.x, st.loc.y);
    if (st.txFace & 4) ctx.fillRect(st.loc.x, st.loc.y + 1, ctx.measureText(str).width, 1);
    ctx.restore();
  };
  const readText = (o) => {
    const n = b[o];
    let str = '';
    for (let i = 0; i < n; i++) str += MAC_ROMAN[b[o + 1 + i]] || String.fromCharCode(b[o + 1 + i]);
    return { str, len: 1 + n };
  };

  // ---- bitmaps ----
  function unpackBits(o, rowBytes, rows, byteCount16) {
    const out = new Uint8Array(rowBytes * rows);
    for (let r = 0; r < rows; r++) {
      if (rowBytes < 8) {
        out.set(b.subarray(o, o + rowBytes), r * rowBytes);
        o += rowBytes;
        continue;
      }
      const count = byteCount16 ? u16(o) : b[o];
      o += byteCount16 ? 2 : 1;
      const end = o + count;
      let at = r * rowBytes;
      const rowEnd = at + rowBytes;
      while (o < end && at < rowEnd) {
        const n = (b[o] << 24) >> 24;
        o++;
        if (n >= 0) {
          const len = Math.min(n + 1, rowEnd - at);
          out.set(b.subarray(o, o + len), at);
          at += len;
          o += n + 1;
        } else if (n !== -128) {
          out.fill(b[o], at, Math.min(rowEnd, at - n + 1));
          at += -n + 1;
          o++;
        }
      }
      o = end;
    }
    return { data: out, next: o };
  }
  // Direct (16-bit) pixels pack by words.
  function unpackWords(o, rowBytes, rows) {
    const out = new Uint8Array(rowBytes * rows);
    for (let r = 0; r < rows; r++) {
      const count = rowBytes > 250 ? u16(o) : b[o];
      o += rowBytes > 250 ? 2 : 1;
      const end = o + count;
      let at = r * rowBytes;
      const rowEnd = at + rowBytes;
      while (o < end && at < rowEnd) {
        const n = (b[o] << 24) >> 24;
        o++;
        if (n >= 0) {
          const len = Math.min((n + 1) * 2, rowEnd - at);
          out.set(b.subarray(o, o + len), at);
          at += len;
          o += (n + 1) * 2;
        } else {
          for (let k = 0; k < -n + 1 && at + 1 < rowEnd; k++) { out[at++] = b[o]; out[at++] = b[o + 1]; }
          o += 2;
        }
      }
      o = end;
    }
    return { data: out, next: o };
  }

  function bitmapOp(o, packed, direct, hasRgn) {
    if (direct) o += 4; // baseAddr
    let rowBytes = u16(o);
    const isPixMap = direct || (rowBytes & 0x8000) !== 0;
    rowBytes &= 0x3fff;
    const bounds = rect(o + 2);
    o += 10;
    let pixelSize = 1, cmpCount = 1, packType = 0, palette = null;
    if (isPixMap) {
      packType = u16(o + 2);
      pixelSize = u16(o + 18);
      cmpCount = u16(o + 20);
      o += 36;
      if (!direct) {
        const ctSize = u16(o + 6);
        palette = [];
        for (let i = 0; i <= ctSize; i++) {
          const e = o + 8 + i * 8;
          const idx = (u16(o + 4) & 0x8000) ? i : u16(e);
          palette[idx] = [b[e + 2], b[e + 4], b[e + 6]];
        }
        o += 8 + (ctSize + 1) * 8;
      }
    }
    const src = rect(o), dst = rect(o + 8);
    o += 18; // src, dst, mode
    if (hasRgn) o += u16(o);
    const w = bounds.right - bounds.left, h = bounds.bottom - bounds.top;
    if (w <= 0 || h <= 0 || w > 8000 || h > 8000) throw new Error('bad bitmap');

    let rows;
    if (!packed && !direct) {
      rows = { data: b.subarray(o, o + rowBytes * h), next: o + rowBytes * h };
    } else if (direct && pixelSize === 16) {
      rows = packType === 1 || rowBytes < 8 ? { data: b.subarray(o, o + rowBytes * h), next: o + rowBytes * h } : unpackWords(o, rowBytes, h);
    } else if (direct && pixelSize === 32 && packType === 2) {
      // 24-bit pixels stored without the pad byte.
      const bytes = w * 3 * h;
      rows = { data: b.subarray(o, o + bytes), next: o + bytes };
      rowBytes = w * 3;
    } else {
      const unpackedRowBytes = direct && pixelSize === 32 && packType === 4 ? w * cmpCount : rowBytes;
      rows = unpackBits(o, unpackedRowBytes, h, rowBytes > 250);
      if (direct && pixelSize === 32 && packType === 4) rowBytes = unpackedRowBytes;
    }

    const img = new ImageData(w, h);
    const px = img.data;
    const fg = hexToRgb(st.fg), bk = hexToRgb(st.bk);
    for (let y = 0; y < h; y++) {
      const row = y * rowBytes;
      for (let x = 0; x < w; x++) {
        let r, g, bl;
        if (direct && pixelSize === 32 && packType === 4) {
          // Component planes per row: (alpha,) red, green, blue.
          const off = cmpCount === 4 ? w : 0;
          r = rows.data[row + off + x]; g = rows.data[row + off + w + x]; bl = rows.data[row + off + 2 * w + x];
        } else if (direct && pixelSize === 32 && packType === 2) {
          r = rows.data[row + x * 3]; g = rows.data[row + x * 3 + 1]; bl = rows.data[row + x * 3 + 2];
        } else if (direct && pixelSize === 32) {
          r = rows.data[row + x * 4 + 1]; g = rows.data[row + x * 4 + 2]; bl = rows.data[row + x * 4 + 3];
        } else if (direct && pixelSize === 16) {
          const v = (rows.data[row + x * 2] << 8) | rows.data[row + x * 2 + 1];
          r = ((v >> 10) & 31) * 255 / 31; g = ((v >> 5) & 31) * 255 / 31; bl = (v & 31) * 255 / 31;
        } else {
          const bitPos = x * pixelSize;
          const byte = rows.data[row + (bitPos >> 3)];
          const idx = (byte >> (8 - pixelSize - (bitPos & 7))) & ((1 << pixelSize) - 1);
          const c = palette ? palette[idx] || [0, 0, 0] : idx ? fg : bk;
          [r, g, bl] = c;
        }
        const k = (y * w + x) * 4;
        px[k] = r; px[k + 1] = g; px[k + 2] = bl; px[k + 3] = 255;
      }
    }
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, src.left - bounds.left, src.top - bounds.top, src.right - src.left, src.bottom - src.top,
      dst.left, dst.top, dst.right - dst.left, dst.bottom - dst.top);
    return rows.next;
  }

  // ---- opcode loop ----
  let guard = 0;
  while (pos < b.length && guard++ < 200000) {
    let op;
    if (version === 2) {
      if (pos & 1) pos++;
      if (pos + 2 > b.length) break;
      op = u16(pos);
      pos += 2;
    } else {
      op = b[pos++];
    }
    if (op === 0x00ff || op === 0xffff) break;
    try {
      pos = doOp(op, pos);
    } catch (e) {
      break; // keep whatever was drawn
    }
  }
  return canvas;

  function doOp(op, o) {
    if (op >= 0x0030 && op <= 0x0034) { st.lastRect = rect(o); shapeOp(op - 0x30, rectPath(st.lastRect, op === 0x30 ? st.pen.x / 2 : 0)); return o + 8; }
    if (op >= 0x0038 && op <= 0x003c) { if (st.lastRect) shapeOp(op - 0x38, rectPath(st.lastRect, op === 0x38 ? st.pen.x / 2 : 0)); return o; }
    if (op >= 0x0040 && op <= 0x0044) { st.lastRRect = rect(o); shapeOp(op - 0x40, rrectPath(st.lastRRect, op === 0x40 ? st.pen.x / 2 : 0)); return o + 8; }
    if (op >= 0x0048 && op <= 0x004c) { if (st.lastRRect) shapeOp(op - 0x48, rrectPath(st.lastRRect, 0)); return o; }
    if (op >= 0x0050 && op <= 0x0054) { st.lastOval = rect(o); shapeOp(op - 0x50, ovalPath(st.lastOval, op === 0x50 ? st.pen.x / 2 : 0)); return o + 8; }
    if (op >= 0x0058 && op <= 0x005c) { if (st.lastOval) shapeOp(op - 0x58, ovalPath(st.lastOval, 0)); return o; }
    if (op >= 0x0060 && op <= 0x0064) {
      st.lastArc = rect(o);
      const verb = op - 0x60;
      shapeOp(verb, arcPath(st.lastArc, s16(o + 8), s16(o + 10), verb === 0 ? st.pen.x / 2 : 0, verb !== 0));
      return o + 12;
    }
    if (op >= 0x0068 && op <= 0x006c) { const verb = op - 0x68; if (st.lastArc) shapeOp(verb, arcPath(st.lastArc, s16(o), s16(o + 2), 0, verb !== 0)); return o + 4; }
    if (op >= 0x0070 && op <= 0x0074) {
      const { path, size } = polyPath(o);
      st.lastPoly = path;
      shapeOp(op - 0x70, path);
      return o + size;
    }
    if (op >= 0x0078 && op <= 0x007c) { if (st.lastPoly) shapeOp(op - 0x78, st.lastPoly); return o; }
    if (op >= 0x0080 && op <= 0x0084) return o + u16(o); // regions: skipped
    if (op >= 0x0088 && op <= 0x008c) return o;
    switch (op) {
      case 0x0000: return o;
      case 0x0001: return o + u16(o); // clip region
      case 0x0002: st.bkPat = patDensity(o); return o + 8;
      case 0x0003: st.txFont = u16(o); return o + 2;
      case 0x0004: st.txFace = b[o]; return o + 1;
      case 0x0005: return o + 2;
      case 0x0006: return o + 4;
      case 0x0007: st.pen = { y: s16(o), x: s16(o + 2) }; return o + 4;
      case 0x0008: return o + 2;
      case 0x0009: st.penPat = patDensity(o); return o + 8;
      case 0x000a: st.fillPat = patDensity(o); return o + 8;
      case 0x000b: st.oval = { y: s16(o), x: s16(o + 2) }; return o + 4;
      case 0x000c: return o + 4;
      case 0x000d: st.txSize = u16(o); return o + 2;
      case 0x000e: st.fg = OLD_COLORS[u32(o)] || st.fg; return o + 4;
      case 0x000f: st.bk = OLD_COLORS[u32(o)] || st.bk; return o + 4;
      case 0x0010: return o + 8;
      case 0x0011: return version === 2 ? o + 2 : o + 1;
      case 0x0012: case 0x0013: case 0x0014: return pixPat(o);
      case 0x0015: case 0x0016: return o + 2;
      case 0x0017: case 0x0018: case 0x0019: return o;
      case 0x001a: st.fg = rgb(o); return o + 6;
      case 0x001b: st.bk = rgb(o); return o + 6;
      case 0x001c: return o;
      case 0x001d: case 0x001f: return o + 6;
      case 0x001e: return o;
      case 0x0020: {
        const y0 = s16(o), x0 = s16(o + 2), y1 = s16(o + 4), x1 = s16(o + 6);
        line(x0, y0, x1, y1);
        return o + 8;
      }
      case 0x0021: { const y1 = s16(o), x1 = s16(o + 2); line(st.loc.x, st.loc.y, x1, y1); return o + 4; }
      case 0x0022: { const y0 = s16(o), x0 = s16(o + 2); const dh = (b[o + 4] << 24) >> 24, dvv = (b[o + 5] << 24) >> 24; line(x0, y0, x0 + dh, y0 + dvv); return o + 6; }
      case 0x0023: { const dh = (b[o] << 24) >> 24, dvv = (b[o + 1] << 24) >> 24; line(st.loc.x, st.loc.y, st.loc.x + dh, st.loc.y + dvv); return o + 2; }
      case 0x0028: { st.loc = { y: s16(o), x: s16(o + 2) }; const t = readText(o + 4); text(t.str); return o + 4 + t.len; }
      case 0x0029: { st.loc.x += b[o]; const t = readText(o + 1); text(t.str); return o + 1 + t.len; }
      case 0x002a: { st.loc.y += b[o]; const t = readText(o + 1); text(t.str); return o + 1 + t.len; }
      case 0x002b: { st.loc.x += b[o]; st.loc.y += b[o + 1]; const t = readText(o + 2); text(t.str); return o + 2 + t.len; }
      case 0x002c: { const len = u16(o); const n = b[o + 4]; st.fontName = String.fromCharCode(...b.subarray(o + 5, o + 5 + n)); return o + 2 + len; }
      case 0x002d: case 0x002e: return o + 2 + u16(o);
      case 0x0090: return bitmapOp(o, false, false, false);
      case 0x0091: return bitmapOp(o, false, false, true);
      case 0x0098: return bitmapOp(o, true, false, false);
      case 0x0099: return bitmapOp(o, true, false, true);
      case 0x009a: return bitmapOp(o, true, true, false);
      case 0x009b: return bitmapOp(o, true, true, true);
      case 0x00a0: return o + 2;
      case 0x00a1: return o + 4 + u16(o + 2);
      case 0x0c00: return o + 24;
      default:
        // Reserved opcodes, skipped by the lengths Inside Macintosh gives.
        if (op <= 0x002f || (op >= 0x0092 && op <= 0x0097) || (op >= 0x009c && op <= 0x009f) || (op >= 0x00a2 && op <= 0x00af)) return o + 2 + u16(o);
        if ((op >= 0x0035 && op <= 0x0037) || (op >= 0x0045 && op <= 0x0047) || (op >= 0x0055 && op <= 0x0057)) return o + 8;
        if ((op >= 0x003d && op <= 0x003f) || (op >= 0x004d && op <= 0x004f) || (op >= 0x005d && op <= 0x005f) || (op >= 0x007d && op <= 0x007f) || (op >= 0x008d && op <= 0x008f)) return o;
        if (op >= 0x0065 && op <= 0x0067) return o + 12;
        if (op >= 0x006d && op <= 0x006f) return o + 4;
        if ((op >= 0x0075 && op <= 0x0077) || (op >= 0x0085 && op <= 0x0087)) return o + u16(o);
        if (op >= 0x00b0 && op <= 0x00cf) return o;
        if ((op >= 0x00d0 && op <= 0x00fe) || op >= 0x8100) return o + 4 + u32(o);
        if (op >= 0x0100 && op <= 0x7fff) return o + (op >> 8) * 2;
        if (op >= 0x8000 && op <= 0x80ff) return o;
        throw new Error('opcode ' + op.toString(16));
    }
  }

  function line(x0, y0, x1, y1) {
    ctx.save();
    ctx.strokeStyle = mix(st.penPat);
    ctx.lineWidth = Math.max(1, st.pen.x, st.pen.y);
    ctx.beginPath();
    const off = ctx.lineWidth / 2;
    ctx.moveTo(x0 + off, y0 + off);
    ctx.lineTo(x1 + off, y1 + off);
    ctx.stroke();
    ctx.restore();
    st.loc = { x: x1, y: y1 };
  }
  function rgb(o) { return `rgb(${b[o]},${b[o + 2]},${b[o + 4]})`; }
  // PixPat: type 1 has a pixmap after the classic pattern; skip it whole by
  // decoding as a bitmap into nowhere, approximated by the 8x8 density.
  function pixPat(o) {
    const type = u16(o);
    const density = patDensity(o + 2);
    if (type === 2) return o + 10 + 6;
    // type 1: pixMap + colour table + pixel data
    let q = o + 10;
    const rowBytes = u16(q) & 0x3fff;
    const bounds = rect(q + 2);
    q += 10 + 36;
    const ctSize = u16(q + 6);
    q += 8 + (ctSize + 1) * 8;
    const h = bounds.bottom - bounds.top;
    if (rowBytes < 8) q += rowBytes * h;
    else q = unpackBits(q, rowBytes, h, rowBytes > 250).next;
    void density;
    return q;
  }
}

function hexToRgb(c) {
  if (c.startsWith('rgb')) return c.match(/\d+/g).map(Number);
  const h = c.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

const MAC_ROMAN = (() => {
  const hi = 'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';
  const t = {};
  for (let i = 0; i < 128; i++) t[0x80 + i] = hi[i];
  return t;
})();
