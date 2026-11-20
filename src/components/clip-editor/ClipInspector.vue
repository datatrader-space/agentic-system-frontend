<template>
  <!-- The selected item's settings (VIDEO_EDITOR_PRO_PLAN.md section 6): its times, then tabs (Video, Speed, Colour,
       Effects, Text, Audio) offered for what is selected. Every value is typed or stepped, so nothing needs a drag
       (WCAG 2.5.7); each change is one edit, undoable and saved with the timeline. The tabs other than Video load
       when first opened (P12). -->
  <section class="ci pn" aria-label="Settings of the selection">
    <template v-if="!row">
      <h3 class="ci-h">Video</h3>
      <VideoPanel :doc="doc" :media="media" :compact="compact" @ops="pass" />
      <p class="pn-note">Select a clip, a text or a transition on the timeline to change it.</p>
    </template>

    <template v-else-if="item.type === 'transition'">
      <h3 class="ci-h">Transition</h3>
      <label class="st-field">Kind<select class="st-input" :value="item.kind" data-test="transition-kind" @change="set({ kind: $event.target.value }, 'Transition changed')"><option v-for="k in transitions" :key="k.id" :value="k.id">{{ k.label }}</option></select></label>
      <label class="st-field">Length (seconds)<input class="st-input" type="number" inputmode="decimal" :min="L.transition_ms[0] / 1000" :max="L.transition_ms[1] / 1000" step="0.1" :value="item.ms / 1000" @change="emitOps(tl.setTransitionMsOps(doc, item.id, Number($event.target.value) * 1000), 'Transition length changed')" /></label>
      <button type="button" class="st-button" @click="emitOps(tl.removeTransitionOps(doc, item.id), 'Transition removed')">Remove transition</button>
    </template>

    <template v-else>
      <h3 class="ci-h">{{ heading }}</h3>
      <div class="ci-pair">
        <label class="st-field">Starts at<input class="st-input" inputmode="decimal" :value="seconds(item.start_ms)" @change="typed($event, v => tl.moveOps(doc, item.id, v), 'Moved')" /></label>
        <label class="st-field">Ends at<input class="st-input" inputmode="decimal" :value="seconds(tl.itemEnd(item, doc.rate))" @change="typed($event, v => trimOps('end', v), 'Trimmed')" /></label>
      </div>
      <div v-if="hasSource" class="ci-pair">
        <label class="st-field">From the file at<input class="st-input" inputmode="decimal" :value="seconds(item.source_in_ms)" @change="typed($event, v => sourceOps('source_in_ms', v), 'In point changed')" /></label>
        <label class="st-field">To the file at<input class="st-input" inputmode="decimal" :value="seconds(item.source_out_ms)" @change="typed($event, v => sourceOps('source_out_ms', v), 'Out point changed')" /></label>
      </div>
      <p v-if="typedError" class="st-error" role="alert">{{ typedError }}</p>
      <div v-if="next" class="ci-join"><span class="pn-legend">Into the next clip</span>
        <button v-if="!into" type="button" class="st-button pn-small" :disabled="!touchesNext" @click="emitOps(tl.addTransitionOps(doc, item.id, 'crossfade', 500), 'Crossfade added')">Add a crossfade</button>
        <p v-if="!into && !touchesNext" class="pn-note">Move the next clip to start where this one ends to join them with a transition.</p>
        <button v-else-if="into" type="button" class="st-button pn-small" @click="$emit('select', into.id)">Edit the transition</button>
      </div>

      <div class="ci-tabs" role="tablist" aria-label="Settings" @keydown="tabKey">
        <button v-for="t in tabs" :id="`ci-tab-${t}`" :key="t" type="button" role="tab" class="ci-tab" :aria-selected="tab === t ? 'true' : 'false'"
                :aria-controls="`ci-panel-${t}`" :tabindex="tab === t ? 0 : -1" :data-test="`tab-${t}`" @click="tab = t">{{ TAB_LABEL[t] }}</button>
      </div>
      <div :id="`ci-panel-${tab}`" role="tabpanel" :aria-labelledby="`ci-tab-${tab}`" class="ci-panel">
        <VideoPanel v-if="tab === 'video'" v-bind="common" :media="media" />
        <SpeedPanel v-else-if="tab === 'speed'" v-bind="common" :playhead="playhead" />
        <ColourPanel v-else-if="tab === 'colour'" v-bind="common" :project-id="projectId" :media="media" :names="names" />
        <EffectsPanel v-else-if="tab === 'effects'" v-bind="common" />
        <TextPanel v-else-if="tab === 'text'" v-bind="common" />
        <AudioPanel v-else-if="tab === 'audio'" v-bind="common" />
      </div>
    </template>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { lazyComponent } from '../../utils/lazyComponent'
