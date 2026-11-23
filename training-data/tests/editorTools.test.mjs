// The labeling editor's tools, keys and view (agentic-docs/LABEL_EDITOR_TOOLS_PLAN.md 2.2 to 2.6, contracts C2 to C8):
// the rail's order and keys, the hover cards' Help Center links, the keyboard panel, the turned view's pointer mapping,
// zoom at the pointer and its lock, the classes and layers panels, and the editor's source for what must never be there.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAIL, KEY_GROUPS, CROSSHAIR_TOOLS, HELP_ARTICLE_BASE, MASKS_POLYGONS_SLUG, helpArticle, keyAction, unrotate, rotate, viewSize, zoomAt,
  wheelZoom, clampZoom, ZOOM_MIN, ZOOM_MAX, classUse, moveLayer, pickWay, appliedWords, railEntry, bestMaskMatch } from '../src/editorTools.js';
import { encode } from '../src/rle.js';
import { fromBackend, toBackend } from '../src/api/annotate.js';

// The repository keeps CRLF; every source read here is normalised first.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const editor = read('../src/components/AnnotationEditor.vue');
const assist = read('../src/components/LabelAssistDialog.vue');
const card = read('../src/components/ToolHoverCard.vue');
const art = read('../src/components/ToolArt.vue');
const sam = read('../src/useSamSelection.js');
const api = read('../src/api/annotate.js');
const tools = read('../src/editorTools.js');

test('the rail is in the plan\'s order, with its keys', () => {
  assert.deepEqual(RAIL.map(t => t.id), ['pan', 'select', 'box', 'polygon', 'split', 'brush', 'rotate', 'smart', 'assist', 'outline', 'refine', 'comments', 'undo', 'redo', 'empty', 'labels']);
  const keys = Object.fromEntries(RAIL.map(t => [t.id, t.keys.join('+')]));
  assert.deepEqual(keys, { pan: 'H', select: 'V', box: 'B', polygon: 'P', split: '/', brush: 'R', rotate: 'Shift+R', smart: 'S', assist: 'L', outline: 'O', refine: 'F',
    comments: 'C', undo: 'Ctrl+Z', redo: 'Ctrl+Y', empty: 'N', labels: '' });
  for (const t of RAIL) { assert.equal(t.lines.length, 2, `${t.id} has two lines`); assert.ok(t.name && t.lines.every(Boolean)); }
  assert.equal(railEntry('smart').name, 'Smart Select');
  assert.equal(railEntry('nothing'), null);
});

test('each key press means one tool or action, and typing modifiers are left to the browser', () => {
  const press = (key, extra = {}) => keyAction({ key, ...extra });
  assert.deepEqual(['h', 'v', 'b', 'p', '/', 'r', 'e', 's', 'l', 'o', 'f', 'c', 'n', 'm', 't'].map(k => press(k)),
    ['pan', 'select', 'box', 'polygon', 'split', 'brush', 'eraser', 'smart', 'assist', 'outline', 'refine', 'comments', 'empty', 'find', 'straighten']);
  assert.equal(press('R', { shiftKey: true }), 'rotate');
  assert.equal(press('S'), 'smart');                                   // Caps Lock: the same tool
  assert.equal(press('z', { ctrlKey: true }), 'undo');
  assert.equal(press('z', { metaKey: true, shiftKey: true }), 'redo');
  assert.equal(press('y', { ctrlKey: true }), 'redo');
  assert.equal(press('c', { ctrlKey: true }), '');                     // copy stays the browser's
  assert.equal(press('s', { altKey: true }), '');
  assert.equal(press('a'), '');                                        // the old click-to-label key is gone
  assert.deepEqual(['+', '=', '-', '0', '[', ']'].map(k => press(k)), ['zoom-in', 'zoom-in', 'zoom-out', 'reset-view', 'brush-smaller', 'brush-larger']);
  assert.equal(press('Enter'), ''); assert.equal(press('Escape'), ''); assert.equal(press('Delete'), '');
});

test('the keyboard panel lists every key of the rail, grouped by tools, view, shapes and review', () => {
  assert.deepEqual(KEY_GROUPS.map(g => g.group), ['Tools', 'View', 'Shapes', 'Review']);
  const listed = new Set(KEY_GROUPS.flatMap(g => g.keys.map(k => k.keys.join('+'))));
  for (const t of RAIL) if (t.keys.length) assert.ok(listed.has(t.keys.join('+')), `${t.name} (${t.keys.join('+')}) is in the panel`);
  for (const k of ['E', 'M', 'T', 'Enter', 'Esc', 'Delete', 'Backspace', 'Ctrl+Scroll', '+', '-', '0', '[+]']) assert.ok(listed.has(k), `${k} is listed`);
  // The one-paragraph help is replaced by the panel.
  assert.doesNotMatch(editor, /toolDialog==='Editor help'/);
  assert.match(editor, /<UiDialog class="keys-dialog" :open="keysOpen" title="Keyboard shortcuts"/);
  assert.match(editor, /<section v-for="g in KEY_GROUPS"/);
});

