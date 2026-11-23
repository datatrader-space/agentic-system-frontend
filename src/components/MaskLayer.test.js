// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import MaskLayer from '../../training-data/src/components/MaskLayer.vue';
import BrushCursor from '../../training-data/src/components/BrushCursor.vue';
import { encode } from '../../training-data/src/rle.js';
import { rasterize } from '../../training-data/src/maskShapes.js';

// jsdom has no 2D canvas: a recording context stands in for it (what was put into each canvas, what was drawn where).
let contexts;
function fakeContext(canvas) {
  const ctx = {
    canvas, globalAlpha: 1, imageSmoothingEnabled: true, fillStyle: '#000000', drawn: [], put: [], transform: [1, 0, 0, 1, 0, 0],
    setTransform(...m) { this.transform = m; },
    clearRect: vi.fn(function () { this.drawn = []; }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(image, x, y, ...dirty) { this.put.push({ image, x, y, dirty }); },
    drawImage(source, x, y) {
      const [a, b, c, d, e, f] = this.transform;
      this.drawn.push({ source, x: a * x + c * y + e, y: b * x + d * y + f, transposed: a === 0 && b === 1 && c === 1 && d === 0, alpha: this.globalAlpha });
    },
  };
  contexts.push(ctx); return ctx;
}
beforeEach(() => {
  contexts = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () { return this.__ctx ||= fakeContext(this); });
});
const wrappers = [];
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const W = 9, H = 8;
const square = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const maskOf = polygons => encode(rasterize(polygons, W, H), H, W);
const COLOURS = { crack: '#ff0000', floor: '#2563eb' };
function render(props = {}) {
  const shapes = [
    { id: 'a', kind: 'crack', mask: maskOf([square(1, 1, 7, 6), square(3, 2, 5, 4)]) },   // a ring with a hole
    { id: 'b', kind: 'floor', mask: maskOf([square(0, 7, 9, 8)]) },
    { id: 'p', kind: 'floor', points: [[0, 0], [10, 0], [10, 10]] },                       // a polygon: not drawn here
  ];
  const wrapper = mount(MaskLayer, { props: { shapes, colorOf: kind => COLOURS[kind], selected: null, hidden: new Set(), photoWidth: W, photoHeight: H, ...props } });
  wrappers.push(wrapper); return wrapper;
}
const fillContext = wrapper => wrapper.find('canvas.mask-fill').element.__ctx;
const rgbaAt = (image, x, y) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
// A mask tile is stored transposed (one tile row per photo column) and drawn transposed back.
const tileAt = (image, x, y) => rgbaAt(image, y, x);

test('mounts a canvas at the photo size that fills the stage and draws each mask tile at 0.55 alpha', () => {
  const wrapper = render();
  const canvas = wrapper.find('canvas.mask-fill');
  expect(canvas.attributes('width')).toBe(String(W));
  expect(canvas.attributes('height')).toBe(String(H));
  expect(wrapper.find('.mask-layer').attributes('aria-hidden')).toBe('true');
  const drawn = fillContext(wrapper).drawn;
  expect(drawn).toHaveLength(2);                                  // two masks; the polygon is left to the SVG
  expect(drawn.every(d => d.alpha === 0.55)).toBe(true);
  expect(drawn.map(d => [d.x, d.y])).toEqual([[1, 1], [0, 7]]);   // each tile at its mask's box
  expect(fillContext(wrapper).imageSmoothingEnabled).toBe(false);
});

test('each mask pixel is the class colour, every other pixel clear: exact pixel edges, no outline', () => {
  const wrapper = render();
  const tile = fillContext(wrapper).drawn[0].source.__ctx.put[0].image;
  expect([tile.height, tile.width]).toEqual([6, 5]);               // the box is 6 x 5, stored transposed
  expect(fillContext(wrapper).drawn.every(d => d.transposed)).toBe(true);
  expect(tileAt(tile, 0, 0)).toEqual([255, 0, 0, 255]);           // photo pixel (1, 1)
  expect(tileAt(tile, 2, 1)).toEqual([0, 0, 0, 0]);               // the hole, photo pixel (3, 2)
  expect(tileAt(tile, 5, 4)).toEqual([255, 0, 0, 255]);           // the outline's last pixel is filled like any other
  expect(tileAt(tile, 1, 1)).toEqual([255, 0, 0, 255]);
  const floor = fillContext(wrapper).drawn[1].source.__ctx.put[0].image;
  expect(tileAt(floor, 4, 0)).toEqual([0x25, 0x63, 0xeb, 255]);
  expect(wrapper.find('svg.mask-edge').exists()).toBe(false);      // nothing selected: no edge at all
});

