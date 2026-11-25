// The labeling editor's tools, keys and view arithmetic (agentic-docs/LABEL_EDITOR_TOOLS_PLAN.md sections 2.4 to 2.6).
// Pure functions and data, so the rail, the hover cards, the keyboard panel and the tests read one list.

import { decode, encode, stringToRuns } from './rle.js';
import { intersect, maskToPolygons, rasterize } from './maskShapes.js';

// Where a Help Center article lives: the main app's article page (src/main.js, 'help-center/article/:slug'). One helper,
// so the pattern changes in one place.
export const HELP_ARTICLE_BASE = '/dashboard/help-center/article/';
export function helpArticle(slug) {
  return slug ? `${HELP_ARTICLE_BASE}${encodeURIComponent(slug)}` : '';
}

// The rail, in its order. ``kind``: 'tool' stays chosen (pressed) until another is chosen; 'action' acts once;
// 'toggle' is on or off. ``keys`` are shown in the key chip (several chips when a tool has two keys). ``lines`` are the
// hover card's two lines. ``slug`` is the Help Center article ('' when there is none). ``group`` draws the dividers.
export const RAIL = [
  { id: 'pan', name: 'Pan', kind: 'tool', keys: ['H'], group: 'view', slug: 'label-editor-pan',
    lines: ['Drag the photo to move around it.', 'Scrolling moves it too; Ctrl+scroll zooms at the pointer.'] },
  { id: 'select', name: 'Select', kind: 'tool', keys: ['V'], group: 'view', slug: '',
    lines: ['Click a shape to choose its class; drag a corner to move it.', 'Double-click an edge to add a corner.'] },
  { id: 'box', name: 'Box', kind: 'tool', keys: ['B'], group: 'draw', slug: 'label-editor-box',
    lines: ['Click one corner, then the opposite one, or drag across the object.', 'You choose its class as soon as it is drawn.'] },
  { id: 'polygon', name: 'Polygon', kind: 'tool', keys: ['P'], group: 'draw', slug: 'label-editor-polygon',
    lines: ['Click each corner of the object, then the first corner to close it.', 'Enter or a double-click finishes; Backspace takes back a corner.'] },
  { id: 'split', name: 'Split', kind: 'tool', keys: ['/'], group: 'draw', slug: '',
    lines: ['Click on both sides of a shape: the line cuts it in two.', 'Both parts keep the class. Check their corners.'] },
  { id: 'brush', name: 'Brush', kind: 'tool', keys: ['R'], group: 'draw', slug: 'label-editor-brush',
    lines: ['Paint a mask over the object, pixel by pixel.', 'E switches to the eraser; [ and ] change the size.'] },
  { id: 'rotate', name: 'Rotate image', kind: 'action', keys: ['Shift', 'R'], group: 'draw', slug: 'label-editor-rotate',
    lines: ['Turns the view a quarter turn clockwise.', 'Labels stay on the photo as it is stored.'] },
  { id: 'smart', name: 'Smart Select', kind: 'tool', keys: ['S'], group: 'ai', slug: 'label-editor-smart-select',
    lines: ['Click the object and SAM 3 outlines it. Click to add, Shift-click or right-click to remove.', 'Enter keeps the outline, Esc drops it.'] },
  { id: 'assist', name: 'Label Assist', kind: 'action', keys: ['L'], group: 'ai', slug: 'label-editor-label-assist',
    lines: ['A model labels every class you tick in this photo.', 'You check what it found; Save keeps it.'] },
  { id: 'outline', name: 'Box to outline', kind: 'tool', keys: ['O'], group: 'ai', slug: 'label-editor-box-to-outline',
    lines: ["Draw a box around one object: SAM 3 turns it into the object's outline.", 'Enter keeps the outline, Esc drops it.'] },
  // Text Prompting (the owner, 2026-11-25, as Roboflow's): the rail's door to Find Objects with AI. Name a thing, the
  // model finds every one of it in the photo; the same card as the button under Annotations and the M key.
  { id: 'find', name: 'Text Prompting', kind: 'action', keys: ['M'], group: 'ai', slug: 'label-editor-text-prompting',
    lines: ['Describe an object with text: the model finds every one of it in the photo.', 'You check what it found; Save keeps it.'] },
  { id: 'refine', name: 'AI refine', kind: 'action', keys: ['F'], group: 'ai', slug: 'label-editor-ai-refine',
    lines: ['Replaces the selected shape with the one a model finds in the same place.', 'You choose the model and see its price first; Ctrl+Z brings yours back.'] },
  { id: 'comments', name: 'Comments', kind: 'action', keys: ['C'], group: 'review', slug: 'label-editor-comments',
    lines: ["Opens this photo's comments.", 'Notes between the labeller and the reviewer.'] },
  { id: 'undo', name: 'Undo', kind: 'action', keys: ['Ctrl', 'Z'], group: 'review', slug: 'label-editor-undo-redo',
    lines: ['Takes back the last change.', 'Nothing is saved until you save.'] },
  { id: 'redo', name: 'Redo', kind: 'action', keys: ['Ctrl', 'Y'], group: 'review', slug: 'label-editor-undo-redo',
    lines: ['Brings back what Undo took away.', 'Ctrl+Shift+Z works too.'] },
  { id: 'empty', name: 'No objects', kind: 'toggle', keys: ['N'], group: 'review', slug: 'label-editor-no-objects',
    lines: ['Marks this photo as having nothing to label.', 'Use it when none of the classes is in the photo.'] },
  { id: 'labels', name: 'Show labels', kind: 'toggle', keys: [], group: 'review', slug: '',
    lines: ['Shows or hides every label on the photo.', 'Hidden labels are still saved.'] },
];
export const railEntry = id => RAIL.find(entry => entry.id === id) || null;
// The Help Center article for showing an answer as masks or polygons (Label Assist and the Polygons / Masks switch).
export const MASKS_POLYGONS_SLUG = 'label-editor-masks-polygons';

