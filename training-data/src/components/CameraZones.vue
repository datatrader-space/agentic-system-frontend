<script setup>
// A camera's zones, privacy masks and lines (SMART_CAMERA_AI_PLAN.md Phase A; backend camera_zones_api.py), the Zones
// tab of the camera's page. Drawn by clicking points on the camera's newest frame: a zone or a mask takes 3 or more, a
// line 2. A privacy mask is painted black on every frame before any model, the ready detector or an event's snapshot
// sees it; a zone lets a rule count only what is inside it ("person seen in Desk 1"). Listed to anyone who may see the
// workspace's cameras, changed by its camera managers (the server checks; the page only offers).
import { computed, onMounted, ref, watch } from 'vue';
import { ImageOff, Plus, Trash2, Undo2 } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import { cameraZones, thumbnailOf, ZONE_KINDS, zonePoint, zoneProblems, zoneSvgPoints } from '../api/streaming.js';

const props = defineProps({ source: { type: Object, required: true } });
const emit = defineEmits(['changed']);

const page = ref(null); const loading = ref(false); const error = ref(''); const said = ref('');
const zones = computed(() => page.value?.zones || []);
const may = computed(() => !!page.value?.may?.change);
const anchors = computed(() => page.value?.anchors || [{ key: 'bottom', label: 'Where it stands (bottom middle)' }, { key: 'center', label: 'Its middle' }]);
const picture = computed(() => thumbnailOf(props.source));
const broken = ref(false);

