// COCO compressed RLE for label masks (ADM-1344, agentic-docs/LABEL_EDITOR_TOOLS_PLAN.md, contracts C1 and C2).
//
// A mask is stored as {size: [height, width], counts: "<string>"}, exactly as pycocotools 2.0.11 writes it
// (`mask.encode`, counts decoded to str): the pixels are read column by column (column-major), the runs alternate
// 0s and 1s starting with 0s, and each run is written in COCO's variable-length characters, delta-coded against the
// run two places back from the fourth run on. The strings made here are byte-identical to pycocotools'
// (training-data/tests/fixtures/rle_pycocotools_2_0_11.json).
//
// In the browser a decoded mask is a Uint8Array of height * width in ROW-major order (index y * width + x, 1 inside,
// 0 outside): what a canvas, the brush and maskShapes.js work with. Only the string is column-major.
//
// Public API:
//   encode(mask, height, width)        -> {size: [height, width], counts}     mask: row-major Uint8Array (0 / non-0)
//   decode(rle)                         -> Uint8Array (row-major)             throws an Error in words on a bad mask
//   area(rle)                           -> number of mask pixels
//   bbox(rle)                           -> [x, y, w, h] as pycocotools toBbox ([0, 0, 0, 0] for an empty mask)
//   check(rle, {size?, maxPixels?})     -> '' when the mask is good, else what is wrong, in words
//   resize(rle, height, width)          -> the mask at another size, nearest pixel (pixel centres)
//   runsToString(runs) / stringToRuns(counts)    the counts string <-> the run lengths
//   MAX_PIXELS                          the largest mask accepted (height * width)

export const MAX_PIXELS = 100_000_000;   // 100 MP: above any photo the app takes, far below what would exhaust memory
const MAX_DIGITS = 7;                     // 7 characters hold 35 bits: every run length up to MAX_PIXELS fits

// pycocotools rleToString: x -= cnts[i-2] for i > 2; 5 bits per character, 0x20 = more follows, 0x10 = sign; + 48.
export function runsToString(runs) {
  let out = '';
  for (let i = 0; i < runs.length; i++) {
    let x = runs[i];
    if (i > 2) x -= runs[i - 2];
    let more = true;
    while (more) {
      let c = x & 0x1f;
      x = Math.floor(x / 32);                       // arithmetic shift, also for negative deltas
      more = (c & 0x10) ? x !== -1 : x !== 0;
      if (more) c |= 0x20;
      out += String.fromCharCode(c + 48);
    }
  }
  return out;
}

// pycocotools rleFrString, with every way a string can be wrong refused in words (never a silent bad mask).
export function stringToRuns(counts) {
  if (typeof counts !== 'string') throw new Error('The mask has no counts text.');
  const runs = [];
  let p = 0;
  while (p < counts.length) {
    let x = 0, k = 0, more = true;
    while (more) {
      if (p >= counts.length) throw new Error('The mask\'s counts end in the middle of a number.');
      const code = counts.charCodeAt(p);
      const c = code - 48;
      if (c < 0 || c > 63) throw new Error(`The mask's counts hold a character that is not allowed ("${counts[p]}" at position ${p + 1}).`);
      if (k >= MAX_DIGITS) throw new Error('The mask\'s counts hold a number that is too large.');
      x += (c & 0x1f) * 2 ** (5 * k);
      more = (c & 0x20) !== 0;
      p++; k++;
      if (!more && (c & 0x10)) x -= 2 ** (5 * k);   // the sign: x |= -1 << 5k
    }
    if (runs.length > 2) x += runs[runs.length - 2];
    runs.push(x);
  }
  return runs;
}

function sizeOf(rle) {
  const size = rle && rle.size;
  if (!Array.isArray(size) || size.length !== 2) throw new Error('The mask has no size (height and width).');
  const [h, w] = size;
  if (!Number.isInteger(h) || !Number.isInteger(w) || h < 1 || w < 1) throw new Error('The mask\'s size must be two whole numbers above 0.');
  return [h, w];
}

// What is wrong with a mask, in words; '' when it is good. `size` is the photo's [height, width] it must match.
export function check(rle, { size = null, maxPixels = MAX_PIXELS } = {}) {
  try {
    if (!rle || typeof rle !== 'object') return 'The mask is missing.';
    const [h, w] = sizeOf(rle);
    if (size && (size[0] !== h || size[1] !== w)) return `The mask is ${w} x ${h} pixels but the photo is ${size[1]} x ${size[0]}.`;
    if (h * w > maxPixels) return `The mask is too large (${w} x ${h} pixels; at most ${maxPixels.toLocaleString('en-US')} pixels).`;
    if (typeof rle.counts !== 'string' || !rle.counts.length) return 'The mask has no counts text.';
    if (rle.counts.length > 6 * (h * w + 1)) return 'The mask\'s counts are longer than its size allows.';
    const runs = stringToRuns(rle.counts);
    let total = 0;
    for (let i = 0; i < runs.length; i++) {
      if (runs[i] < 0) return `The mask's counts hold a run of less than 0 pixels (run ${i + 1}).`;
      total += runs[i];
      if (total > h * w) break;
    }
    if (total !== h * w) return `The mask's runs add up to ${total} pixels, but its size is ${w} x ${h} (${h * w} pixels).`;
    return '';
  } catch (error) { return error.message; }
}

