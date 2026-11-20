import { ref } from 'vue';

// Clicks request a candidate, never mutate annotations. A generation token rejects late responses.
// SAM 3 is a ready-to-use model AADML hosts: no place is sent with a click (a call naming one is refused). ``why`` is
// the reason the editor gives when SAM 3 cannot be asked now (AADML is not running it, or has not priced it).
export function useSamSelection(context, request) {
  const points = ref([]), candidate = ref([]), working = ref(false), message = ref('');
  let generation = 0, timer = null;
  function clear() { generation++; clearTimeout(timer); timer = null; points.value = []; candidate.value = []; working.value = false; message.value = ''; }
  async function run(version, selected, captured) {
    try {
      const body = await request(captured.project, captured.photo, captured.name, selected);
      if (version !== generation) return;
      if (body.state === 'waiting') {
        message.value = `${body.title || 'Getting SAM 3 ready'}: ${body.now || 'starting'}`;
        timer = setTimeout(() => run(version, selected, captured), 4000); return;
      }
      candidate.value = body.shapes || [];
      message.value = candidate.value.length ? 'Review the outline. Add include/exclude clicks, then apply it.' : 'SAM 3 found no outline here. Add another include point or start again.';
      working.value = false;
    } catch (error) { if (version === generation) { working.value = false; message.value = error.message; } }
  }
  function add(point, label = 1) {
    const captured = context();
    if (!captured.name) { message.value = 'Select a project class first.'; return; }
    if (!captured.allowed) { message.value = captured.why || 'SAM 3 cannot outline this photo now.'; return; }
    if (working.value) return;
    if (!points.value.length && label === 0) { message.value = 'Start with an include point on the object.'; return; }
    if (points.value.length >= 32) { message.value = 'Use up to 32 points per object. Apply or discard this selection first.'; return; }
    points.value.push({ point: [...point], label }); candidate.value = []; working.value = true;
    message.value = 'SAM 3 is outlining this object…';
    const selected = { coords: points.value.map(p => [p.point[0] * captured.width / 600, p.point[1] * captured.height / 300]), labels: points.value.map(p => p.label) };
    run(++generation, selected, captured);
  }
  function retry() { const last = points.value.pop(); if (last) add(last.point, last.label); }
  return { points, candidate, working, message, add, clear, retry };
}
