<template>
  <!-- The agent's questions (ASK_USER), drawn the way Claude Code draws AskUserQuestion (owner, 2026-11-24: "we dont
       want scroll down"): a tab per question, one question on screen at a time, a last tab to submit. Picking an
       option in a single-choice question moves to the next one; number keys pick, ←/→ change tabs, Esc cancels.
       Every panel stays in the DOM (hidden), so a half-answered card keeps its answers while the person moves around. -->
  <form class="auq" :class="{ 'auq--collapsed': collapsed }" data-test="ask-user-questions" @submit.prevent="send"
        @keydown="onKey">
    <div class="auq-bar">
      <div v-if="!collapsed" class="auq-tabs" role="tablist" aria-label="The agent's questions" data-test="auq-tabs"
           @keydown="onTabKey">
        <button v-for="(t, ti) in tabs" :id="`auq-${uid}-tab-${ti}`" :key="ti" ref="tabEls" type="button" role="tab"
                class="auq-tab" :class="{ on: ti === active, done: t.done }" :aria-selected="ti === active ? 'true' : 'false'"
                :aria-controls="`auq-${uid}-panel-${ti}`" :tabindex="ti === active ? 0 : -1" :data-test="`auq-tab-${ti}`"
                @click="go(ti)">
          <svg v-if="t.done" class="auq-tick" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>
          {{ t.label }}
          <span v-if="t.done" class="auq-sr">(answered)</span>
        </button>
      </div>
      <p v-else class="auq-collapsed-text" data-test="auq-collapsed-text">
        {{ questions.length > 1 ? `The agent has ${questions.length} questions for you` : 'The agent has a question for you' }}
      </p>
      <div class="auq-bar-actions">
        <button type="button" class="auq-icon" :aria-expanded="collapsed ? 'false' : 'true'"
                :aria-label="collapsed ? 'Show the questions' : 'Hide the questions'"
                :title="collapsed ? 'Show the questions' : 'Hide the questions'" data-test="auq-collapse"
                @click="collapsed = !collapsed">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="collapsed ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'"/></svg>
        </button>
        <button v-if="cancellable" type="button" class="auq-icon" aria-label="Cancel these questions"
                title="Cancel (Esc): the agent is told you cancelled" data-test="auq-cancel" :disabled="disabled"
                @click="cancel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="auq-body">
      <fieldset v-for="(q, qi) in questions" v-show="active === qi" :id="`auq-${uid}-panel-${qi}`" :key="qi"
                class="auq-q" role="tabpanel" :aria-labelledby="`auq-${uid}-tab-${qi}`" :data-test="`auq-q-${qi}`">
        <legend class="auq-legend">
          <span class="auq-text">{{ q.question }}</span>
          <span v-if="q.multiSelect" class="auq-hint">Choose any that apply</span>
        </legend>
        <div class="auq-options" :role="q.multiSelect ? 'group' : 'radiogroup'" :aria-label="q.question">
          <label v-for="(o, oi) in q.options" :key="oi" class="auq-opt" :class="{ on: isPicked(qi, o.label) }"
                 :data-test="`auq-opt-${qi}-${oi}`">
            <input :type="q.multiSelect ? 'checkbox' : 'radio'" class="auq-input" :name="`auq-${uid}-${qi}`"
                   :value="o.label" :checked="isPicked(qi, o.label)" :disabled="disabled"
                   @change="pick(qi, o.label)" @click="pointerPick(qi)" />
            <span class="auq-opt-text">
              <span class="auq-opt-label"><span class="auq-key" aria-hidden="true">{{ oi + 1 }}</span>{{ o.label }}</span>
              <span v-if="o.description" class="auq-opt-desc">{{ o.description }}</span>
            </span>
          </label>
          <label class="auq-opt auq-other" :class="{ on: state[qi].otherOn }" :data-test="`auq-other-${qi}`">
            <input :type="q.multiSelect ? 'checkbox' : 'radio'" class="auq-input" :name="`auq-${uid}-${qi}`"
                   value="__other__" :checked="state[qi].otherOn" :disabled="disabled" @change="toggleOther(qi)" />
            <span class="auq-opt-text">
              <span class="auq-opt-label"><span class="auq-key" aria-hidden="true">{{ q.options.length + 1 }}</span>Other</span>
              <input v-show="state[qi].otherOn" :ref="(el) => (otherEls[qi] = el)" v-model="state[qi].other"
                     class="auq-other-input" type="text" :disabled="disabled"
                     :aria-label="`Your own answer to: ${q.question}`" placeholder="Type your own answer"
                     autocomplete="off" :data-test="`auq-other-text-${qi}`" @focus="otherFocus(qi)"
                     @keydown.enter.prevent="next()" />
            </span>
          </label>
        </div>
        <div v-if="!single && (q.multiSelect || state[qi].otherOn)" class="auq-row">
          <button type="button" class="auq-next" :disabled="disabled || !answered(state[qi])" data-test="auq-next"
                  @click="next()">Next</button>
        </div>
      </fieldset>

      <!-- The last tab: what was answered, and Submit. One question has no review: Submit sits under it. -->
      <div v-if="!single" v-show="active === questions.length" :id="`auq-${uid}-panel-${questions.length}`"
           class="auq-review" role="tabpanel" :aria-labelledby="`auq-${uid}-tab-${questions.length}`"
           data-test="auq-review">
        <ul class="auq-summary">
          <li v-for="(q, qi) in questions" :key="qi">
            <span class="auq-summary-head">{{ tabs[qi].label }}</span>
            <span v-if="answered(state[qi])" class="auq-summary-answer">{{ answerText(qi) }}</span>
            <button v-else type="button" class="auq-summary-missing" @click="go(qi)">Not answered yet: answer it</button>
          </li>
        </ul>
      </div>
      <div v-if="single || active === questions.length" class="auq-row">
        <button type="submit" class="auq-send" :disabled="disabled || !complete" data-test="auq-send">
          {{ single ? 'Submit answer' : 'Submit answers' }}
        </button>
        <span v-if="!complete && !disabled" class="auq-need">
          Answer {{ single ? 'the question' : 'each question' }} to submit.</span>
      </div>
      <p v-if="cancellable" class="auq-foot">Esc to cancel</p>
    </div>
  </form>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'

