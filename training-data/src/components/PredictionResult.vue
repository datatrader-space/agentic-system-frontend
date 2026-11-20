<script setup>
// What a model found on one photo, drawn on it: the verdict, what it found with its confidence, the figures and the
// answer as JSON. Used by a project's Test page and by trying a published model (WorkspaceModels).
// Two answers: a model that finds things by name (SAM 3, a model of a project's own classes) answers ``objects``
// ([{class, polygon, score}]) and every one is shown by its class, none taken for a wall because of its name; a
// FitMyWall walls model answers its own format (``walls`` with corners, ``openings`` inside them).
// ``least`` (0..1) hides what is below it here; the model is not asked again.
import { computed } from 'vue';
import { Images } from 'lucide-vue-next';
import UiBadge from './UiBadge.vue';
import { VERDICTS, filtered, middle, percent } from '../api/trial.js';

const props = defineProps({ answer: Object, photoUrl: String, asking: Boolean, least: { type: Number, default: 0 },
  waitingText: { type: String, default: 'Start the test server and choose a photo: what the model finds is drawn on it.' } });
const WALL_COLOURS = ['#2563eb', '#f59e0b', '#12b76a', '#c11574', '#7c3aed', '#0e9384', '#b54708', '#363f72'];

const byName = computed(() => Array.isArray(props.answer?.objects));
const shown = computed(() => {
  if (!byName.value) return filtered(props.answer, props.least);
  const all = props.answer.objects.filter(o => Array.isArray(o?.polygon) && o.polygon.length >= 3)
    .map(o => ({ type: String(o.class ?? ''), polygon: o.polygon, confidence: o.score ?? o.confidence ?? null }));
  const kept = all.filter(o => (o.confidence ?? 1) >= props.least);
  return { ...props.answer, objects: props.answer.objects.filter(o => (o?.score ?? o?.confidence ?? 1) >= props.least), walls: [], openings: kept, hidden: all.length - kept.length };
});
const OTHER_COLOURS = ['#0ea5e9', '#f97316', '#12b76a', '#c11574', '#7c3aed', '#0e9384', '#b54708'];
const named = computed(() => [...new Set([...(byName.value ? props.answer?.classes || [] : []), ...(shown.value?.openings || []).map(o => o.type)])]);
const colourOf = type => OTHER_COLOURS[Math.max(named.value.indexOf(type), 0) % OTHER_COLOURS.length];
const nameOf = type => (type ? `${type.charAt(0).toUpperCase()}${type.slice(1)}` : 'Unnamed');
const counts = computed(() => {
  const all = [...(byName.value ? [] : (shown.value?.walls || []).map(() => 'wall')), ...(shown.value?.openings || []).map(o => o.type)];
  return Object.entries(all.reduce((acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }), {})).map(([t, n]) => `${n} ${t}${n === 1 ? '' : 's'}`).join(', ');
});
const verdict = computed(() => {
  if (byName.value) {
    const asked = (props.answer.classes || []).join(', ');
    return counts.value ? ['green', 'Found', `Found ${counts.value}.`] : ['neutral', 'Nothing found', `The model found none of: ${asked || 'what you named'}.`];
  }
  return VERDICTS[props.answer?.status] || ['neutral', props.answer?.status || '', ''];
});
const othersLabel = computed(() => (byName.value ? 'Found' : 'Openings'));
const asJson = computed(() => (byName.value ? { ...shown.value, walls: undefined, openings: undefined, hidden: undefined } : { ...shown.value, hidden: undefined }));
const box = computed(() => (props.answer ? `0 0 ${props.answer.image.width} ${props.answer.image.height}` : '0 0 1 1'));
const dot = computed(() => (props.answer ? Math.max(props.answer.image.width, props.answer.image.height) / 150 : 1));
const font = computed(() => (props.answer ? Math.max(props.answer.image.width, props.answer.image.height) / 48 : 1));
const pointsOf = points => points.map(p => p.join(',')).join(' ');
const seconds = ms => (ms === null || ms === undefined ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
</script>

<template>
  <div v-if="!answer" class="empty-state">
    <Images :size="40"/>
    <h3>{{ asking ? 'The model is looking at the photo…' : 'Ready when you are' }}</h3>
    <p>{{ asking ? 'This can take a few seconds on this server.' : waitingText }}</p>
  </div>
  <template v-else>
    <p class="verdict"><UiBadge :tone="verdict[0]">{{ verdict[1] }}</UiBadge><span>{{ verdict[2] }}</span></p>
    <div class="stage">
      <img :src="photoUrl" alt="The photo you chose, with what the model found drawn on it">
      <svg :viewBox="box" preserveAspectRatio="none" aria-hidden="true">
        <g v-for="(wall, i) in shown.walls" :key="'w'+i">
          <polygon :points="pointsOf(wall.corners)" :fill="WALL_COLOURS[i%WALL_COLOURS.length]" fill-opacity=".18" :stroke="WALL_COLOURS[i%WALL_COLOURS.length]" stroke-width="3" vector-effect="non-scaling-stroke" :stroke-dasharray="wall.below_threshold?'8 6':null"/>
          <circle v-for="(c, j) in wall.corners" :key="j" :cx="c[0]" :cy="c[1]" :r="dot" fill="#fff" :stroke="WALL_COLOURS[i%WALL_COLOURS.length]" stroke-width="2" vector-effect="non-scaling-stroke"/>
          <text :x="middle(wall.corners)[0]" :y="middle(wall.corners)[1]" :font-size="font" text-anchor="middle" fill="#fff" stroke="#162139" stroke-width="3" paint-order="stroke" vector-effect="non-scaling-stroke">Wall {{ i+1 }} · {{ percent(wall.confidence) }}</text>
        </g>
        <g v-for="(o, i) in shown.openings" :key="'o'+i">
          <polygon :points="pointsOf(o.polygon)" :fill="byName ? colourOf(o.type) : 'none'" :fill-opacity="byName ? .14 : null" :stroke="colourOf(o.type)" stroke-width="3" vector-effect="non-scaling-stroke"/>
          <text v-if="byName" :x="middle(o.polygon)[0]" :y="middle(o.polygon)[1]" :font-size="font" text-anchor="middle" fill="#fff" stroke="#162139" stroke-width="3" paint-order="stroke" vector-effect="non-scaling-stroke">{{ nameOf(o.type) }} · {{ percent(o.confidence) }}</text>
        </g>
      </svg>
    </div>
    <dl class="facts">
      <div v-if="!byName"><dt>Walls</dt><dd>{{ shown.walls.length }}</dd></div>
      <div><dt>{{ othersLabel }}</dt><dd>{{ shown.openings.length }}</dd></div>
      <div><dt>Model time</dt><dd>{{ seconds(answer.timing_ms?.model) }}</dd></div>
      <div><dt>Whole answer</dt><dd>{{ seconds(answer.timing_ms?.total) }}</dd></div>
    </dl>
    <p v-if="shown.hidden" class="test-meta">{{ shown.hidden }} found below {{ percent(least) }} {{ shown.hidden===1?'is':'are' }} hidden by the slider.</p>
    <div v-if="shown.walls.length||shown.openings.length" class="table-wrap">
      <table><thead><tr><th>Found</th><th>Confidence</th><th>Corners</th></tr></thead>
        <tbody>
          <tr v-for="(wall, i) in shown.walls" :key="'w'+i"><td><span class="swatch" :style="{background:WALL_COLOURS[i%WALL_COLOURS.length]}"></span>Wall {{ i+1 }}{{ wall.below_threshold ? ' (not sure)' : '' }}</td><td>{{ percent(wall.confidence) }}</td><td>{{ wall.corners.length }}</td></tr>
          <tr v-for="(o, i) in shown.openings" :key="'o'+i"><td><span class="swatch" :style="{background:colourOf(o.type)}"></span>{{ nameOf(o.type) }}</td><td>{{ percent(o.confidence) }}</td><td>{{ o.polygon.length }}</td></tr>
        </tbody></table>
    </div>
    <p v-if="answer.warnings?.length" class="test-meta">Notes from the model: {{ answer.warnings.join(', ') }}.</p>
    <p class="test-meta">Answered by {{ answer.model?.name }} {{ answer.model?.version }} {{ answer.served_by==='machine' ? `on ${answer.served_on || 'your machine'}` : answer.served_by==='staging' ? 'on its staging endpoint' : answer.served_by==='platform' ? 'on AADML\'s GPU server' : 'on its test server' }}.<template v-if="answer.charged"> Charged {{ answer.charged }}.</template></p>
    <details class="json"><summary>The answer as shown (JSON{{ shown.hidden ? ', filtered by the slider' : '' }})</summary><pre>{{ JSON.stringify(asJson, null, 2) }}</pre></details>
  </template>
</template>

<style scoped>
.test-meta{font-size:12px!important;color:#6d7c92!important;margin:6px 0!important}
.verdict{display:flex;align-items:center;gap:10px;font-size:12px;margin:0 0 12px}
.stage{position:relative;line-height:0;border-radius:8px;overflow:hidden;background:#f6f7f9}
.stage img{width:100%;height:auto;display:block}
.stage svg{position:absolute;inset:0;width:100%;height:100%}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:14px 0}
.facts>div{border:1px solid #e6e8ee;border-radius:7px;padding:8px 10px}
.facts dt{font-size:11px;color:#6d7c92}
.facts dd{margin:4px 0 0;font-size:15px;font-weight:600}
.swatch{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;vertical-align:middle}
.json summary{cursor:pointer;font-size:12px;color:var(--aadml-primary);margin-top:12px}
.json pre{max-height:320px;overflow:auto;background:#f8f9fb;border-radius:7px;padding:12px}
.badge--amber{color:#93610b;background:#fff4dc}
@media(max-width:900px){.facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