test('a selected mask gets a 1 px contrast edge along its pixel boundary (outline and hole)', async () => {
  const wrapper = render({ selected: 'a' });
  await nextTick();
  const svg = wrapper.find('svg.mask-edge');
  expect(svg.attributes('viewBox')).toBe(`0 0 ${W} ${H}`);
  const paths = svg.findAll('path');
  expect(paths.map(p => p.classes()[0])).toEqual(['mask-edge-halo', 'mask-edge-line']);
  const d = paths[1].attributes('d');
  expect(d).toContain('M7 1L7 6L1 6L1 1Z');                        // the outline
  expect(d.match(/M/g)).toHaveLength(2);                           // and the hole
  await wrapper.setProps({ selected: 'b' });
  expect(wrapper.find('svg.mask-edge path').attributes('d')).toBe('M9 7L9 8L0 8L0 7Z');
});

test('hidden masks are not drawn and a hidden selected mask has no edge', async () => {
  const wrapper = render({ hidden: new Set(['a']), selected: 'a' });
  await nextTick();
  expect(fillContext(wrapper).drawn.map(d => [d.x, d.y])).toEqual([[0, 7]]);
  expect(wrapper.find('svg.mask-edge').exists()).toBe(false);
  await wrapper.setProps({ hidden: new Set() });
  expect(fillContext(wrapper).drawn).toHaveLength(2);
  expect(wrapper.find('svg.mask-edge').exists()).toBe(true);
});

test('each mask is decoded once: selection and visibility changes reuse it, a new mask rebuilds only that one', async () => {
  const wrapper = render();
  const decoded = () => wrapper.vm.stats.decoded;
  expect(decoded()).toBe(2);
  await wrapper.setProps({ selected: 'b' });
  await wrapper.setProps({ hidden: new Set(['b']) });
  expect(decoded()).toBe(2);
  const shapes = wrapper.props('shapes').map(s => s.id === 'b' ? { ...s, mask: maskOf([square(0, 0, 2, 2)]) } : s);
  await wrapper.setProps({ shapes });
  expect(decoded()).toBe(3);
  await wrapper.setProps({ colorOf: () => '#00ff00' });           // a class colour change redraws the tiles in it
  expect(decoded()).toBe(5);
});

test('a mask the size of another photo is not drawn', () => {
  const wrapper = render({ shapes: [{ id: 'x', kind: 'crack', mask: encode(new Uint8Array(4).fill(1), 2, 2) }] });
  expect(fillContext(wrapper).drawn).toHaveLength(0);
});

test('the stroke being painted is drawn in place of its shape, putting in only what each move changed', async () => {
  const data = new Uint8Array(W * H); data[2 * W + 3] = 1;
  const wrapper = render({ live: { id: 'a', kind: 'crack', data, width: W, height: H, version: 1, box: [3, 2, 3, 2], dirty: [3, 2, 3, 2] } });
  await nextTick();
  const drawn = fillContext(wrapper).drawn;
  expect(drawn.map(d => [d.x, d.y])).toEqual([[0, 7], [0, 0]]);  // b, then the live mask over the whole photo
  const live = drawn[1].source.__ctx;
  expect(live.drawn).toHaveLength(1);                              // it starts from the shape's own tile
  expect(live.put[0]).toMatchObject({ x: 3, y: 2 });
  expect(rgbaAt(live.put[0].image, 0, 0)).toEqual([255, 0, 0, 255]);
  data[2 * W + 4] = 1;
  await wrapper.setProps({ live: { id: 'a', kind: 'crack', data, width: W, height: H, version: 2, box: [3, 2, 4, 2], dirty: [4, 2, 4, 2] } });
  expect(live.put.at(-1)).toMatchObject({ x: 4, y: 2 });
  expect([live.put.at(-1).image.width, live.put.at(-1).image.height]).toEqual([1, 1]);
  expect(rgbaAt(live.put.at(-1).image, 0, 0)).toEqual([255, 0, 0, 255]);
});