const props = defineProps({
  // [{ question, header, options: [{ label, description }], multiSelect }]
  questions: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
  // The card can be turned down (HITLModal maps `cancel` to "Cancel this step").
  cancellable: { type: Boolean, default: false },
})
const emit = defineEmits(['answer', 'cancel'])
const uid = Math.random().toString(36).slice(2, 8)

const fresh = () => props.questions.map(() => ({ picked: [], otherOn: false, other: '' }))
const state = reactive(fresh())
const active = ref(0)
const collapsed = ref(false)
const tabEls = ref([])
const otherEls = []
watch(() => props.questions, () => { state.splice(0, state.length, ...fresh()); active.value = 0 })

const single = computed(() => props.questions.length === 1)
// Each question has an answer: an option, or "Other" with words.
const answered = (s) => (s.picked.length > 0 && (!s.otherOn || s.other.trim())) || (s.otherOn && !!s.other.trim())
const complete = computed(() => state.length === props.questions.length && state.every(answered))
const tabs = computed(() => {
  const qs = props.questions.map((q, qi) => ({ label: q.header || `Question ${qi + 1}`, done: !!answered(state[qi]) }))
  return single.value ? qs : [...qs, { label: 'Submit', done: false }]
})

const isPicked = (qi, label) => state[qi].picked.includes(label)