// Tools that draw on the photo: the full-width and full-height crosshair follows the pointer for these.
export const CROSSHAIR_TOOLS = new Set(['box', 'polygon', 'smart', 'outline', 'brush', 'eraser']);

// The key a press means, as the rail's id ('' when it means none of them). Keys typed into a field never reach here
// (the editor checks first). Ctrl / Cmd combinations other than undo and redo are the browser's.
const PLAIN_KEYS = { h: 'pan', v: 'select', b: 'box', p: 'polygon', '/': 'split', r: 'brush', e: 'eraser', s: 'smart',
  l: 'assist', o: 'outline', f: 'refine', c: 'comments', n: 'empty', m: 'find', t: 'straighten',
  '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', '0': 'reset-view', '[': 'brush-smaller', ']': 'brush-larger' };
export function keyAction(event) {
  const key = String(event.key || '');
  const lower = key.length === 1 ? key.toLowerCase() : key;
  if (event.ctrlKey || event.metaKey) {
    if (lower === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (lower === 'y') return 'redo';
    return '';
  }
  if (event.altKey) return '';
  if (lower === 'r' && event.shiftKey) return 'rotate';
  return PLAIN_KEYS[lower] || '';
}

// The keyboard panel: every key, by group.
export const KEY_GROUPS = [
  { group: 'Tools', keys: [
    { keys: ['H'], what: 'Pan', slug: 'label-editor-pan' }, { keys: ['V'], what: 'Select and move corners' },
    { keys: ['B'], what: 'Box', slug: 'label-editor-box' }, { keys: ['P'], what: 'Polygon', slug: 'label-editor-polygon' },
    { keys: ['/'], what: 'Split a shape in two' }, { keys: ['R'], what: 'Brush', slug: 'label-editor-brush' },
    { keys: ['E'], what: 'Eraser', slug: 'label-editor-brush' }, { keys: ['S'], what: 'Smart Select', slug: 'label-editor-smart-select' },
    { keys: ['O'], what: 'Box to outline', slug: 'label-editor-box-to-outline' }, { keys: ['L'], what: 'Label Assist', slug: 'label-editor-label-assist' },
    { keys: ['M'], what: 'Find Objects with AI' }, { keys: ['F'], what: 'AI refine the selected shape', slug: 'label-editor-ai-refine' },
  ] },
  { group: 'View', keys: [
    { keys: ['Shift', 'R'], what: 'Rotate the view a quarter turn', slug: 'label-editor-rotate' },
    { keys: ['Ctrl', 'Scroll'], what: 'Zoom at the pointer' }, { keys: ['Scroll'], what: 'Move the photo' },
    { keys: ['+'], what: 'Zoom in' }, { keys: ['-'], what: 'Zoom out' }, { keys: ['0'], what: 'Reset the view' },
  ] },
  { group: 'Shapes', keys: [
    { keys: ['Enter'], what: 'Finish the polygon, or keep the Smart Select outline' },
    { keys: ['Esc'], what: 'Cancel what is being drawn, or drop the Smart Select outline' },
    { keys: ['Shift', 'Click'], what: 'Smart Select: remove an area (a right-click too)', slug: 'label-editor-smart-select' },
    { keys: ['Backspace'], what: 'Take back the last corner of a polygon' },
    { keys: ['Delete'], what: 'Remove the selected corner or shape' }, { keys: ['T'], what: 'Straighten: keep only the real corners' },
    { keys: ['[', ']'], what: 'Brush: smaller or larger', slug: 'label-editor-brush' },
  ] },
  { group: 'Review', keys: [
    { keys: ['Ctrl', 'Z'], what: 'Undo', slug: 'label-editor-undo-redo' }, { keys: ['Ctrl', 'Y'], what: 'Redo', slug: 'label-editor-undo-redo' },
    { keys: ['N'], what: 'No objects in this photo', slug: 'label-editor-no-objects' }, { keys: ['C'], what: 'Comments', slug: 'label-editor-comments' },
  ] },
];

// Rotate image turns the VIEW only, a quarter turn at a time; labels stay in the photo's coordinates. A pointer at
// (u, v), its share of the turned photo's box on screen (0..1 each), is at this share of the photo itself.
export function unrotate(u, v, quarter) {
  switch (((quarter % 4) + 4) % 4) {
    case 1: return [v, 1 - u];
    case 2: return [1 - u, 1 - v];
    case 3: return [1 - v, u];
    default: return [u, v];
  }
}
// The other way: where a point of the photo (its share a, b) is in the turned box.
export function rotate(a, b, quarter) {
  switch (((quarter % 4) + 4) % 4) {
    case 1: return [1 - b, a];
    case 2: return [1 - a, 1 - b];
    case 3: return [b, 1 - a];
    default: return [a, b];
  }
}

// The photo's size on screen. ``room``: the area it is shown in; ``aspect``: the photo's width / height; ``zoom`` in %.
// ``shown``: the turned photo's box; ``stage``: the photo itself before the turn (its width runs down the screen after a
// quarter turn).
export function viewSize(room, aspect, zoom, quarter) {
  const odd = Math.abs(quarter) % 2 === 1;
  const ratio = odd ? 1 / aspect : aspect;
  const fit = room.w && room.h ? Math.min(room.w, room.h * ratio) : 600;
  const width = fit * zoom / 100; const height = width / ratio;
  return { shown: { w: width, h: height }, stage: odd ? { w: height, h: width } : { w: width, h: height } };
}

export const ZOOM_MIN = 25, ZOOM_MAX = 800, ZOOM_STEP = 25;
export const clampZoom = value => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)));
// The zoom a wheel turn gives (Ctrl+wheel): smooth, about 10 % a notch.
export function wheelZoom(zoom, deltaY) {
  return clampZoom(zoom * Math.exp(-deltaY * 0.001));
}
// Zooming keeps the point under the pointer where it is. The photo is centred in its area and moved by ``pan``;
// ``at`` is the pointer from the area's centre (pixels). Answers the new pan.
export function zoomAt(pan, zoom, next, at = { x: 0, y: 0 }) {
  const k = next / zoom;
  return { x: Math.round((at.x - (at.x - pan.x) * k) * 100) / 100, y: Math.round((at.y - (at.y - pan.y) * k) * 100) / 100 };
}