async function load() {
  loading.value = true; error.value = '';
  try { page.value = await cameraZones.list(props.source.id); }
  catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
onMounted(load);
watch(() => props.source.id, () => { drawing.value = null; load(); });

// ── drawing a new shape ──
const drawing = ref(null);            // { kind, name, anchor, points }
const problems = ref({}); const busy = ref(false);
const board = ref(null);
function startDrawing(kind) {
  const taken = zones.value.filter(z => z.kind === kind).length;
  const base = { zone: 'Zone', mask: 'Privacy mask', line: 'Line' }[kind];
  drawing.value = { kind, name: `${base} ${taken + 1}`, anchor: 'bottom', points: [] };
  problems.value = {}; said.value = ''; error.value = '';
}
function addPoint(event) {
  const d = drawing.value;
  if (!d || !board.value) return;
  if (d.kind === 'line' && d.points.length >= 2) return;
  const box = board.value.getBoundingClientRect();
  d.points = [...d.points, zonePoint(event.clientX - box.left, event.clientY - box.top, box.width, box.height)];
}
function undoPoint() { if (drawing.value) drawing.value.points = drawing.value.points.slice(0, -1); }
async function call(work) {
  busy.value = true; error.value = '';
  try { const answer = await work(); page.value = answer; said.value = answer?.said || ''; emit('changed'); return true; }
  catch (e) {
    if (e.field && ['name', 'points', 'anchor', 'kind'].includes(e.field)) problems.value = { ...problems.value, [e.field]: e.message };
    else error.value = e.message;
    return false;
  } finally { busy.value = false; }
}
async function save() {
  const d = drawing.value;
  problems.value = zoneProblems(d);
  if (Object.keys(problems.value).length || busy.value) return;
  const body = { name: d.name.trim(), kind: d.kind, points: d.points, ...(d.kind === 'zone' ? { anchor: d.anchor } : {}) };
  if (await call(() => cameraZones.add(props.source.id, body))) drawing.value = null;
}
const setAnchor = (zone, anchor) => call(() => cameraZones.update(props.source.id, zone.id, { anchor }));
const remove = zone => call(() => cameraZones.remove(props.source.id, zone.id));
const kindLabel = key => ZONE_KINDS.find(k => k.key === key)?.label || key;
const kindHelp = key => ZONE_KINDS.find(k => k.key === key)?.help || '';
</script>

<template>
  <div class="cz">
    <p class="cz-muted">Draw on the camera's picture. A <strong>privacy mask</strong> is painted black before anything reads the frame, so what is under it never leaves AADML's server. A <strong>zone</strong> lets a rule count only what is inside it, for example "person seen in Desk 1".</p>
    <div class="cz-board-wrap">
      <div ref="board" class="cz-board" :class="{ drawing: !!drawing }" @click="addPoint">
        <img v-if="picture && !broken" :src="picture" :alt="`Newest frame from ${source.name}`" referrerpolicy="no-referrer" draggable="false" @error="broken = true">
        <span v-else class="cz-none"><ImageOff :size="22" aria-hidden="true"/><small>No frame yet. Check the camera first, then draw on its picture.</small></span>
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <template v-for="z in zones" :key="z.id">
            <polyline v-if="z.kind === 'line'" :points="zoneSvgPoints(z.points)" class="cz-line"/>
            <polygon v-else :points="zoneSvgPoints(z.points)" :class="z.kind === 'mask' ? 'cz-mask' : 'cz-zone'"/>
          </template>
          <template v-if="drawing">
            <polyline v-if="drawing.kind === 'line' || drawing.points.length < 3" :points="zoneSvgPoints(drawing.points)" class="cz-draft"/>
            <polygon v-else :points="zoneSvgPoints(drawing.points)" class="cz-draft"/>
            <circle v-for="(p, i) in drawing.points" :key="i" :cx="p[0] * 1000" :cy="p[1] * 1000" r="9" class="cz-dot"/>
          </template>
        </svg>
      </div>
    </div>

    <form v-if="drawing" class="cz-form" @submit.prevent="save">
      <p class="cz-muted"><strong>{{ kindLabel(drawing.kind) }}:</strong> {{ kindHelp(drawing.kind) }} Click {{ drawing.kind === 'line' ? 'two points' : 'its corners' }} on the picture.</p>
      <div class="cz-fields">
        <label>Name
          <input v-model="drawing.name" class="text-input" maxlength="60" :aria-invalid="!!problems.name">
          <small v-if="problems.name" class="field-error">{{ problems.name }}</small>
        </label>
        <label v-if="drawing.kind === 'zone'">Count an object by
          <select v-model="drawing.anchor" class="text-input">
            <option v-for="a in anchors" :key="a.key" :value="a.key">{{ a.label }}</option>
          </select>
        </label>
      </div>
      <p class="cz-muted" role="status">{{ drawing.points.length }} point{{ drawing.points.length === 1 ? '' : 's' }}</p>
      <p v-if="problems.points" class="field-error" role="alert">{{ problems.points }}</p>
      <span class="cz-acts">
        <UiButton type="submit" variant="primary" class="small" :disabled="busy">Save</UiButton>
        <UiButton type="button" class="small" :disabled="busy || !drawing.points.length" @click="undoPoint"><Undo2 :size="13" aria-hidden="true"/> Undo point</UiButton>
        <UiButton type="button" class="small" :disabled="busy" @click="drawing = null">Cancel</UiButton>
      </span>
    </form>
    <span v-else-if="may" class="cz-acts">
      <UiButton class="small" @click="startDrawing('zone')"><Plus :size="13" aria-hidden="true"/> Zone</UiButton>
      <UiButton class="small" @click="startDrawing('mask')"><Plus :size="13" aria-hidden="true"/> Privacy mask</UiButton>
      <UiButton class="small" @click="startDrawing('line')"><Plus :size="13" aria-hidden="true"/> Line</UiButton>
    </span>

    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p v-else-if="said" class="cz-muted" role="status">{{ said }}</p>
    <p v-if="loading && !page" class="cz-muted" role="status">Loading the zones…</p>
    <p v-else-if="page && !zones.length && !drawing" class="cz-muted">{{ may ? 'No zones or masks yet.' : 'No zones or masks yet. A camera manager of this workspace draws them.' }}</p>
    <ul v-if="zones.length" class="cz-list" aria-label="Zones, masks and lines">
      <li v-for="z in zones" :key="z.id">
        <span class="cz-swatch" :class="z.kind" aria-hidden="true"></span>
        <span class="cz-text"><strong>{{ z.name }}</strong><small>{{ z.kind_label || kindLabel(z.kind) }} · {{ z.points.length }} points</small></span>
        <select v-if="z.kind === 'zone' && may" class="text-input cz-anchor" :value="z.anchor" :disabled="busy" :aria-label="`How ${z.name} counts an object`" @change="setAnchor(z, $event.target.value)">
          <option v-for="a in anchors" :key="a.key" :value="a.key">{{ a.label }}</option>
        </select>
        <UiButton v-if="may" class="small sp-danger" :disabled="busy" :aria-label="`Remove ${z.name}`" @click="remove(z)"><Trash2 :size="13" aria-hidden="true"/></UiButton>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cz{display:grid;gap:10px}
.cz-muted{margin:0;font-size:13px;color:#5f6d82}
.cz-board-wrap{width:100%}
.cz-board{position:relative;width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#0f172a;user-select:none}
.cz-board.drawing{cursor:crosshair}
.cz-board img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}
.cz-board svg{position:absolute;inset:0;width:100%;height:100%}
.cz-none{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:6px;color:#cbd5e1;text-align:center;padding:16px}
.cz-zone{fill:rgba(37,99,235,.22);stroke:#2563eb;stroke-width:4}
.cz-mask{fill:#000;stroke:#f59e0b;stroke-width:4}
.cz-line{fill:none;stroke:#16a34a;stroke-width:8}
.cz-draft{fill:rgba(250,204,21,.18);stroke:#facc15;stroke-width:5;stroke-dasharray:14 8}
.cz-dot{fill:#facc15;stroke:#0f172a;stroke-width:3}
.cz-form{display:grid;gap:8px;padding:12px;border:1px solid #eef1f5;border-radius:10px;background:#f8fafc}
.cz-fields{display:flex;flex-wrap:wrap;gap:10px}
.cz-fields label{display:grid;gap:4px;font-size:13px;font-weight:600;color:#33415a;min-width:180px;flex:1}
.cz-acts{display:flex;flex-wrap:wrap;gap:6px}
.cz-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.cz-list li{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #eef1f5;border-radius:10px}
.cz-text{display:grid;flex:1;min-width:0}
.cz-text small{color:#5f6d82}
.cz-swatch{width:14px;height:14px;border-radius:4px;flex:none}
.cz-swatch.zone{background:#2563eb}
.cz-swatch.mask{background:#000;outline:2px solid #f59e0b}
.cz-swatch.line{background:#16a34a}
.cz-anchor{max-width:220px}
</style>
