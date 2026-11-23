// Masks <-> polygons, and mask arithmetic, in the photo's own pixels (ADM-1344, LABEL_EDITOR_TOOLS_PLAN.md 2.1).
//
// A mask here is a row-major Uint8Array of height * width (1 inside, 0 outside), as rle.js decodes it. A polygon is
// [[x, y], ...] in photo pixels, where pixel (x, y) is the square [x, x+1] x [y, y+1]: a pixel belongs to a polygon
// when its centre (x + 0.5, y + 0.5) is inside it. All functions are pure (no input is changed).
//
// Public API:
//   rasterize(polygons, width, height)           -> mask. Even-odd fill over all rings together (a ring inside
//                                                   another cuts a hole). polygons: one polygon or a list of them.
//   traceRings(mask, width, height)              -> [{ring, outer, area}]: every boundary of every region, exactly
//                                                   along the pixel edges (corners only). outer = an outline; else a
//                                                   hole. Regions are 4-connected (two pixels touching only at a
//                                                   corner are two regions).
//   maskToPolygons(mask, width, height, {tolerance = 1, holes = false, minArea = 0})
//                                                -> [[x, y], ...][]: every outer ring of every region (and the holes
//                                                   when holes is true), simplified with Douglas-Peucker at
//                                                   `tolerance` photo pixels (0 = exact pixel edges).
//   simplify(ring, tolerance)                    -> the closed ring with Douglas-Peucker applied.
//   union(a, b) / subtract(a, b) / intersect(a, b) -> mask (same length masks).
//   maskBox(mask, width, height)                 -> [x, y, w, h] of the mask's pixels, or null when empty.
//   isEmpty(mask)                                -> true when no pixel is set.

function asPolygons(polygons) {
  if (!Array.isArray(polygons) || !polygons.length) return [];
  return Array.isArray(polygons[0]) && typeof polygons[0][0] === 'number' ? [polygons] : polygons;
}

export function rasterize(polygons, width, height) {
  const out = new Uint8Array(width * height);
  const rings = asPolygons(polygons).filter(r => Array.isArray(r) && r.length >= 3);
  const edges = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (a[1] === b[1]) continue;                      // a level edge never crosses a row's centre line
      const [lo, hi] = a[1] < b[1] ? [a, b] : [b, a];
      edges.push({ y0: lo[1], y1: hi[1], x0: lo[0], slope: (hi[0] - lo[0]) / (hi[1] - lo[1]) });
    }
  }
  if (!edges.length) return out;
  let top = Infinity, bottom = -Infinity;
  for (const e of edges) { top = Math.min(top, e.y0); bottom = Math.max(bottom, e.y1); }
  const first = Math.max(0, Math.floor(top - 0.5)), last = Math.min(height - 1, Math.ceil(bottom - 0.5));
  const xs = [];
  for (let y = first; y <= last; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (const e of edges) if (cy >= e.y0 && cy < e.y1) xs.push(e.x0 + (cy - e.y0) * e.slope);   // half-open: a shared vertex counts once
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    const row = y * width;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5)), to = Math.min(width - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
      if (to >= from) out.fill(1, row + from, row + to + 1);
    }
  }
  return out;
}

// Crack following on the pixel edges, filled pixels kept on the right of the walk (y grows downwards):
// an outline runs clockwise on screen (positive shoelace sum), a hole anticlockwise. Every loop holds at least one
// rightward step, and a rightward step is exactly the top edge of a set pixel whose upper neighbour is unset, so
// scanning those top edges finds every loop once.
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];   // right, down, left, up
export function traceRings(mask, width, height) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < width && y < height ? mask[y * width + x] : 0);
  const seen = new Uint8Array(width * height);   // top edges already walked
  const rings = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!mask[i] || seen[i] || (y > 0 && mask[i - width])) continue;
      const ring = [];
      let vx = x, vy = y, d = 0, sum = 0;
      const startX = x, startY = y;
      do {
        if (d === 0) seen[vy * width + vx] = 1;
        const nx = vx + DX[d], ny = vy + DY[d];
        sum += vx * ny - nx * vy;
        vx = nx; vy = ny;
        // The two pixels ahead of the vertex, left and right of the heading.
        let fl, fr;
        if (d === 0) { fl = at(vx, vy - 1); fr = at(vx, vy); }
        else if (d === 1) { fl = at(vx, vy); fr = at(vx - 1, vy); }
        else if (d === 2) { fl = at(vx - 1, vy); fr = at(vx - 1, vy - 1); }
        else { fl = at(vx - 1, vy - 1); fr = at(vx, vy - 1); }
        const next = !fr ? (d + 1) % 4 : (fl ? (d + 3) % 4 : d);   // right turn, left turn or straight on
        if (next !== d) ring.push([vx, vy]);
        d = next;
      } while (!(vx === startX && vy === startY && d === 0));
      // The start vertex is a corner of the loop only when the walk turns there; ring holds every corner once.
      rings.push({ ring, outer: sum > 0, area: Math.abs(sum) / 2 });
    }
  }
  return rings;
}

function lineGap(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (!length) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length;
}

function simplifyOpen(points, tolerance) {   // Douglas-Peucker without recursion (a 12 MP outline is long)
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop();
    let worst = -1, gap = tolerance;
    for (let i = from + 1; i < to; i++) {
      const g = lineGap(points[i], points[from], points[to]);
      if (g > gap) { gap = g; worst = i; }
    }
    if (worst > 0) { keep[worst] = 1; stack.push([from, worst], [worst, to]); }
  }
  return points.filter((_, i) => keep[i]);
}

// A closed ring: split at the corner farthest from the first one, simplify both halves, join them.
export function simplify(ring, tolerance = 1) {
  if (!Array.isArray(ring) || ring.length <= 3 || !(tolerance > 0)) return ring ? ring.map(p => [...p]) : [];
  let far = 0, best = -1;
  for (let i = 1; i < ring.length; i++) {
    const g = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (g > best) { best = g; far = i; }
  }
  const first = simplifyOpen(ring.slice(0, far + 1), tolerance);
  const second = simplifyOpen([...ring.slice(far), ring[0]], tolerance);
  const out = [...first, ...second.slice(1, -1)].map(p => [...p]);
  return out.length >= 3 ? out : ring.map(p => [...p]);
}

export function maskToPolygons(mask, width, height, { tolerance = 1, holes = false, minArea = 0 } = {}) {
  return traceRings(mask, width, height)
    .filter(r => (r.outer || holes) && r.area >= minArea && r.ring.length >= 3)
    .map(r => simplify(r.ring, tolerance));
}

function same(a, b) {
  if (!a || !b || a.length !== b.length) throw new Error('The two masks are not the same size.');
}
export function union(a, b) { same(a, b); const out = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] || b[i] ? 1 : 0; return out; }
export function subtract(a, b) { same(a, b); const out = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] && !b[i] ? 1 : 0; return out; }
export function intersect(a, b) { same(a, b); const out = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0; return out; }
export function isEmpty(mask) { for (let i = 0; i < mask.length; i++) if (mask[i]) return false; return true; }

export function maskBox(mask, width, height) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let left = -1, right = -1;
    for (let x = 0; x < width; x++) if (mask[row + x]) { left = x; break; }
    if (left < 0) continue;
    for (let x = width - 1; x >= left; x--) if (mask[row + x]) { right = x; break; }
    if (y < y0) y0 = y;
    y1 = y;
    if (left < x0) x0 = left;
    if (right > x1) x1 = right;
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}
