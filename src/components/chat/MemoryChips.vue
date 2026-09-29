<!-- The memories an answer drew on, under the answer — and where a wrong one is corrected.

     The backend records them with the answer (agentic-docs/MEMORY_HANDLES_PLAN.md in the backend repo): the
     saved facts, past runs and learned practices put in front of the agent this turn, and the ones it opened
     itself. Each is {ref, kind, text, via}; a fact also carries its id and status.

     A saved fact can be corrected right here, at the moment it matters:
       Outdated — closes it; its words stay in history, and it stops reaching the agent. Undo restores it.
       Forget   — removes it for good (asks once more first; no native dialog).
     Both go through the Settings → Memory endpoints, which only act on a memory the person owns — a shared
     agent's memory answers "not found", and the chip says it can't be changed here.

     A learned practice can be retired by the person it was learned for: "Not helpful" (with Undo). The chip
     says whether they can (`can_retire` — their own agent or project; never a shared agent's practice, which
     rests on other people's runs). Past runs are shown, not edited.

     A chip is saved with its answer; the server brings its status up to date on every load, so a fact marked
     outdated or a practice retired stays that way after a reload. -->
<template>
  <div v-if="chips.length" class="mc-wrap" data-test="memory-chips">
    <div class="mc-row">
      <span class="mc-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /></svg>
        Memory used
      </span>
      <button
        v-for="c in chips" :key="c.ref" type="button"
        class="mc-chip" :class="[`k-${c.kind}`, stateOf(c).phase, { open: openRef === c.ref, editable: editable(c) }]"
        :title="titleOf(c)" :aria-expanded="editable(c) ? String(openRef === c.ref) : undefined"
        :data-ref="c.ref" @click="toggle(c)"
      >
        <span class="mc-kind">{{ kindLabel(c) }}</span>
        <span class="mc-text">{{ c.text }}</span>
        <span v-if="stateOf(c).phase === 'outdated'" class="mc-tag">outdated</span>
        <span v-else-if="stateOf(c).phase === 'forgotten'" class="mc-tag">forgotten</span>
        <span v-else-if="stateOf(c).phase === 'retired'" class="mc-tag">retired</span>
      </button>
    </div>

    <!-- The one open memory: its words in full and what can be done with it. -->
    <div v-if="openChip" class="mc-panel" role="group" :aria-label="`Memory ${openChip.ref}`">
      <p class="mc-full">{{ openChip.text }}</p>
      <template v-if="openChip.kind === 'hint'">
        <template v-if="stateOf(openChip).phase === 'retired'">
          <span class="mc-note" role="status">Retired — the agent won't be given this practice again.</span>
          <button type="button" class="mc-btn" :disabled="busy" data-test="undo-retire" @click="unretire(openChip)">Undo</button>
        </template>
        <template v-else>
          <span class="mc-note">A practice the agent learned from past runs.</span>
          <button type="button" class="mc-btn" :disabled="busy" data-test="not-helpful" @click="notHelpful(openChip)">Not helpful</button>
          <button type="button" class="mc-btn plain" @click="openRef = ''">Close</button>
        </template>
      </template>
      <template v-else-if="stateOf(openChip).phase === 'outdated'">
        <span class="mc-note" role="status">Marked outdated — the agent won't be given it again.</span>
        <button type="button" class="mc-btn" :disabled="busy" data-test="undo" @click="restore(openChip)">Undo</button>
      </template>
      <span v-else-if="stateOf(openChip).phase === 'forgotten'" class="mc-note" role="status">Forgotten.</span>
      <template v-else-if="confirmForget === openChip.ref">
        <span class="mc-note">Forget this memory for good?</span>
        <button type="button" class="mc-btn danger" :disabled="busy" data-test="confirm-forget" @click="forget(openChip)">Forget it</button>
        <button type="button" class="mc-btn plain" :disabled="busy" @click="confirmForget = ''">Keep it</button>
      </template>
      <template v-else>
        <button type="button" class="mc-btn" :disabled="busy" data-test="outdated" @click="outdated(openChip)">It's outdated</button>
        <button type="button" class="mc-btn" :disabled="busy" data-test="forget" @click="confirmForget = openChip.ref">Forget</button>
        <button type="button" class="mc-btn plain" @click="openRef = ''">Close</button>
      </template>
      <span v-if="stateOf(openChip).error" class="mc-err" role="alert">{{ stateOf(openChip).error }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import api from '../../services/api'

const props = defineProps({
  message: { type: Object, required: true },
})

const chips = computed(() => (Array.isArray(props.message.memories) ? props.message.memories : [])
  .filter((c) => c && c.ref && c.text))

const states = reactive({})
const openRef = ref('')
const confirmForget = ref('')
const busy = ref(false)

// A saved fact is always the person's to correct (the server refuses one that isn't); a learned practice
// only when the server said this person owns it.
const editable = (c) => c.kind === 'fact' || (c.kind === 'hint' && c.can_retire === true && !!c.id)

const openChip = computed(() => chips.value.find((c) => c.ref === openRef.value && editable(c)) || null)

const INITIAL = { closed: 'outdated', retired: 'retired', gone: 'forgotten' }

function stateOf (c) {
  if (!states[c.ref]) states[c.ref] = { phase: INITIAL[c.status] || 'idle', error: '' }
  return states[c.ref]
}

function kindLabel (c) {
  return { fact: 'Saved', run: 'Past run', hint: 'Learned', topic: 'Topic' }[c.kind] || 'Memory'
}

function titleOf (c) {
  const how = c.via === 'opened' ? 'The agent opened this memory' : 'This memory was in front of the agent'
  const outcome = c.kind === 'run' && c.outcome ? ` (that run: ${c.outcome})` : ''
  return `${how}${outcome}: ${c.text}`
}

function toggle (c) {
  if (!editable(c)) return                       // past runs, and practices that aren't theirs, are shown only
  confirmForget.value = ''
  openRef.value = openRef.value === c.ref ? '' : c.ref
}

function failure (c, err) {
  const status = err && err.response && err.response.status
  // 404 is both "already forgotten" (the chip is saved with the answer, so it outlives the memory) and
  // "not yours" (a shared agent's memory) — the server gives one answer to both on purpose.
  stateOf(c).error = status === 404
    ? "This memory is no longer there, or isn't one you can change."
    : "Couldn't update this memory. Try again."
}

// `phase` is the state to show on success, or a function of the server's answer.
async function act (c, fn, phase) {
  busy.value = true
  stateOf(c).error = ''
  try {
    const res = await fn()
    stateOf(c).phase = typeof phase === 'function' ? phase(res && res.data) : phase
  } catch (err) {
    failure(c, err)
  } finally {
    busy.value = false
  }
}

const outdated = (c) => act(c, () => api.updateGlobalMemory(c.id, { status: 'archived' }), 'outdated')
const restore = (c) => act(c, () => api.updateGlobalMemory(c.id, { status: 'active' }), 'idle')
async function forget (c) {
  await act(c, () => api.deleteGlobalMemory(c.id), 'forgotten')
  confirmForget.value = ''
}
const notHelpful = (c) => act(c, () => api.markLearnedNotHelpful(c.id), 'retired')
// Undo removes this person's verdict only; a practice the platform's own checks retired stays retired.
const unretire = (c) => act(c, () => api.undoLearnedNotHelpful(c.id), (data) => {
  if (data && data.status === 'retired') {
    stateOf(c).error = 'It stays retired — the platform retired it from its own checks, not from your feedback.'
    return 'retired'
  }
  return 'idle'
})
</script>

<style scoped>
.mc-wrap { margin-top: 8px; }
.mc-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.mc-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: .74rem; font-weight: 600; color: var(--vm-text-muted, #6b7280);
}
.mc-label svg { width: 14px; height: 14px; }
.mc-chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 320px;
  padding: 3px 10px; border-radius: 999px; border: 1px solid #e5e7eb; background: #f9fafb;
  color: #374151; font-size: .76rem; line-height: 1.35; cursor: default; text-align: left;
  transition: background .15s, border-color .15s;
}
.mc-chip.editable { cursor: pointer; }
.mc-chip.editable:hover, .mc-chip.open { background: #eef2ff; border-color: #c7d2fe; }
.mc-chip:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; }
.mc-kind { font-weight: 600; color: #4338ca; flex: none; }
.mc-chip.k-run .mc-kind { color: #b45309; }
.mc-chip.k-hint .mc-kind { color: #047857; }
.mc-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.mc-chip.outdated .mc-text, .mc-chip.forgotten .mc-text, .mc-chip.retired .mc-text {
  text-decoration: line-through; color: #9ca3af;
}
.mc-tag { flex: none; font-size: .68rem; color: #9ca3af; }
.mc-panel {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin-top: 6px; padding: 8px 10px; border: 1px solid #e0e7ff; border-radius: 10px; background: #f8faff;
}
.mc-full { flex-basis: 100%; margin: 0 0 2px; font-size: .8rem; color: #1f2937; }
.mc-btn {
  padding: 4px 11px; border-radius: 8px; border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca;
  font-size: .76rem; font-weight: 600; cursor: pointer;
}
.mc-btn:hover:not(:disabled) { background: #e0e7ff; }
.mc-btn:disabled { opacity: .7; cursor: default; }
.mc-btn.danger { border-color: #fecaca; background: #fef2f2; color: #b91c1c; }
.mc-btn.plain { border-color: transparent; background: transparent; color: var(--vm-text-muted, #6b7280); }
.mc-note { font-size: .76rem; color: var(--vm-text-muted, #6b7280); }
.mc-err { flex-basis: 100%; font-size: .74rem; color: #b91c1c; }
</style>