import * as tl from './timelineModel'
import * as br from './panels/bridge'
import { relTime } from './panels/panelModel'
import VideoPanel from './panels/VideoPanel.vue'
import './panels/panels.css'
const SpeedPanel = lazyComponent(() => import('./panels/SpeedPanel.vue'))
const ColourPanel = lazyComponent(() => import('./panels/ColourPanel.vue'))
const EffectsPanel = lazyComponent(() => import('./panels/EffectsPanel.vue'))
const TextPanel = lazyComponent(() => import('./panels/TextPanel.vue'))
const AudioPanel = lazyComponent(() => import('./panels/AudioPanel.vue'))

const props = defineProps({ doc: { type: Object, required: true }, selectedId: { type: String, default: '' }, media: { type: Object, default: () => ({}) },
  playhead: { type: Number, default: 0 }, projectId: { type: String, default: '' }, names: { type: Object, default: () => ({}) },
  compact: Boolean,
  requestTab: { type: Object, default: null } })      // {tab, n}: open that tab (each new n asks again)
const emit = defineEmits(['ops', 'select', 'seek', 'refresh-media'])
const L = br.editorLimits(br.registry())
const transitions = br.registry().transitions
const TAB_LABEL = { video: 'Video', speed: 'Speed', colour: 'Colour', effects: 'Effects', text: 'Text', audio: 'Audio' }
const typedError = ref('')
const row = computed(() => (props.selectedId && tl.find(props.doc, props.selectedId)) || null)
const item = computed(() => row.value?.item)
const isPicture = computed(() => item.value?.hold_ms != null && item.value?.freeze_at_ms == null)
const hasSource = computed(() => item.value?.type === 'clip' && item.value.source_out_ms != null)
const next = computed(() => { if (!row.value || row.value.track.kind !== 'video' || item.value.type !== 'clip') return null; const list = tl.ordered(row.value.track), n = list.findIndex(i => i.id === item.value.id); return list[n + 1] || null })
const into = computed(() => next.value && tl.transitionInto(row.value.track, next.value.id))
const touchesNext = computed(() => next.value && next.value.start_ms === tl.itemEnd(item.value, props.doc.rate))
const heading = computed(() => item.value.type === 'text' ? (row.value.track.captions ? 'Caption' : 'Text') : row.value.track.kind === 'audio' ? 'Sound' : isPicture.value ? 'Picture' : 'Video clip')
// The tabs that fit what is selected.
const tabs = computed(() => {
  if (!item.value) return []
  if (item.value.type === 'text') return ['text']
  if (row.value.track.kind === 'audio') return ['audio', 'speed']
  if (isPicture.value) return ['video', 'colour', 'effects']
  const sound = props.media[item.value.media]?.has_audio !== false && item.value.freeze_at_ms == null
  return ['video', 'speed', 'colour', 'effects', ...(sound ? ['audio'] : [])]
})
const tab = ref('video')
watch(tabs, list => { if (list.length && !list.includes(tab.value)) tab.value = list[0] }, { immediate: true })
watch(() => props.requestTab, r => { if (r && tabs.value.includes(r.tab)) tab.value = r.tab })
const tRel = computed(() => relTime(item.value, props.playhead, props.doc.rate))
const common = computed(() => ({ doc: props.doc, item: item.value, track: row.value?.track, tRel: tRel.value, compact: props.compact, onOps: pass, onSeek: s => emit('seek', s), onRefreshMedia: id => emit('refresh-media', id) }))
const seconds = ms => tl.timecode(ms, props.doc.rate).replace(/\.(\d\d)$/, (m, f) => `.${f}f`)