// A pick by pointer or Enter moves on; arrow keys inside a radio group change the pick without moving on.
let arrowing = false
function pick(qi, label) {
  const s = state[qi]
  if (props.questions[qi].multiSelect) {
    s.picked = s.picked.includes(label) ? s.picked.filter((x) => x !== label) : [...s.picked, label]
  } else {
    s.picked = [label]
    s.otherOn = false
  }
}
function pointerPick(qi) {
  if (arrowing || props.questions[qi].multiSelect || single.value) return
  setTimeout(() => { if (active.value === qi) next() }, 160)
}
function toggleOther(qi) {
  const s = state[qi]
  s.otherOn = props.questions[qi].multiSelect ? !s.otherOn : true
  if (s.otherOn && !props.questions[qi].multiSelect) s.picked = []
  if (s.otherOn) nextTick(() => otherEls[qi]?.focus())
}
function otherFocus(qi) {
  if (!state[qi].otherOn) toggleOther(qi)
}

function go(ti) {
  if (ti < 0 || ti >= tabs.value.length) return
  active.value = ti
  // On a phone the tab row scrolls sideways: keep the active tab in sight.
  nextTick(() => tabEls.value[ti]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
}
// The next tab: the next question, after the last one the Submit tab.
function next() {
  if (single.value || active.value >= props.questions.length) return
  if (!answered(state[active.value])) return
  go(active.value + 1)
}
function answerText(qi) {
  const s = state[qi]
  return [...s.picked, ...(s.otherOn && s.other.trim() ? [s.other.trim()] : [])].join(', ')
}

function onTabKey(e) {
  const last = tabs.value.length - 1
  const to = { ArrowRight: active.value + 1, ArrowLeft: active.value - 1, Home: 0, End: last }[e.key]
  if (to === undefined) return
  e.preventDefault()
  go(Math.max(0, Math.min(last, to)))
  nextTick(() => tabEls.value[active.value]?.focus())
}
function onKey(e) {
  if (props.disabled) return
  const typing = e.target?.tagName === 'INPUT' && e.target.type === 'text'
  if (e.key === 'Escape') {
    if (typing) { e.target.blur(); return }
    if (props.cancellable) { e.preventDefault(); cancel() }
    return
  }
  // A browser moves a radio group's pick with the arrow keys and fires a click for it: browsing, not choosing.
  if (e.key.startsWith('Arrow')) { arrowing = true; setTimeout(() => { arrowing = false }, 0) }
  if (typing || collapsed.value || active.value >= props.questions.length) return
  const q = props.questions[active.value]
  if (/^[1-9]$/.test(e.key)) {
    const k = Number(e.key) - 1
    if (k < q.options.length) {
      e.preventDefault()
      pick(active.value, q.options[k].label)
      pointerPick(active.value)
    } else if (k === q.options.length) {
      e.preventDefault()
      toggleOther(active.value)
    }
  } else if (e.key === 'Enter' && e.target?.type === 'radio' && answered(state[active.value])) {
    e.preventDefault()
    next()
  }
}

function cancel() {
  if (props.disabled) return
  emit('cancel')
}
function send() {
  if (props.disabled || !complete.value) return
  emit('answer', {
    answers: props.questions.map((q, qi) => ({
      question: q.question,
      header: q.header || '',
      selected: [...state[qi].picked],
      other: state[qi].otherOn ? state[qi].other.trim() : '',
    })),
  })
}
</script>

<style scoped>
.auq { display: flex; flex-direction: column; gap: 12px; }
.auq-bar { display: flex; align-items: center; gap: 8px; min-width: 0; }
.auq-tabs { display: flex; flex: 1 1 auto; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.auq-tabs::-webkit-scrollbar { display: none; }
.auq-tab { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; min-height: 32px; padding: 0 10px;
           border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--vm-ink-soft);
           font: 600 13px/1 var(--vm-font-sans); cursor: pointer; white-space: nowrap;
           transition: color .15s, border-color .15s; }
.auq-tab:hover { color: var(--vm-ink); }
.auq-tab.on { color: var(--vm-ink); border-bottom-color: var(--vm-violet); }
.auq-tab.done:not(.on) { color: var(--vm-ink); }
.auq-tab:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -2px; border-radius: 6px; }
.auq-tick { color: var(--vm-success, var(--vm-violet)); }
.auq-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.auq-collapsed-text { flex: 1 1 auto; margin: 0; font-size: 13.5px; font-weight: 600; color: var(--vm-ink); }
.auq-bar-actions { display: flex; gap: 2px; margin-left: auto; }
.auq-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0;
            border: 0; border-radius: 8px; background: transparent; color: var(--vm-ink-soft); cursor: pointer;
            transition: background-color .15s, color .15s; }
