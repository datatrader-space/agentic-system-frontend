<script setup>
// What a model found on one photo, drawn on it: the verdict, each wall with its corners and each window or door, the
// figures and the answer as JSON. Used by a project's Test page and by trying a published model (WorkspaceModels).
// ``least`` (0..1) hides what is below it here; the model is not asked again.
import { computed } from 'vue';
import { Images } from 'lucide-vue-next';
import UiBadge from './UiBadge.vue';
import { VERDICTS, filtered, middle, percent } from '../api/trial.js';

const props = defineProps({ answer: Object, photoUrl: String, asking: Boolean, least: { type: Number, default: 0 },
  waitingText: { type: String, default: 'Start the test server and choose a photo: what the model finds is drawn on it.' } });
const WALL_COLOURS = ['#2563eb', '#f59e0b', '#12b76a', '#c11574', '#7c3aed', '#0e9384', '#b54708', '#363f72'];
const KIND_COLOUR = { window: '#0ea5e9', door: '#f97316' };

const shown = computed(() => filtered(props.answer, props.least));
const verdict = computed(() => VERDICTS[props.answer?.status] || ['neutral', props.answer?.status || '', '']);
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
        <polygon v-for="(o, i) in shown.openings" :key="'o'+i" :points="pointsOf(o.polygon)" fill="none" :stroke="KIND_COLOUR[o.type]||'#0ea5e9'" stroke-width="3" vector-effect="non-scaling-stroke"/>
      </svg>
    </div>
    <dl class="facts">
      <div><dt>Walls</dt><dd>{{ shown.walls.length }}</dd></div>
      <div><dt>Windows and doors</dt><dd>{{ shown.openings.length }}</dd></div>
      <div><dt>Model time</dt><dd>{{ seconds(answer.timing_ms?.model) }}</dd></div>
      <div><dt>Whole answer</dt><dd>{{ seconds(answer.timing_ms?.total) }}</dd></div>
    </dl>
    <p v-if="shown.hidden" class="test-meta">{{ shown.hidden }} found below {{ percent(least) }} {{ shown.hidden===1?'is':'are' }} hidden by the slider.</p>
    <div v-if="shown.walls.length||shown.openings.length" class="table-wrap">
      <table><thead><tr><th>Found</th><th>Confidence</th><th>Corners</th></tr></thead>
        <tbody>
          <tr v-for="(wall, i) in shown.walls" :key="'w'+i"><td><span class="swatch" :style="{background:WALL_COLOURS[i%WALL_COLOURS.length]}"></span>Wall {{ i+1 }}{{ wall.below_threshold ? ' (not sure)' : '' }}</td><td>{{ percent(wall.confidence) }}</td><td>{{ wall.corners.length }}</td></tr>
          <tr v-for="(o, i) in shown.openings" :key="'o'+i"><td><span class="swatch" :style="{background:KIND_COLOUR[o.type]||'#0ea5e9'}"></span>{{ o.type==='door' ? 'Door' : 'Window' }}</td><td>{{ percent(o.confidence) }}</td><td>{{ o.polygon.length }}</td></tr>
        </tbody></table>
    </div>
    <p v-if="answer.warnings?.length" class="test-meta">Notes from the model: {{ answer.warnings.join(', ') }}.</p>
    <p class="test-meta">Answered by {{ answer.model?.name }} {{ answer.model?.version }} on its {{ answer.served_by==='staging' ? 'staging endpoint' : 'test server' }}.</p>
    <details class="json"><summary>The answer as shown (JSON{{ shown.hidden ? ', filtered by the slider' : '' }})</summary><pre>{{ JSON.stringify({ ...shown, hidden: undefined }, null, 2) }}</pre></details>
  </template>
</template>

<style scoped>
.test-meta{font-size:12px!important;color:#6d7c92!important;margin:6px 0!important}
.verdict{display:flex;align-items:center;gap:10px;font-size:12px;margin:0 0 12px}
.stage{position:relative;line-height:0;border-radius:8px;overflow:hidden;background:#f6f7f9}
.stage img{width:100%;height:auto;display:block}
.stage svg{position:absolute;inset:0;width:100%;height:100%}
.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
.facts>div{border:1px solid #e6e8ee;border-radius:7px;padding:8px 10px}
.facts dt{font-size:11px;color:#6d7c92}
.facts dd{margin:4px 0 0;font-size:15px;font-weight:600}
.swatch{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:8px;vertical-align:middle}
.json summary{cursor:pointer;font-size:12px;color:var(--aadml-primary);margin-top:12px}
.json pre{max-height:320px;overflow:auto;background:#f8f9fb;border-radius:7px;padding:12px}
.badge--amber{color:#93610b;background:#fff4dc}
@media(max-width:900px){.facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