test('every Help Center link is built by one helper, to the article page', () => {
  assert.equal(HELP_ARTICLE_BASE, '/dashboard/help-center/article/');
  assert.equal(helpArticle('label-editor-pan'), '/dashboard/help-center/article/label-editor-pan');
  assert.equal(helpArticle(''), '');
  const slugs = new Set(RAIL.map(t => t.slug).filter(Boolean));
  for (const slug of ['label-editor-pan', 'label-editor-box', 'label-editor-polygon', 'label-editor-brush', 'label-editor-rotate', 'label-editor-smart-select',
    'label-editor-label-assist', 'label-editor-box-to-outline', 'label-editor-ai-refine', 'label-editor-comments', 'label-editor-undo-redo', 'label-editor-no-objects'])
    assert.ok(slugs.has(slug), slug);
  assert.equal(MASKS_POLYGONS_SLUG, 'label-editor-masks-polygons');
  for (const [name, text] of [['editor', editor], ['card', card], ['assist', assist]]) assert.doesNotMatch(text, /help-center\/article/, `${name} builds no link itself`);
  assert.match(card, /const link = computed\(\(\) => helpArticle\(props\.entry\.slug\)\)/);
  assert.match(assist, /:href="helpArticle\(MASKS_POLYGONS_SLUG\)"/);
});

test('Rotate image turns the view only: a pointer on the turned photo maps back to the photo itself', () => {
  for (const q of [0, 1, 2, 3]) {
    for (const [a, b] of [[0, 0], [1, 0], [0.25, 0.75], [0.6, 0.1]]) {
      const [u, v] = rotate(a, b, q);
      const back = unrotate(u, v, q);
      assert.ok(Math.abs(back[0] - a) < 1e-9 && Math.abs(back[1] - b) < 1e-9, `quarter ${q} (${a}, ${b})`);
    }
  }
  assert.deepEqual(rotate(0, 0, 1), [1, 0]);                           // a quarter turn clockwise: the top-left goes top-right
  assert.deepEqual(unrotate(1, 0, 1), [0, 0]);
  assert.deepEqual(unrotate(0.5, 0.5, 3), [0.5, 0.5]);
  assert.deepEqual(unrotate(0.2, 0.3, 4), [0.2, 0.3]);                 // four turns: upright
  // A turned photo of 2:1 fits the area as 1:2; the photo itself keeps its own width and height.
  const size = viewSize({ w: 800, h: 600 }, 2, 100, 1);
  assert.deepEqual(size.shown, { w: 300, h: 600 });
  assert.deepEqual(size.stage, { w: 600, h: 300 });
  assert.deepEqual(viewSize({ w: 800, h: 600 }, 2, 200, 0).shown, { w: 1600, h: 800 });
  // The editor maps through unrotate and never stores a turned point.
  assert.match(editor, /const \[a,b\]=unrotate\(\(event\.clientX-r\.left\)\/r\.width,\(event\.clientY-r\.top\)\/r\.height,rotation\.value\)/);
  assert.doesNotMatch(editor, /Brush \/ mask painting|name:'Rotate image'.*coming soon/i);
});

test('zooming keeps the point under the pointer, within its bounds', () => {
  // A point 100 px right of the centre, with the photo moved 20 px: after doubling, the same point is under the pointer.
  const pan = { x: 20, y: -10 }, at = { x: 100, y: 50 };
  const next = zoomAt(pan, 100, 200, at);
  const before = { x: (at.x - pan.x) / 1, y: (at.y - pan.y) / 1 };           // the point, from the photo's centre, at 100 %
  assert.deepEqual({ x: next.x + before.x * 2, y: next.y + before.y * 2 }, at);
  assert.deepEqual(zoomAt({ x: 0, y: 0 }, 100, 150), { x: 0, y: 0 });      // the buttons zoom at the centre
  assert.ok(wheelZoom(100, -100) > 100 && wheelZoom(100, 100) < 100);
  assert.equal(clampZoom(1), ZOOM_MIN); assert.equal(clampZoom(10000), ZOOM_MAX);
  // The lock keeps zoom and position for the next photo; without it they start afresh.
  assert.match(editor, /if\(!viewLock\.value\)\{zoom\.value=100;pan\.value=\{x:0,y:0\};\}rotation\.value=0;/);
  assert.match(editor, /@wheel="onWheel"/);
  assert.match(editor, /if\(event\.ctrlKey\|\|event\.metaKey\)\{setZoom\(wheelZoom\(zoom\.value,event\.deltaY\),fromCentre\(event\)\);return;\}/);
});

