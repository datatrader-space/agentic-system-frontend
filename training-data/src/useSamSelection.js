import { ref } from 'vue';

// Smart Select and Box to outline (agentic-docs/LABEL_EDITOR_TOOLS_PLAN.md 2.2 and contract C4). The first click is on
// the object; later clicks add an area (label 1) or remove one (label 0: Shift-click or right-click). ``outline`` asks
// with a drawn box instead. Every answer is a candidate: nothing is added to the label until the editor keeps it (Enter).
// A generation token rejects late responses.
// SAM 3 is a ready-to-use model AADML hosts: no place is sent with a click (a call naming one is refused). ``why`` is
// the reason the editor gives when SAM 3 cannot be asked now (AADML is not running it, or it takes no clicks).
// ``candidate`` is the answer's ``shapes``; ``other`` its ``other`` (the same object the other way, C3), so the
// Polygons / Masks switch shows either without asking again.
//
// Hover (agentic-docs/SMART_SELECT_HOVER_PLAN.md): before the first click, the object under the mouse is asked for after
// the mouse rests HOVER_MS, and only the newest answer is kept (``hovered``: its shapes, ``hoveredOther``: the other
// way). A photo is paid for once a session (the answer says ``charged``); hovers and clicks on it are free after.
export const HOVER_MS = 120;
export function useSamSelection(context, request) {
  const points = ref([]), box = ref(null), candidate = ref([]), other = ref([]), working = ref(false), message = ref('');
  const hovered = ref([]), hoveredOther = ref([]), paid = ref(false);
  let generation = 0, timer = null, hoverGeneration = 0, hoverTimer = null;
  function stopHover() { hoverGeneration++; clearTimeout(hoverTimer); hoverTimer = null; hovered.value = []; hoveredOther.value = []; }
  function clear() { generation++; clearTimeout(timer); timer = null; stopHover(); points.value = []; box.value = null; candidate.value = []; other.value = []; working.value = false; message.value = ''; }
  function noteCharge(body, captured) {
    if (body.charged && !paid.value) { paid.value = true; message.value = `This photo is ready for Smart Select${captured.price ? `, charged ${captured.price} once` : ''}: hovering and clicking on it are free for a while.`; }
  }
  async function run(version, selected, pixelBox, captured) {
    try {
      const body = pixelBox ? await request(captured.project, captured.photo, captured.name, selected, pixelBox)
        : await request(captured.project, captured.photo, captured.name, selected);
      if (version !== generation) return;
      if (body.state === 'waiting') {
        message.value = `${body.title || 'Getting SAM 3 ready'}: ${body.now || 'starting'}`;
        timer = setTimeout(() => run(version, selected, pixelBox, captured), 4000); return;
      }
      noteCharge(body, captured);
      candidate.value = body.shapes || [];
      other.value = body.other || [];
      message.value = candidate.value.length || other.value.length
        ? 'Check the outline. Click to add an area, Shift-click to remove one; Enter keeps it, Esc drops it.'
        : 'SAM 3 found no object here. Click on the object again, or press Esc to start over.';
      working.value = false;
    } catch (error) { if (version === generation) { working.value = false; message.value = error.message; } }
  }
  function blocked(captured) {
    if (!captured.name) { message.value = 'Select a project class first.'; return true; }
    if (!captured.allowed) { message.value = captured.why || 'SAM 3 cannot outline this photo now.'; return true; }
    return working.value;
  }
  const toPixels = (captured, [x, y]) => [x * captured.width / 600, y * captured.height / 300];
  function ask(captured) {
    candidate.value = []; other.value = []; working.value = true;
    message.value = 'SAM 3 is outlining this object…';
    const selected = { coords: points.value.map(p => toPixels(captured, p.point)), labels: points.value.map(p => p.label) };
    const pixelBox = box.value ? [...toPixels(captured, box.value.slice(0, 2)), ...toPixels(captured, box.value.slice(2))] : null;
    run(++generation, selected, pixelBox, captured);
  }
  // The object under the mouse, before any click: asked once the mouse rests, never while a selection is being made.
  function hover(point) {
    clearTimeout(hoverTimer);
    if (points.value.length || box.value || working.value) return;
    const captured = context();
    if (!captured.name || !captured.allowed) return;
    hoverTimer = setTimeout(async () => {
      const version = ++hoverGeneration;
      try {
        const body = await request(captured.project, captured.photo, captured.name,
          { coords: [toPixels(captured, point)], labels: [1] }, null, true);
        if (version !== hoverGeneration || points.value.length || box.value) return;
        noteCharge(body, captured);
        hovered.value = body.shapes || [];
        hoveredOther.value = body.other || [];
      } catch { if (version === hoverGeneration) { hovered.value = []; hoveredOther.value = []; } }
    }, HOVER_MS);
  }
  function add(point, label = 1) {
    const captured = context();
    if (blocked(captured)) return;
    stopHover();
    if (!points.value.length && !box.value && label === 0) { message.value = 'Start with a click on the object.'; return; }
    if (points.value.length >= 32) { message.value = 'Use up to 32 points per object. Keep or drop this selection first.'; return; }
    points.value.push({ point: [...point], label });
    ask(captured);
  }
  // A box drawn around one object, in editor units [x1, y1, x2, y2]: a new box starts a new selection.
  function outline(corners) {
    const captured = context();
    if (blocked(captured)) return;
    stopHover();
    const [x1, y1, x2, y2] = corners;
    points.value = []; box.value = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
    ask(captured);
  }
  function retry() { const last = points.value.pop(); if (last) add(last.point, last.label); else if (box.value) outline(box.value); }
  return { points, box, candidate, other, working, message, add, outline, clear, retry, hover, stopHover, hovered, hoveredOther };
}
