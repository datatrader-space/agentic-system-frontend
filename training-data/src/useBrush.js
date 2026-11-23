import { ref, shallowRef } from 'vue';
import { decode, encode } from './rle.js';

// Brush and Eraser for mask shapes (ADM-1344, LABEL_EDITOR_TOOLS_PLAN.md 2.1 and C1 / C2). Everything is in the
// photo's own pixels; the editor's 600 x 300 stage is converted with stageToPhoto before calling.
//
//   const brush = useBrush({ photo: () => ({ width, height }) });
//
// What the editor calls:
//   brush.begin(point, { shape, kind, id? })  on pointerdown. point = [x, y] in photo pixels. shape = the selected
//                                             mask shape {id, kind, mask: {size, counts}} or null; with no shape the
//                                             brush starts a new mask of class `kind` (id given, or one is made).
//                                             Returns true when a stroke started; false when it cannot (no class,
//                                             nothing to erase, a mask of another size) and brush.message says why.
//   brush.move(point)                         on pointermove while a stroke is on. The segment from the last point is
//                                             painted as a capsule, so a fast stroke has no gaps.
//   brush.end()                               on pointerup / pointercancel. Returns the stroke's result
//                                             {id, kind, mask, before}: mask = the new {size, counts}, or null when
//                                             the eraser removed every pixel (the editor removes the shape); before =
//                                             the mask before the stroke (null for a new mask). Returns null when no
//                                             pixel changed (no undo step is kept then).
//   brush.cancel()                            drops the stroke in progress (Esc); nothing changes.
//   brush.undo() / brush.redo()               one step per stroke: return {id, kind, mask} to put back (mask null =
//                                             the shape does not exist at that step), or null when there is none.
//   brush.keydown(event)                      [ and ] make the brush smaller / larger, E switches the eraser on / off.
//                                             Returns true when it used the key (the editor then stops it).
//   brush.reset()                             a new photo: drops the stroke and the history.
//
// What the editor reads:
//   brush.size (ref, diameter in photo pixels), brush.erasing (ref), brush.active (ref, a stroke is on),
//   brush.message (ref, words for the hint line), brush.canUndo() / brush.canRedo(),
//   brush.live (ref): during a stroke {id, kind, data, width, height, version, box, dirty} — the mask being painted
//   (data: a row-major Uint8Array; box: [x0, y0, x1, y1] the stroke has changed so far; dirty: what the last move
//   changed), for MaskLayer's `live` prop so the stroke is seen at once without encoding; null otherwise.
//   cursorEllipse(point, photo) gives the brush circle in stage units for the SVG (BrushCursor.vue draws it).

export const MIN_BRUSH = 1;
export const MAX_BRUSH = 500;
const HISTORY = 100;

export function stageToPhoto(point, width, height) { return [point[0] * width / 600, point[1] * height / 300]; }

// The brush circle (centre and radius in photo pixels) in the editor's stage units (600 x 300, stretched): an ellipse
// there is a circle on the screen.
export function cursorEllipse(point, size, width, height) {
  const r = size / 2;
  return { cx: point[0] * 600 / width, cy: point[1] * 300 / height, rx: r * 600 / width, ry: r * 300 / height };
}

// The next brush size for [ (down) and ] (up): steps of about a fifth, at least one pixel.
export function nextSize(size, up, max = MAX_BRUSH) {
  const step = Math.max(1, Math.round(size * 0.2));
  return Math.max(MIN_BRUSH, Math.min(max, up ? size + step : size - step));
}

// Paint (value 1) or erase (value 0) the capsule of radius r around the segment a-b into data (width x height).
// A pixel is inside when its centre is within r of the segment. Returns the box changed, or null.
export function paintSegment(data, width, height, a, b, r, value) {
  const top = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r - 0.5)), bottom = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1]) + r));
  const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
  const ux = length ? dx / length : 0, uy = length ? dy / length : 0;
  let changed = null;
  for (let y = top; y <= bottom; y++) {
    const cy = y + 0.5;
    let lo = Infinity, hi = -Infinity;
    for (const c of [a, b]) {                         // the two round ends
      const gap = cy - c[1];
      if (Math.abs(gap) <= r) { const half = Math.sqrt(r * r - gap * gap); lo = Math.min(lo, c[0] - half); hi = Math.max(hi, c[0] + half); }
    }
    if (length) {                                     // the band along the segment: 0 <= along <= length, |across| <= r
      let from = -Infinity, to = Infinity;
      const limit = (k, base, min, max) => {          // k * x + base within [min, max]
        if (!k) { if (base < min || base > max) { from = Infinity; to = -Infinity; } return; }
        const p = (min - base) / k, q = (max - base) / k;
        from = Math.max(from, Math.min(p, q)); to = Math.min(to, Math.max(p, q));
      };
      limit(ux, -a[0] * ux + (cy - a[1]) * uy, 0, length);
      limit(uy, -a[0] * uy - (cy - a[1]) * ux, -r, r);
      if (from <= to) { lo = Math.min(lo, from); hi = Math.max(hi, to); }
    }
    if (lo > hi) continue;
    const x0 = Math.max(0, Math.ceil(lo - 0.5)), x1 = Math.min(width - 1, Math.floor(hi - 0.5));
    const row = y * width;
    for (let x = x0; x <= x1; x++) {
      if (data[row + x] === value) continue;
      data[row + x] = value;
      if (!changed) changed = [x, y, x, y];
      else { if (x < changed[0]) changed[0] = x; if (y < changed[1]) changed[1] = y; if (x > changed[2]) changed[2] = x; if (y > changed[3]) changed[3] = y; }
    }
  }
  return changed;
}