// Which of the project's classes this photo uses, and how often; the rest are unused.
export function classUse(shapes, classes) {
  const counts = new Map();
  for (const shape of shapes || []) counts.set(shape.kind, (counts.get(shape.kind) || 0) + 1);
  const known = (classes || []).map(c => ({ name: c.name, color: c.color, count: counts.get(c.name) || 0 }));
  // A shape whose class is not (or no longer) a class of the project is listed too, so every shape is counted.
  const strays = [...counts.keys()].filter(name => !known.some(c => c.name === name)).map(name => ({ name, color: '', count: counts.get(name) }));
  return { inPhoto: [...known.filter(c => c.count), ...strays], unused: known.filter(c => !c.count) };
}

// A layer moved one place up (toward the top, drawn last) or down. Answers a new array; the same one when it cannot move.
export function moveLayer(shapes, id, step) {
  const at = shapes.findIndex(shape => shape.id === id);
  const to = at + step;
  if (at < 0 || to < 0 || to >= shapes.length) return shapes;
  const out = [...shapes];
  const [shape] = out.splice(at, 1);
  out.splice(to, 0, shape);
  return out;
}

// What a model answered, in the way the person chose (contract C3 / C4): ``shapes`` and ``other`` together hold the
// polygons and the masks of one answer; a mask has ``mask``, a polygon ``points``.
export const isMask = shape => !!shape?.mask;
export function pickWay(shapes, other, way) {
  const all = [...(shapes || []), ...(other || [])];
  return all.filter(shape => (way === 'masks' ? isMask(shape) : !isMask(shape) && Array.isArray(shape?.points)));
}

