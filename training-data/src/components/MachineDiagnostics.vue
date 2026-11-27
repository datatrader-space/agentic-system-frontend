<script setup>
// One machine's "Diagnostics" fold on the Your machines page (agent 1.9.7, ADM-1394): what happens on the machine,
// without anyone at the PC. A FIXED read-only set the machine answers (backend: machine_diagnostics.py): its AADML
// containers, a chosen one's log tail and how it ended, and the machine's figures. For an Admin only: the backend refuses
// anyone else. Every line was redacted by the machine and by AADML.
import { computed, onUnmounted, ref } from 'vue';
import { ChevronDown, RefreshCw } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import {
  machinesApi, runDiagnostic, diagnoseWhy, diagnosticWords, containerState, containerWhat, endedLine, systemLines,
  DIAGNOSE_LINES, DIAGNOSE_DEFAULT_LINES,
} from '../api/machines.js';

const props = defineProps({ machine: { type: Object, required: true } });
const open = ref(false);
const why = computed(() => diagnoseWhy(props.machine));
const regionId = computed(() => `diagnostics-${props.machine.id}`);
const said = ref('');
let gone = false;
onUnmounted(() => { gone = true; });

// One look at a time per part: {busy, error, answer, words}.
const part = () => ({ busy: false, error: '', words: '', answer: null });
const list = ref(part()); const tail = ref(part()); const ending = ref(part()); const figures = ref(part());
const chosen = ref(''); const lines = ref(DIAGNOSE_DEFAULT_LINES);

async function look(target, action, args = {}) {
  if (target.value.busy || why.value) return;
  target.value = { ...target.value, busy: true, error: '', words: '' };
  try {
    const request = await runDiagnostic(machinesApi, props.machine.id, action, args, { isGone: () => gone });
    if (gone) return;
    target.value = { busy: false, error: '', words: diagnosticWords(request), answer: request?.state === 'answered' ? request.answer : target.value.answer };
  } catch (e) {
    if (!gone) target.value = { ...target.value, busy: false, error: e.message };
  }
}
const containers = computed(() => list.value.answer?.containers || []);
const selected = computed(() => containers.value.find(c => c.name === chosen.value) || null);
const systemRows = computed(() => systemLines(figures.value.answer));

async function refresh() {
  await look(list, 'containers');
  if (!gone) said.value = `${containers.value.length} AADML container${containers.value.length === 1 ? '' : 's'} on ${props.machine.name}.`;
}
function choose(container) {
  chosen.value = container.name;
  tail.value = part(); ending.value = part();
  readTail();
  if (container.state !== 'running') look(ending, 'ended', { container: container.name });
}
function readTail() { if (chosen.value) look(tail, 'logs', { container: chosen.value, lines: Number(lines.value) }); }
function toggle() {
  open.value = !open.value;
  if (open.value && !why.value) {
    if (!list.value.answer && !list.value.busy) refresh();
    if (!figures.value.answer && !figures.value.busy) look(figures, 'system');
  }
}
</script>

