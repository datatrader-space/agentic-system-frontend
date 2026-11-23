// MaskLayer's worker (ADM-1344): makes mask tiles and selected edges off the page's main thread, so a 12 MP mask
// never holds up a click or a stroke. Messages (from MaskLayer.vue):
//   {job, type: 'tile', mask: {size, counts}, rgba}  -> {job, box, bitmap} (an ImageBitmap, transferred) | {job, box: null}
//   {job, type: 'edge', mask: {size, counts}}        -> {job, path}
//   any failure                                      -> {job, error: '<words>'}
// `handle` is exported so the same code is checked in tests without a worker.
import { edgePathOf, tileOf } from './maskRaster.js';

export async function handle(message, makeBitmap = globalThis.createImageBitmap) {
  const { job, type, mask } = message;
  try {
    if (type === 'edge') return { reply: { job, path: edgePathOf(mask) }, transfer: [] };
    const tile = tileOf(mask, message.rgba);
    if (!tile) return { reply: { job, box: null }, transfer: [] };
    const image = new ImageData(new Uint8ClampedArray(tile.pixels.buffer), tile.width, tile.height);
    const bitmap = await makeBitmap(image);
    return { reply: { job, box: tile.box, bitmap }, transfer: [bitmap] };
  } catch (error) { return { reply: { job, error: error.message || 'The mask could not be drawn.' }, transfer: [] }; }
}

const WorkerScope = globalThis.WorkerGlobalScope;
if (typeof WorkerScope === 'function' && globalThis instanceof WorkerScope) {
  globalThis.onmessage = async event => { const { reply, transfer } = await handle(event.data); globalThis.postMessage(reply, transfer); };
}