.auq-icon:hover:not(:disabled) { background: var(--vm-surface-soft); color: var(--vm-ink); }
.auq-icon:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.auq-icon:disabled { opacity: .5; cursor: not-allowed; }
.auq-body { display: flex; flex-direction: column; gap: 10px; }
.auq-q { margin: 0; padding: 0; border: 0; min-width: 0; }
.auq-legend { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 8px; padding: 0; margin: 0 0 10px; }
.auq-text { font-size: 14.5px; font-weight: 600; line-height: 1.45; color: var(--vm-ink); }
.auq-hint { font-size: 12.5px; color: var(--vm-ink-soft); }
.auq-options { display: flex; flex-direction: column; gap: 4px; }
.auq-opt { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; padding: 8px 12px; box-sizing: border-box;
           border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: pointer;
           transition: border-color .15s, background-color .15s; }
.auq-opt:hover { background: var(--vm-surface-soft); }
.auq-opt.on { border-color: var(--vm-violet); background: var(--vm-violet-soft, var(--vm-surface-soft)); }
.auq-opt:focus-within { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.auq-input { margin: 3px 0 0; flex: 0 0 auto; accent-color: var(--vm-violet); width: 16px; height: 16px; cursor: pointer; }
.auq-opt-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
.auq-opt-label { display: flex; align-items: baseline; gap: 8px; font-size: 14px; font-weight: 600; color: var(--vm-ink);
                 line-height: 1.35; }
.auq-key { flex: 0 0 auto; min-width: 14px; font: 600 11.5px/1 var(--vm-font-mono, monospace); color: var(--vm-ink-faint);
           font-variant-numeric: tabular-nums; }
.auq-opt-desc { padding-left: 22px; font-size: 13px; line-height: 1.45; color: var(--vm-ink-soft); }
.auq-other-input { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 7px 9px; border: 1px solid var(--vm-line-2);
                   border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 14px/1.4 var(--vm-font-sans); }
.auq-other-input::placeholder { color: var(--vm-ink-faint); opacity: 1; }
.auq-other-input:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.auq-summary { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.auq-summary li { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; font-size: 14px; }
.auq-summary-head { font-weight: 600; color: var(--vm-ink-soft); min-width: 96px; }
.auq-summary-answer { color: var(--vm-ink); overflow-wrap: anywhere; }
.auq-summary-missing { padding: 0; border: 0; background: none; color: var(--vm-violet); font: inherit; cursor: pointer;
                       text-decoration: underline; text-underline-offset: 2px; }
.auq-summary-missing:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; border-radius: 4px; }
.auq-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.auq-send, .auq-next { min-height: 40px; padding: 0 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
                       transition: background-color .15s, border-color .15s; }
.auq-send { border: 1px solid var(--vm-violet); background: var(--vm-violet); color: #fff; }
.auq-send:hover:not(:disabled) { background: var(--vm-violet-d, var(--vm-violet)); }
.auq-next { border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink); }
.auq-next:hover:not(:disabled) { border-color: var(--vm-violet); }
.auq-send:disabled, .auq-next:disabled { opacity: .5; cursor: not-allowed; }
.auq-send:focus-visible, .auq-next:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.auq-need { font-size: 12.5px; color: var(--vm-ink-soft); }
.auq-foot { margin: 0; font-size: 12px; color: var(--vm-ink-faint); }
@media (max-width: 640px) {
  .auq-tab { min-height: 44px; }
  .auq-icon { width: 44px; height: 44px; }
  .auq-send { flex: 1 1 100%; min-height: 44px; }
  .auq-other-input { font-size: 16px; }
  .auq-foot { display: none; }
}
@media (prefers-reduced-motion: reduce) { .auq-opt, .auq-send, .auq-next, .auq-tab, .auq-icon { transition: none; } }
</style>