function checked(rle) {
  const problem = check(rle);
  if (problem) throw new Error(problem);
  return [sizeOf(rle), stringToRuns(rle.counts)];
}

// A cache-friendly transpose of a rows x cols byte grid (row-major) in 64 x 64 blocks: a 12 MP mask read column by
// column straight from row-major memory is several times slower.
function transpose(src, rows, cols) {
  const out = new Uint8Array(new ArrayBuffer(Math.ceil(rows * cols / 4) * 4), 0, rows * cols), B = 64;
  for (let r0 = 0; r0 < rows; r0 += B) {
    const r1 = Math.min(rows, r0 + B);
    for (let c0 = 0; c0 < cols; c0 += B) {
      const c1 = Math.min(cols, c0 + B);
      for (let r = r0; r < r1; r++) {
        for (let c = c0, i = r * cols + c0, o = c0 * rows + r; c < c1; c++, i++, o += rows) out[o] = src[i] ? 1 : 0;
      }
    }
  }
  return out;
}

// A row-major mask (Uint8Array or any array of 0 / non-0) of height x width -> {size, counts}.
export function encode(mask, height, width) {
  if (!Number.isInteger(height) || !Number.isInteger(width) || height < 1 || width < 1) throw new Error("The mask's size must be two whole numbers above 0.");
  if (!mask || mask.length !== height * width) throw new Error(`The mask holds ${mask ? mask.length : 0} pixels, not ${height} x ${width}.`);
  if (height * width > MAX_PIXELS) throw new Error('The mask is too large.');
  const columns = transpose(mask, height, width);   // column-major, 0 / 1 (its buffer is a whole number of words)
  const words = new Uint32Array(columns.buffer), n = height * width;
  const runs = [];
  let value = 0, start = 0, i = 0;
  while (i < n) {
    // Four pixels at a time while they all hold the current value (long runs are the common case).
    if ((i & 3) === 0 && words[i >> 2] === (value ? 0x01010101 : 0) && i + 4 <= n) { i += 4; continue; }
    if (columns[i] !== value) { runs.push(i - start); start = i; value ^= 1; }
    i++;
  }
  runs.push(n - start);
  return { size: [height, width], counts: runsToString(runs) };
}

// {size, counts} -> a row-major Uint8Array: the runs of 1s are filled column-major (one memset each), then transposed.
export function decode(rle) {
  const [[h, w], runs] = checked(rle);
  const columns = new Uint8Array(h * w);
  let at = 0;
  for (let r = 0; r < runs.length; r++) {
    if (r & 1) columns.fill(1, at, at + runs[r]);
    at += runs[r];
  }
  return transpose(columns, w, h);
}

export function area(rle) {
  const [, runs] = checked(rle);
  let total = 0;
  for (let i = 1; i < runs.length; i += 2) total += runs[i];
  return total;
}

// pycocotools rleToBbox, line for line: [x, y, width, height]; an empty mask is [0, 0, 0, 0].
export function bbox(rle) {
  const [[h, w], runs] = checked(rle);
  const m = Math.floor(runs.length / 2) * 2;
  if (m === 0) return [0, 0, 0, 0];
  let xs = w, ys = h, xe = 0, ye = 0, cc = 0, xp = 0;
  for (let j = 0; j < m; j++) {
    cc += runs[j];
    const t = cc - (j % 2);
    if (t < 0) continue;
    const y = t % h, x = (t - y) / h;
    if (j % 2 === 0) xp = x; else if (xp < x) { ys = 0; ye = h - 1; }
    xs = Math.min(xs, x); xe = Math.max(xe, x); ys = Math.min(ys, y); ye = Math.max(ye, y);
  }
  return [xs, ys, xe - xs + 1, ye - ys + 1];
}

// The mask at another size, nearest pixel by pixel centres: target (y, x) reads source
// (min(h-1, floor((y + 0.5) * h / height)), the same for x). Used to bring a mask to the photo's size.
export function resize(rle, height, width) {
  if (!Number.isInteger(height) || !Number.isInteger(width) || height < 1 || width < 1) throw new Error('The new size must be two whole numbers above 0.');
  if (height * width > MAX_PIXELS) throw new Error('The new size is too large.');
  const [h, w] = sizeOf(rle);
  const source = decode(rle);
  if (h === height && w === width) return { size: [h, w], counts: rle.counts };
  const xs = new Int32Array(width);
  for (let x = 0; x < width; x++) xs[x] = Math.min(w - 1, Math.floor((x + 0.5) * w / width));
  const out = new Uint8Array(height * width);
  for (let y = 0; y < height; y++) {
    const row = Math.min(h - 1, Math.floor((y + 0.5) * h / height)) * w;
    for (let x = 0, i = y * width; x < width; x++, i++) out[i] = source[row + xs[x]];
  }
  return encode(out, height, width);
}
