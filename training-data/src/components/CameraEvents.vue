<script setup>
// Every camera event of the workspace, searched (SMART_CAMERA_AI_PLAN.md Phase E; backend camera_search.py): plain
// words ("empty desk", "forklift at the gate"), matched by meaning when AADML's embedder runs and as text always;
// filters (camera, class, a time range in Pakistan time, unusual only); Find similar; the timeline of every camera.
// A snapshot is shown through its 15-minute link; nothing here changes an event.
import { computed, onMounted, ref } from 'vue';
import { ImageOff, RefreshCw, Search, Sparkles } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import { cameraEvents, eventTime, matchedText, timelineDots } from '../api/streaming.js';

const q = ref(''); const camera = ref(''); const klass = ref(''); const since = ref(''); const until = ref('');
const unusual = ref(false);
const page = ref(null); const loading = ref(false); const error = ref(''); const similarOf = ref(null);
const events = computed(() => page.value?.events || []);
const cameras = ref([]);
const line = ref(null);

function params(p = 1) {
  return { q: q.value.trim(), camera: camera.value, class: klass.value.trim(), since: since.value, until: until.value,
    unusual: unusual.value, page: p };
}
async function run(p = 1) {
  loading.value = true; error.value = ''; similarOf.value = null;
  try {
    page.value = await cameraEvents.search(params(p));
    if (page.value?.cameras) cameras.value = page.value.cameras;
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
async function similar(e) {
  loading.value = true; error.value = '';
  try { const answer = await cameraEvents.similar(e.id); page.value = { events: answer?.events || [], count: (answer?.events || []).length, page: 1, pages: 1 }; similarOf.value = e; }
  catch (err) { error.value = err.message; }
  finally { loading.value = false; }
}
async function loadTimeline() {
  try { line.value = await cameraEvents.timeline({ since: since.value, until: until.value }); }
  catch (e) { error.value = e.message; }
}
onMounted(() => { run(1); loadTimeline(); });
const dots = computed(() => timelineDots(line.value));
</script>

<template>
  <section class="ce" aria-label="Camera events">
    <form class="ce-bar" role="search" @submit.prevent="run(1); loadTimeline()">
      <label class="ce-q"><Search :size="15" aria-hidden="true"/><input v-model="q" class="text-input" maxlength="200" placeholder="Search in plain words: empty desk, forklift at the gate" aria-label="Search the events"></label>
      <select v-model="camera" class="text-input" aria-label="Camera"><option value="">All cameras</option><option v-for="c in cameras" :key="c.id" :value="String(c.id)">{{ c.name }}</option></select>
      <input v-model="klass" class="text-input ce-small" maxlength="64" placeholder="Class" aria-label="Class">
      <label class="ce-when">From <input v-model="since" class="text-input" type="datetime-local"></label>
      <label class="ce-when">To <input v-model="until" class="text-input" type="datetime-local"></label>
      <label class="ce-check"><input v-model="unusual" type="checkbox"> Unusual only</label>
      <UiButton type="submit" variant="primary" class="small" :disabled="loading"><RefreshCw :size="13" aria-hidden="true"/> Search</UiButton>
    </form>
    <p class="ce-muted">Times are Pakistan time. <template v-if="page && page.meaning_available === false">Words match as text only right now.</template><template v-else-if="page && page.by_meaning">Closest in meaning first.</template></p>

    <div v-if="dots.length" class="ce-line" aria-label="Timeline of every camera">
      <div v-for="c in dots" :key="c.id" class="ce-row">
        <span class="ce-row-name">{{ c.name }}</span>
        <span class="ce-strip"><span v-for="d in c.dots" :key="d.id" class="ce-dot" :class="{ unusual: d.unusual }" :style="{ left: `${d.left}%` }" :title="`${d.rule} · ${d.when}`"></span></span>
      </div>
    </div>

    <p v-if="similarOf" class="ce-muted" role="status"><Sparkles :size="13" aria-hidden="true"/> Events like "{{ similarOf.rule.text }}" on {{ similarOf.camera?.name }}. <button type="button" class="ce-link" @click="run(1)">Back to the search</button></p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="loading && !events.length" class="ce-muted" role="status">Searching…</p>
    <p v-else-if="page && !events.length" class="ce-muted" role="status">No event matches.</p>
    <ul v-if="events.length" class="ce-list" aria-label="Events">
      <li v-for="e in events" :key="e.id">
        <img v-if="e.snapshot_url" :src="e.snapshot_url" :alt="`Frame of ${e.camera?.name} when ${e.rule.text}`" referrerpolicy="no-referrer" loading="lazy">
        <span v-else class="ce-none"><ImageOff :size="18" aria-hidden="true"/></span>
        <span class="ce-text"><strong>{{ e.rule.text }}<span v-if="e.unusual" class="ce-tag">Unusual</span></strong>
          <small>{{ e.camera?.name }} · {{ eventTime(e) }}<template v-if="matchedText(e)"> · {{ matchedText(e) }}</template></small>
          <small v-if="e.ai && e.ai.text">AI: {{ e.ai.text }}</small></span>
        <UiButton class="small" :disabled="loading" @click="similar(e)">Find similar</UiButton>
      </li>
    </ul>
    <div v-if="page && page.pages > 1 && !similarOf" class="ce-pager">
      <UiButton class="small" :disabled="loading || page.page <= 1" @click="run(page.page - 1)">Previous</UiButton>
      <span class="ce-muted">Page {{ page.page }} of {{ page.pages }} · {{ page.count }} events</span>
      <UiButton class="small" :disabled="loading || page.page >= page.pages" @click="run(page.page + 1)">Next</UiButton>
    </div>
  </section>
</template>

<style scoped>
.ce{display:grid;gap:12px;margin-top:12px}
.ce-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ce-q{display:flex;align-items:center;gap:6px;flex:1 1 280px}
.ce-q input{flex:1}
.ce-small{max-width:140px}
.ce-when{display:flex;align-items:center;gap:4px;font-size:13px;color:#33415a}
.ce-check{display:flex;align-items:center;gap:6px;font-size:13px;color:#33415a}
.ce-muted{margin:0;font-size:13px;color:#5f6d82}
.ce-link{border:0;background:none;padding:0;color:var(--aadml-primary);font:inherit;text-decoration:underline;cursor:pointer}
.ce-line{display:grid;gap:4px;padding:10px;border:1px solid #eef1f5;border-radius:10px}
.ce-row{display:grid;grid-template-columns:140px 1fr;gap:8px;align-items:center}
.ce-row-name{font-size:12px;color:#33415a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ce-strip{position:relative;height:14px;border-radius:7px;background:#f1f5f9}
.ce-dot{position:absolute;top:3px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:var(--aadml-primary)}
.ce-dot.unusual{background:#d97706}
.ce-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.ce-list li{display:flex;gap:10px;align-items:center;padding:8px;border:1px solid #eef1f5;border-radius:10px}
.ce-list img,.ce-none{width:96px;height:54px;object-fit:cover;border-radius:6px;background:#0f172a;display:grid;place-items:center;color:#94a3b8;flex:none}
.ce-text{display:grid;flex:1;min-width:0}
.ce-text small{color:#5f6d82}
.ce-tag{margin-left:6px;padding:1px 6px;border-radius:6px;background:#fef3c7;color:#92400e;font-size:11px}
.ce-pager{display:flex;gap:8px;align-items:center}
@media (max-width: 700px){.ce-row{grid-template-columns:90px 1fr}}
</style>