<template>
  <div class="diag">
    <button type="button" class="diag-toggle" :aria-expanded="open" :aria-controls="regionId" @click="toggle">
      <ChevronDown :size="15" aria-hidden="true" :class="{ 'is-open': open }"/> Diagnostics
    </button>
    <div v-if="open" :id="regionId" class="diag-body" role="region" :aria-label="`Diagnostics of ${machine.name}`">
      <p class="visually-hidden" aria-live="polite">{{ said }}</p>
      <p v-if="why" class="diag-note">{{ why }}</p>
      <template v-else>
        <p class="diag-intro">What AADML's containers on this machine do, read by the machine's agent. Nothing is run or changed on the machine.</p>

        <section class="diag-part" :aria-busy="list.busy" :aria-labelledby="`${regionId}-containers`">
          <div class="diag-bar">
            <h4 :id="`${regionId}-containers`">Containers</h4>
            <UiButton :aria-label="`Refresh the containers of ${machine.name}`" :disabled="list.busy" @click="refresh">
              <RefreshCw :size="14" aria-hidden="true" :class="{ spin: list.busy }"/> {{ list.busy ? 'Asking the machine…' : 'Refresh' }}
            </UiButton>
          </div>
          <p v-if="list.error" class="field-error" role="alert">{{ list.error }}</p>
          <p v-else-if="list.words" class="diag-note" role="status">{{ list.words }}</p>
          <p v-if="list.answer && !containers.length" class="diag-empty">No AADML container is on the machine now.</p>
          <ul v-if="containers.length" class="diag-list">
            <li v-for="c in containers" :key="c.id || c.name">
              <button type="button" class="diag-row" :aria-pressed="chosen === c.name" @click="choose(c)">
                <span class="diag-row-main"><strong>{{ c.name }}</strong><span>{{ containerWhat(c) }} · {{ c.status }}</span></span>
                <UiBadge :tone="containerState(c)[0]">{{ containerState(c)[1] }}</UiBadge>
              </button>
            </li>
          </ul>
        </section>

        <section v-if="selected" class="diag-part" :aria-busy="tail.busy || ending.busy">
          <div class="diag-bar">
            <h4>{{ selected.name }}</h4>
            <div class="diag-controls">
              <label :for="`${regionId}-lines`">Lines</label>
              <select :id="`${regionId}-lines`" v-model="lines" class="diag-select" @change="readTail">
                <option v-for="n in DIAGNOSE_LINES" :key="n" :value="n">{{ n }}</option>
              </select>
              <UiButton :aria-label="`Read the log of ${selected.name} again`" :disabled="tail.busy" @click="readTail">
                <RefreshCw :size="14" aria-hidden="true" :class="{ spin: tail.busy }"/> {{ tail.busy ? 'Reading…' : 'Read again' }}
              </UiButton>
            </div>
          </div>
          <p v-if="ending.answer" class="diag-ended"><strong>How it ended:</strong> {{ endedLine(ending.answer) }}</p>
          <p v-else-if="ending.words" class="diag-note">{{ ending.words }}</p>
          <p v-if="tail.error" class="field-error" role="alert">{{ tail.error }}</p>
          <p v-else-if="tail.words" class="diag-note" role="status">{{ tail.words }}</p>
          <p v-if="tail.busy && !tail.answer" class="diag-empty">Asking the machine for the last {{ lines }} lines…</p>
          <p v-if="tail.answer?.cut" class="diag-empty">Only the newest part of the log is shown (it is larger than the machine sends).</p>
          <pre v-if="tail.answer" class="diag-lines" tabindex="0" :aria-label="`Last lines of ${selected.name}, newest at the bottom`">{{ tail.answer.log || 'The container has written nothing.' }}</pre>
        </section>

        <section class="diag-part" :aria-busy="figures.busy">
          <div class="diag-bar">
            <h4>The machine</h4>
            <UiButton :aria-label="`Read the figures of ${machine.name} again`" :disabled="figures.busy" @click="look(figures, 'system')">
              <RefreshCw :size="14" aria-hidden="true" :class="{ spin: figures.busy }"/> Refresh
            </UiButton>
          </div>
          <p v-if="figures.error" class="field-error" role="alert">{{ figures.error }}</p>
          <p v-else-if="figures.words" class="diag-note" role="status">{{ figures.words }}</p>
          <p v-if="figures.busy && !figures.answer" class="diag-empty">Asking the machine…</p>
          <dl v-if="systemRows.length" class="diag-figures">
            <template v-for="row in systemRows" :key="row[0]"><dt>{{ row[0] }}</dt><dd>{{ row[1] }}</dd></template>
          </dl>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.diag{margin-top:2px}
.diag-toggle{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 4px;border:0;background:none;color:#52627b;font:inherit;font-size:13px;font-weight:550;cursor:pointer}
.diag-toggle:hover{color:var(--aadml-primary)}
.diag-toggle:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px;border-radius:4px}
.diag-toggle svg{transition:transform .15s}
.diag-toggle svg.is-open{transform:rotate(180deg)}
.diag-body{border:1px solid #e3e8ef;border-radius:10px;background:#fff;padding:10px 12px;margin-top:4px;display:grid;gap:12px}
.diag-intro,.diag-empty{font-size:12.5px;color:#475569;margin:0}
.diag-note{font-size:12.5px;color:#41506a;background:var(--aadml-tint);border:1px solid var(--aadml-soft);border-radius:8px;padding:8px 10px;margin:0}
.diag-part{border-top:1px solid #e9ecf2;padding-top:10px;display:grid;gap:8px}
.diag-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.diag-bar h4{margin:0;font-size:13px;color:#0f172a;overflow-wrap:anywhere}
.diag-controls{display:flex;align-items:center;gap:8px}
.diag-controls label{font-size:12px;color:#52627b}
.diag-select{min-height:44px;border:1px solid #dfe3eb;border-radius:7px;padding:0 8px;font:inherit;font-size:12.5px;background:#fff;color:#1d2a42}
.diag-select:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}
.diag-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.diag-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:44px;padding:8px 10px;border:1px solid #e3e8ef;border-radius:8px;background:#f8f9fb;font:inherit;text-align:left;cursor:pointer;transition:border-color .15s,background-color .15s}
.diag-row:hover{border-color:var(--aadml-focus);background:var(--aadml-tint)}
.diag-row[aria-pressed="true"]{border-color:var(--aadml-primary);background:var(--aadml-tint)}
.diag-row:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}
.diag-row-main{display:grid;gap:2px;min-width:0}
.diag-row-main strong{font-size:12.5px;color:#1d2a42;overflow-wrap:anywhere}
.diag-row-main span{font-size:12px;color:#7b889e;overflow-wrap:anywhere}
.diag-ended{font-size:12.5px;color:#1d2a42;margin:0}
.diag-lines{margin:0;max-height:320px;overflow:auto;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:10px 12px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.diag-lines:focus-visible{outline:3px solid var(--aadml-outline);outline-offset:2px}
.diag-figures{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 14px;margin:0;font-size:12.5px}
.diag-figures dt{color:#52627b;font-weight:550}
.diag-figures dd{margin:0;color:#1d2a42;overflow-wrap:anywhere}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:640px){.diag-controls{width:100%;flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.spin{animation:none}.diag-toggle svg,.diag-row{transition:none}}
</style>