test('with a worker, tiles and the edge are made off the page; the previous tile stays until the new one is ready', async () => {
  const { handle } = await import('../../training-data/src/maskWorker.js');
  const posted = [];
  class FakeWorker {
    constructor() { this.onmessage = null; }
    postMessage(message) { posted.push(message); }
    terminate() {}
  }
  const answer = async () => { for (const m of posted.splice(0)) { const { reply } = await handle(m, async image => image); this_worker.onmessage({ data: reply }); } };
  let this_worker = null;
  vi.stubGlobal('Worker', class extends FakeWorker { constructor(...a) { super(...a); this_worker = this; } });
  vi.stubGlobal('createImageBitmap', async image => image);
  if (typeof ImageData === 'undefined') vi.stubGlobal('ImageData', class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } });
  const wrapper = render({ selected: 'a' });
  expect(fillContext(wrapper).drawn).toHaveLength(0);              // nothing made on the page
  expect(posted.map(m => m.type).sort()).toEqual(['edge', 'tile', 'tile']);
  await answer(); await nextTick();
  expect(fillContext(wrapper).drawn).toHaveLength(2);
  expect(tileAt(fillContext(wrapper).drawn[0].source, 0, 0)).toEqual([255, 0, 0, 255]);
  expect(wrapper.find('svg.mask-edge path').attributes('d')).toContain('M7 1L7 6L1 6L1 1Z');
  const shapes = wrapper.props('shapes').map(s => s.id === 'b' ? { ...s, mask: maskOf([square(0, 0, 2, 2)]) } : s);
  await wrapper.setProps({ shapes });
  expect(fillContext(wrapper).drawn.map(d => [d.x, d.y])).toEqual([[1, 1], [0, 7]]);   // b's old tile while the new one is made
  await answer(); await nextTick();
  expect(fillContext(wrapper).drawn.map(d => [d.x, d.y])).toEqual([[1, 1], [0, 0]]);
  vi.unstubAllGlobals();
});

test('a 4000 x 3000 mask decodes into its tile without blocking for long (time reported)', () => {
  const w = 4000, h = 3000, mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const r = Math.hypot(y - h / 2, x - w / 2); mask[y * w + x] = r < 1350 && r > 600 ? 1 : 0; }
  const rle = encode(mask, h, w);
  const started = performance.now();
  const wrapper = mount(MaskLayer, { props: { shapes: [{ id: 'big', kind: 'crack', mask: rle }], colorOf: () => '#ff0000', photoWidth: w, photoHeight: h } });
  wrappers.push(wrapper);
  const first = performance.now() - started;
  const tile = fillContext(wrapper).drawn[0].source.__ctx.put[0].image;
  expect(tileAt(tile, 1350, 0)).toEqual([255, 0, 0, 255]);        // top of the ring, inside its 2700 x 2700 box
  expect(tileAt(tile, 1350, 1350)).toEqual([0, 0, 0, 0]);          // its middle is the hole
  console.info(`MaskLayer 4000 x 3000 ring (${rle.counts.length} characters): first draw ${first.toFixed(0)} ms, draw time ${wrapper.vm.stats.lastDrawMs.toFixed(0)} ms`);
  expect(wrapper.vm.stats.lastDrawMs).toBeLessThan(1500);          // a generous bound for CI machines; the time is reported
});

test('the brush cursor is a circle of the brush size in stage units, dashed for the eraser', async () => {
  const wrapper = mount({ components: { BrushCursor }, data: () => ({ erasing: false }),
    template: '<svg viewBox="0 0 600 300"><BrushCursor :point="[300, 150]" :size="100" :photo-width="4000" :photo-height="3000" :erasing="erasing"/></svg>' });
  wrappers.push(wrapper);
  const ellipses = wrapper.findAll('ellipse');
  expect(ellipses).toHaveLength(2);
  expect(ellipses[1].attributes()).toMatchObject({ cx: '300', cy: '150', rx: '7.5', ry: '5' });
  expect(ellipses[0].element.namespaceURI).toBe('http://www.w3.org/2000/svg');
  expect(wrapper.find('g.brush-cursor').classes()).not.toContain('erasing');
  await wrapper.setData({ erasing: true });
  expect(wrapper.find('g.brush-cursor').classes()).toContain('erasing');
});
