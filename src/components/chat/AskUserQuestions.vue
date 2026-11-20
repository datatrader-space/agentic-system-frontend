<template>
  <!-- The agent's questions (ASK_USER, Claude Code's AskUserQuestion shape): one to four questions, each with a short
       header and two to four options with what each means; some let the person pick more than one. "Other" is always
       there, to answer in their own words. One Send for all of them. -->
  <form class="auq" data-test="ask-user-questions" @submit.prevent="send">
    <fieldset v-for="(q, qi) in questions" :key="qi" class="auq-q" :data-test="`auq-q-${qi}`">
      <legend class="auq-legend">
        <span v-if="q.header" class="auq-chip">{{ q.header }}</span>
        <span class="auq-text">{{ q.question }}</span>
        <span v-if="q.multiSelect" class="auq-hint">Choose any that apply</span>
      </legend>
      <div class="auq-options" :role="q.multiSelect ? 'group' : 'radiogroup'" :aria-label="q.question">
        <label v-for="(o, oi) in q.options" :key="oi" class="auq-opt" :class="{ on: isPicked(qi, o.label) }"
               :data-test="`auq-opt-${qi}-${oi}`">
          <input :type="q.multiSelect ? 'checkbox' : 'radio'" class="auq-input" :name="`auq-${uid}-${qi}`"
                 :value="o.label" :checked="isPicked(qi, o.label)" :disabled="disabled" @change="pick(qi, o.label)" />
          <span class="auq-opt-text">
            <span class="auq-opt-label">{{ o.label }}</span>
            <span v-if="o.description" class="auq-opt-desc">{{ o.description }}</span>
          </span>
        </label>
        <label class="auq-opt auq-other" :class="{ on: state[qi].otherOn }" :data-test="`auq-other-${qi}`">
          <input :type="q.multiSelect ? 'checkbox' : 'radio'" class="auq-input" :name="`auq-${uid}-${qi}`"
                 value="__other__" :checked="state[qi].otherOn" :disabled="disabled" @change="toggleOther(qi)" />
          <span class="auq-opt-text">
            <span class="auq-opt-label">Other</span>
            <input v-model="state[qi].other" class="auq-other-input" type="text" :disabled="disabled"
                   :aria-label="`Your own answer to: ${q.question}`" placeholder="Type your own answer"
                   autocomplete="off" :data-test="`auq-other-text-${qi}`" @focus="otherFocus(qi)" />
          </span>
        </label>
      </div>
    </fieldset>
    <div class="auq-row">
      <button type="submit" class="auq-send" :disabled="disabled || !complete" data-test="auq-send">
        {{ questions.length > 1 ? 'Send answers' : 'Send answer' }}
      </button>
      <span v-if="!complete && !disabled" class="auq-need">Answer {{ questions.length > 1 ? 'each question' : 'the question' }} to send.</span>
    </div>
  </form>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  // [{ question, header, options: [{ label, description }], multiSelect }]
  questions: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['answer'])
const uid = Math.random().toString(36).slice(2, 8)

const fresh = () => props.questions.map(() => ({ picked: [], otherOn: false, other: '' }))
const state = reactive(fresh())
watch(() => props.questions, () => { state.splice(0, state.length, ...fresh()) })

const isPicked = (qi, label) => state[qi].picked.includes(label)
function pick(qi, label) {
  const s = state[qi]
  if (props.questions[qi].multiSelect) {
    s.picked = s.picked.includes(label) ? s.picked.filter((x) => x !== label) : [...s.picked, label]
  } else {
    s.picked = [label]
    s.otherOn = false
  }
}
function toggleOther(qi) {
  const s = state[qi]
  s.otherOn = props.questions[qi].multiSelect ? !s.otherOn : true
  if (s.otherOn && !props.questions[qi].multiSelect) s.picked = []
}
function otherFocus(qi) {
  const s = state[qi]
  if (!s.otherOn) toggleOther(qi)
}

// Each question has an answer: an option, or "Other" with words.
const answered = (s) => (s.picked.length > 0 && (!s.otherOn || s.other.trim())) || (s.otherOn && s.other.trim())
const complete = computed(() => state.length === props.questions.length && state.every(answered))

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
.auq { display: flex; flex-direction: column; gap: 14px; }
.auq-q { margin: 0; padding: 0; border: 0; min-width: 0; }
.auq-legend { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 8px; padding: 0; margin: 0 0 8px; }
.auq-chip { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; letter-spacing: .01em;
            background: var(--vm-violet-soft, var(--vm-surface-soft)); color: var(--vm-violet); }
.auq-text { font-size: 14px; font-weight: 600; line-height: 1.45; color: var(--vm-ink); }
.auq-hint { font-size: 12.5px; color: var(--vm-ink-soft); }
.auq-options { display: flex; flex-direction: column; gap: 6px; }
.auq-opt { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; padding: 9px 12px; box-sizing: border-box;
           border: 1px solid var(--vm-line-2); border-radius: 10px; background: var(--vm-surface); cursor: pointer;
           transition: border-color .15s, background-color .15s; }
.auq-opt:hover { border-color: var(--vm-violet); }
.auq-opt.on { border-color: var(--vm-violet); background: var(--vm-violet-soft, var(--vm-surface-soft)); }
.auq-opt:focus-within { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.auq-input { margin: 3px 0 0; flex: 0 0 auto; accent-color: var(--vm-violet); width: 16px; height: 16px; cursor: pointer; }
.auq-opt-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }
.auq-opt-label { font-size: 14px; font-weight: 600; color: var(--vm-ink); line-height: 1.35; }
.auq-opt-desc { font-size: 13px; line-height: 1.45; color: var(--vm-ink-soft); }
.auq-other-input { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 7px 9px; border: 1px solid var(--vm-line-2);
                   border-radius: 8px; background: var(--vm-surface); color: var(--vm-ink); font: 14px/1.4 var(--vm-font-sans); }
.auq-other-input::placeholder { color: var(--vm-ink-faint); opacity: 1; }
.auq-other-input:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.auq-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.auq-send { min-height: 40px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--vm-violet); background: var(--vm-violet);
            color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color .15s; }
.auq-send:hover:not(:disabled) { background: var(--vm-violet-d, var(--vm-violet)); }
.auq-send:disabled { opacity: .5; cursor: not-allowed; }
.auq-send:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.auq-need { font-size: 12.5px; color: var(--vm-ink-soft); }
@media (max-width: 640px) {
  .auq-send { flex: 1 1 100%; min-height: 44px; }
  .auq-other-input { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) { .auq-opt, .auq-send { transition: none; } }
</style>