function pass(e) { if (e?.ops?.length) emit('ops', e) }
function emitOps(ops, label) { if (ops.length) emit('ops', { ops, label }) }
function set(changes, label) { emitOps(tl.setOps(props.doc, item.value.id, changes), label) }
// Arrow keys, Home and End move between tabs (the WAI-ARIA tabs pattern, automatic activation).
function tabKey(e) {
  const list = tabs.value, n = list.indexOf(tab.value)
  const to = { ArrowRight: n + 1, ArrowLeft: n - 1, Home: 0, End: list.length - 1 }[e.key]
  if (to == null) return
  e.preventDefault()
  tab.value = list[(to + list.length) % list.length]
  requestAnimationFrame(() => document.getElementById(`ci-tab-${tab.value}`)?.focus())
}
// The part of the file a clip plays, typed directly: the clip keeps its start on the timeline.
function sourceOps(key, v) {
  const it = item.value, dur = props.media[it.media]?.duration_ms, min = Math.ceil(tl.frameMs(props.doc.rate))
  const inMs = key === 'source_in_ms' ? v : it.source_in_ms, outMs = key === 'source_out_ms' ? v : it.source_out_ms
  if (inMs < 0 || outMs - inMs < min || (dur && outMs > dur)) { typedError.value = `The clip must start before it ends, inside its file${dur ? ` (${seconds(dur)})` : ''}.`; return [] }
  return tl.setOps(props.doc, it.id, { [key]: v })
}
function trimOps(edge, at) { return tl.trimOps(props.doc, item.value.id, edge, at, { durationMs: props.media[item.value.media]?.duration_ms, rate: props.doc.rate }) }
// A typed time: seconds ("12.5"), minutes and seconds ("1:02.5"), or the shown form ("0:12.15f": frames).
function readTyped(text) {
  const f = /^(\d+):(\d{1,2})\.(\d{1,2})f$/.exec(String(text).trim())
  if (f) return Math.round((Number(f[1]) * 60 + Number(f[2])) * 1000 + Number(f[3]) * tl.frameMs(props.doc.rate))
  return tl.parseTime(text)
}
function typed(event, build, label) {
  const v = readTyped(event.target.value)
  if (!Number.isFinite(v)) { typedError.value = 'Type a time in seconds, like 12.5, or minutes and seconds, like 1:02.5.'; return }
  typedError.value = ''
  emitOps(build(tl.toFrame(v, props.doc.rate)), label)
}
</script>
<style scoped>
.ci-h{font-size:14px;font-weight:600;color:var(--vm-ink);margin:0}
.ci-pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ci-join{display:grid;gap:6px}
.ci-tabs{display:flex;gap:2px;overflow-x:auto;border-bottom:1px solid var(--vm-line-2);scrollbar-width:thin}
.ci-tab{flex:none;min-height:34px;padding:6px 10px;border:0;border-bottom:2px solid transparent;background:none;color:var(--vm-ink-soft);font:500 12px/1.3 var(--vm-font-sans);cursor:pointer}
.ci-tab:hover{color:var(--vm-ink)}
.ci-tab[aria-selected="true"]{border-bottom-color:var(--vm-primary);color:var(--vm-ink)}
.ci-panel{min-width:0}
@media (max-width:767px){.ci-tab{min-height:44px;padding:8px 12px;font-size:14px}}
</style>