// The notification after an AI answer is kept: "Applied 3 labels".
export function appliedWords(count) {
  return `Applied ${count} label${count === 1 ? '' : 's'}`;
}

// Whether a mask (COCO RLE, contract C1) holds the photo pixel at (x, y), read from its runs (column-major) without
// decoding the whole mask: the editor's click test for masks, which sit under the SVG and take no pointer events.
export function maskHas(rle, x, y) {
  const [h, w] = rle?.size || [];
  const xi = Math.floor(x), yi = Math.floor(y);
  if (!h || !w || xi < 0 || yi < 0 || xi >= w || yi >= h) return false;
  const at = xi * h + yi;
  let pos = 0, on = false;
  for (const run of stringToRuns(rle.counts)) { if (at < pos + run) return on; pos += run; on = !on; }
  return false;
}

// A class whose geometry is a wall, a window or a door is drawn as polygons with corners, never as a mask.
export function maskRefusal(geometry, kind) {
  return geometry ? `A ${kind} is a polygon with corners (its class is a ${geometry}), so it is not kept as a mask.` : '';
}

// Convert to mask: a polygon (photo pixels) filled into a mask of the photo's size. Answers {size, counts}, or null
// when it covers no pixel.
export function polygonToMask(points, width, height) {
  const mask = rasterize([points], width, height);
  return mask.some(Boolean) ? encode(mask, height, width) : null;
}
// Convert to polygon: every separate region of a mask as one polygon (photo pixels), holes not kept (a polygon has none).
export function maskToRegions(rle, { tolerance = 1, minArea = 4 } = {}) {
  const [h, w] = rle.size;
  return maskToPolygons(decode(rle), w, h, { tolerance, holes: false, minArea }).filter(ring => ring.length >= 3);
}

// AI refine on a mask: of a model's answer (backend shapes in photo pixels, ``shapes`` and ``other`` together), the one
// of the same class that covers the most the same pixels as ``target`` (a mask), by intersection over union. A polygon
// answer is filled at the photo's size first. Answers {mask, share}, or null when none reaches ``least`` (the polygon
// refine's own threshold, geometry.bestMatch).
const count = mask => { let n = 0; for (let i = 0; i < mask.length; i++) n += mask[i] ? 1 : 0; return n; };
export function bestMaskMatch(target, candidates, kind, least = 0.3) {
  const [h, w] = target.size;
  const mine = decode(target), own = count(mine);
  if (!own) return null;
  let found = null;
  for (const candidate of candidates || []) {
    if (candidate?.kind !== kind) continue;
    let mask, rle;
    if (candidate.mask) {
      if (candidate.mask.size?.[0] !== h || candidate.mask.size?.[1] !== w) continue;
      try { mask = decode(candidate.mask); } catch { continue; }
      rle = { size: [h, w], counts: candidate.mask.counts };
    } else if (Array.isArray(candidate.points) && candidate.points.length >= 3) {
      mask = rasterize([candidate.points], w, h); rle = null;
    } else continue;
    const both = count(intersect(mine, mask)), theirs = count(mask);
    const share = both / (own + theirs - both || 1);
    if (share >= least && (!found || share > found.share)) found = { mask, rle, share };
  }
  if (!found) return null;
  return { mask: found.rle || encode(found.mask, h, w), share: found.share };
}