test('the crosshair follows the pointer for the drawing tools only', () => {
  assert.deepEqual([...CROSSHAIR_TOOLS].sort(), ['box', 'brush', 'eraser', 'outline', 'polygon', 'smart']);
  assert.match(editor, /<div v-if="cross&&crossOn" class="crosshair" aria-hidden="true">/);
  assert.match(editor, /\.crosshair-x\{left:0;right:0;height:1px/);
  assert.match(editor, /\.crosshair-y\{top:0;bottom:0;width:1px/);
});

test('the classes in this photo are counted and the rest are unused; a stray class is still counted', () => {
  const classes = [{ name: 'chair', color: '#ef4444' }, { name: 'plant', color: '#0ea5e9' }, { name: 'lamp', color: '#84cc16' }];
  const shapes = [{ kind: 'chair' }, { kind: 'chair' }, { kind: 'plant' }, { kind: 'rug' }];
  const use = classUse(shapes, classes);
  assert.deepEqual(use.inPhoto.map(c => [c.name, c.count]), [['chair', 2], ['plant', 1], ['rug', 1]]);
  assert.deepEqual(use.unused.map(c => c.name), ['lamp']);
  assert.deepEqual(classUse([], []), { inPhoto: [], unused: [] });
});

test('a layer moves one place, never past the ends', () => {
  const s = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(moveLayer(s, 1, 1).map(x => x.id), [2, 1, 3]);
  assert.deepEqual(moveLayer(s, 3, -1).map(x => x.id), [1, 3, 2]);
  assert.equal(moveLayer(s, 3, 1), s);
  assert.equal(moveLayer(s, 1, -1), s);
  assert.equal(moveLayer(s, 9, 1), s);
});

test('an answer is shown the way chosen: masks or polygons, from shapes and other alike (C3, C4)', () => {
  const mask = { kind: 'chair', mask: { size: [800, 1200], counts: 'abc' } };
  const poly = { kind: 'chair', points: [[1, 1], [2, 1], [2, 2]] };
  assert.deepEqual(pickWay([mask], [poly], 'masks'), [mask]);
  assert.deepEqual(pickWay([mask], [poly], 'polygons'), [poly]);
  assert.deepEqual(pickWay([poly], undefined, 'polygons'), [poly]);
  assert.deepEqual(pickWay([poly], [], 'masks'), []);
  assert.equal(appliedWords(1), 'Applied 1 label');
  assert.equal(appliedWords(3), 'Applied 3 labels');
});

test('a mask shape keeps its photo pixels through the editor and back (C2)', () => {
  const sent = [{ kind: 'chair', mask: { size: [800, 1200], counts: 'PPYo1' }, score: 0.8 }, { kind: 'plant', points: [[0, 0], [1200, 0], [1200, 800]] }];
  const shapes = fromBackend(sent, 1200, 800);
  assert.deepEqual(shapes[0].mask, sent[0].mask);
  assert.equal(shapes[0].points, undefined);
  assert.equal(shapes[0].score, 0.8);
  assert.deepEqual(toBackend(shapes, 1200, 800), [{ kind: 'chair', mask: sent[0].mask }, { kind: 'plant', points: [[0, 0], [1200, 0], [1200, 800]] }]);
});

test('Smart Select and Box to outline: add, remove, keep, drop; the box goes in photo pixels', () => {
  assert.match(editor, /if\(tool\.value==='smart'\)\{addSamPoint\(at,event\.shiftKey\|\|event\.button===2\?0:1\);return;\}/);
  assert.match(editor, /@contextmenu="tool==='smart'&&\$event\.preventDefault\(\)"/);
  assert.match(editor, /if\(key==='Enter'&&\(tool\.value==='smart'\|\|tool\.value==='outline'\)&&samKept\.value\.length\)\{event\.preventDefault\(\);applySam\(\);return;\}/);
  assert.match(editor, /if\(tool\.value==='outline'\)\{sam\.outline\(\[c\[0\]\[0\],c\[0\]\[1\],c\[2\]\[0\],c\[2\]\[1\]\]\);return;\}/);
  assert.match(sam, /request\(captured\.project, captured\.photo, captured\.name, selected, pixelBox\)/);
  assert.match(api, /segmentPoint: \(ref, photo, name, points, box = null, hover = false\) =>/);
});

test('Label Assist: tabs from the source\'s own tab, the classes as chips, the same detect path, and Undo in one step', () => {
  assert.match(assist, /const tabSources = computed\(\(\) => props\.sources\.filter\(s => s\.tab === tab\.value\)\)/);
  assert.match(assist, /\{ id: 'ai', name: 'AI models' \}, \{ id: 'yours', name: 'Your models' \}, \{ id: 'published', name: 'Published models' \}/);
  assert.match(assist, /<ModelSourcePicker v-if="tabSources\.length" v-model="pick" :sources="tabSources" inline :disabled="busy"\/>/);
  assert.match(assist, /askedClasses\(props\.projectRef, names\.value\)/);
  assert.doesNotMatch(assist, /['"]wall['"],\s*['"]window['"]/);
  assert.match(editor, /runDetect\(source,null,null,asked\);/);
  assert.match(editor, /appliedWords\(applied\.count\) \}\} · <\/span><button type="button" class="link-button" @click="undoApplied">Undo<\/button>/);
  assert.match(editor, /if\(history\.value\.length!==a\.step\)/);
});

test('Add to Dataset and Send to Unannotated run only from the app\'s own dialogs', () => {
  const template = editor.slice(editor.indexOf('<template>'));
  for (const fn of ['addToDatasetLive', 'sendToUnannotatedLive']) {
    const clicks = [...template.matchAll(new RegExp(`@click="${fn}"`, 'g'))].map(m => m.index);
    assert.ok(clicks.length > 0, fn);
    const dialogs = [...template.matchAll(/<UiDialog\b[\s\S]*?<\/UiDialog>/g)].map(m => [m.index, m.index + m[0].length]);
    for (const at of clicks) assert.ok(dialogs.some(([a, b]) => at > a && at < b), `${fn} runs only from a dialog`);
  }
  assert.match(editor, /action:'add_to_dataset'/);
  // Offered only when the editor's answer says this person may; the server checks again on the call.
  assert.match(editor, /const mayAddToDataset=computed\(\(\)=>!!\(live\.value&&meta\.value\?\.can_add_to_dataset===true\)\)/);
  assert.match(editor, /const maySendToUnannotated=computed\(\(\)=>!!\(live\.value&&meta\.value\?\.can_send_to_unannotated===true\)\)/);
  assert.match(editor, /if\(body\?\.closed\|\|!scopedImages\.value\.length\)\{emit\('close'\);return;\}/);
  assert.match(api, /sendToUnannotated: \(ref, photo\) => json\(`\$\{base\(ref\)\}\/photos\/\$\{enc\(photo\)\}\/send-to-unannotated\/`, 'POST', \{\}\)/);
});

test('the words: sentence case, notification, balance; no native dialog; our own pictures', () => {
  for (const [name, text] of [['editor', editor], ['assist', assist], ['card', card], ['tools', tools], ['sam', sam]]) {
    assert.doesNotMatch(text, /\bcredits?\b/i, `${name}: say balance`);
    assert.doesNotMatch(text, /\bnotice\b/i, `${name}: say notification`);
    assert.doesNotMatch(text, /(?<![.\w])(confirm|alert|prompt)\(|window\.(confirm|alert|prompt)\(/, `${name}: no native dialog`);
  }
  assert.doesNotMatch(art, /<image\b|href=|url\(http/);                 // drawn inline, nothing fetched
  assert.match(art, /@media \(prefers-reduced-motion: reduce\)/);
  // Brush and Rotate image are no longer "Coming soon" placeholders.
  assert.doesNotMatch(editor, /entry\.name\+' - coming soon'|pendingTool\(entry\.name\)/);
});

test('AI refine on a mask: the answer of the same class with the best pixel overlap, a polygon filled first, 0.3 at least', () => {
  const W = 40, H = 30;
  const rect = (x0, y0, x1, y1) => { const d = new Uint8Array(W * H); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d[y * W + x] = 1; return encode(d, H, W); };
  const mine = rect(5, 5, 15, 15);
  const near = rect(6, 5, 16, 15), far = rect(25, 15, 35, 25);
  const best = bestMaskMatch(mine, [{ kind: 'sofa', mask: far }, { kind: 'sofa', mask: near }, { kind: 'lamp', mask: mine }], 'sofa');
  assert.deepEqual(best.mask, near);
  assert.ok(Math.abs(best.share - 90 / 110) < 1e-9);                        // 90 shared pixels of 110 in either
  const filled = bestMaskMatch(mine, [{ kind: 'sofa', points: [[5, 5], [15, 5], [15, 15], [5, 15]] }], 'sofa');
  assert.deepEqual(filled.mask, mine);
  assert.equal(filled.share, 1);
  assert.equal(bestMaskMatch(mine, [{ kind: 'sofa', mask: far }, { kind: 'lamp', mask: mine }], 'sofa'), null);
  assert.equal(bestMaskMatch(mine, [{ kind: 'sofa', mask: rect(12, 5, 22, 15) }], 'sofa'), null);   // 30 of 170: below 0.3
  assert.equal(bestMaskMatch(mine, [{ kind: 'sofa', mask: encode(new Uint8Array(20 * 10).fill(1), 10, 20) }], 'sofa'), null);   // another size
});