function anySet(data) { for (let i = 0; i < data.length; i++) if (data[i]) return true; return false; }

export function useBrush({ photo, size: startSize = 24 } = {}) {
  const size = ref(startSize), erasing = ref(false), active = ref(false), message = ref(''), live = shallowRef(null);
  let stroke = null;                      // {id, kind, before, data, width, height, last, changed, box}
  let past = [], future = [];
  const dims = () => { const p = photo ? photo() : null; return { width: p?.width || 0, height: p?.height || 0 }; };

  function stamp(to) {
    const { data, width, height } = stroke;
    const box = paintSegment(data, width, height, stroke.last, to, Math.max(0.5, size.value / 2), erasing.value ? 0 : 1);
    stroke.last = [...to];
    if (!box) return;
    stroke.changed = true;
    stroke.box = stroke.box ? [Math.min(stroke.box[0], box[0]), Math.min(stroke.box[1], box[1]), Math.max(stroke.box[2], box[2]), Math.max(stroke.box[3], box[3])] : box;
    live.value = { id: stroke.id, kind: stroke.kind, data, width, height, version: (live.value?.version || 0) + 1, box: [...stroke.box], dirty: box };
  }

  function begin(point, { shape = null, kind = '', id = null } = {}) {
    if (active.value) cancel();
    const { width, height } = dims();
    if (!width || !height) { message.value = 'The photo is still loading.'; return false; }
    const mask = shape && shape.mask ? shape.mask : null;
    if (erasing.value && !mask) { message.value = 'Select a mask to erase from.'; return false; }
    if (!mask && !kind) { message.value = 'Choose a class first.'; return false; }
    if (mask && (mask.size?.[0] !== height || mask.size?.[1] !== width)) { message.value = 'This mask is not the size of the photo, so it cannot be painted.'; return false; }
    let data;
    try { data = mask ? decode(mask) : new Uint8Array(width * height); }
    catch (error) { message.value = error.message; return false; }
    stroke = { id: mask ? shape.id : (id || `mask-${Date.now()}`), kind: mask ? shape.kind : kind, before: mask ? { size: [...mask.size], counts: mask.counts } : null,
               data, width, height, last: [...point], changed: false, box: null };
    active.value = true; message.value = '';
    stamp(point);
    return true;
  }

  function move(point) { if (active.value && stroke) stamp(point); }

  function end() {
    if (!active.value || !stroke) return null;
    const done = stroke;
    stroke = null; active.value = false; live.value = null;
    if (!done.changed) return null;
    const mask = anySet(done.data) ? encode(done.data, done.height, done.width) : null;
    if (!mask && !done.before) return null;
    past.push({ id: done.id, kind: done.kind, before: done.before, after: mask });
    if (past.length > HISTORY) past.shift();
    future = [];
    return { id: done.id, kind: done.kind, mask, before: done.before };
  }

  function cancel() { stroke = null; active.value = false; live.value = null; }

  function undo() {
    if (active.value) cancel();
    const step = past.pop();
    if (!step) return null;
    future.push(step);
    return { id: step.id, kind: step.kind, mask: step.before };
  }
  function redo() {
    if (active.value) cancel();
    const step = future.pop();
    if (!step) return null;
    past.push(step);
    return { id: step.id, kind: step.kind, mask: step.after };
  }

  function keydown(event) {
    if (!event || event.ctrlKey || event.metaKey || event.altKey) return false;
    const target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''))) return false;
    const { width, height } = dims();
    const max = Math.max(MIN_BRUSH, Math.min(MAX_BRUSH, Math.max(width, height) || MAX_BRUSH));
    if (event.key === '[' || event.key === ']') { size.value = nextSize(size.value, event.key === ']', max); return true; }
    if (event.key === 'e' || event.key === 'E') { erasing.value = !erasing.value; message.value = ''; return true; }
    return false;
  }

  function reset() { cancel(); past = []; future = []; message.value = ''; }

  return { size, erasing, active, message, live, begin, move, end, cancel, undo, redo, keydown, reset,
           canUndo: () => past.length > 0, canRedo: () => future.length > 0 };
}
