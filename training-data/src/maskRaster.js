// What MaskLayer.vue draws for a mask, as plain data, so it can be made in a worker (maskWorker.js) or on the page
// (ADM-1344, contract C8). Pure functions over a mask {size: [h, w], counts}.
//
//   tileOf(mask, rgba)  -> {box: [x, y, w, h], width, height, pixels: Uint32Array} | null (an empty mask)
//                          The mask's box, each mask pixel = rgba (a packed Uint32, see packRgb), every other pixel 0.
//                          The tile is TRANSPOSED (width = the box's height: one tile row per photo column) so each run
//                          of the column-major RLE is one contiguous fill; it is drawn back with
//                          setTransform(0, 1, 1, 0, box x, box y).
//   edgePathOf(mask)    -> SVG path data along the pixel edges of every outline and hole ('' for an empty mask).
//   packRgb([r, g, b])  -> the opaque pixel as a Uint32 in this platform's byte order.
//   rgbOf(css)          -> [r, g, b] for '#rgb', '#rrggbb', 'rgb(...)'; null for anything else.
import { bbox, decode, stringToRuns } from './rle.js';
import { traceRings } from './maskShapes.js';

const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
export function packRgb([r, g, b]) { return LITTLE ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0; }

export function rgbOf(colour) {
  const text = String(colour || '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(text);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(text);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(text);
  if (m) return [+m[1], +m[2], +m[3]].map(v => Math.max(0, Math.min(255, v)));
  return null;
}

export function tileOf(mask, rgba) {
  const box = bbox(mask), runs = stringToRuns(mask.counts), h = mask.size[0];
  if (!box[2] || !box[3]) return null;
  const [bx, by, bw, bh] = box;
  const pixels = new Uint32Array(bw * bh);
  let at = 0;
  for (let r = 0; r < runs.length; r++) {
    const n = runs[r];
    if (r & 1) {
      let x = Math.floor(at / h), y = at - x * h, left = n;
      while (left > 0) {
        const step = Math.min(left, h - y), start = (x - bx) * bh + (y - by);
        pixels.fill(rgba, start, start + step);
        left -= step; y = 0; x++;
      }
    }
    at += n;
  }
  return { box, width: bh, height: bw, pixels };
}

export function edgePathOf(mask) {
  const [h, w] = mask.size;
  return traceRings(decode(mask), w, h).map(({ ring }) => `M${ring.map(p => `${p[0]} ${p[1]}`).join('L')}Z`).join('');
}
