<template>
  <div class="agent-rules-editor">
    <div class="header">
      <div>
        <h4 class="title">Behavioral Rules <span class="muted">(guidance)</span></h4>
        <p class="hint">
          Advisory rules injected into the agent's prompt — they <em>shape</em> behavior, they don't
          enforce. Leave empty for none.
        </p>
      </div>
      <span class="count" :class="{ over: rules.length > MAX_RULES }">{{ rules.length }}/{{ MAX_RULES }}</span>
    </div>

    <ul v-if="rules.length" class="rules-list">
      <li v-for="(rule, i) in rules" :key="i" class="rule-row">
        <span class="num">{{ i + 1 }}.</span>
        <div class="input-wrap">
          <input
            :ref="el => setInputRef(el, i)"
            type="text"
            class="rule-input"
            :class="{ invalid: tooLong(rule) }"
            :value="rule"
            :placeholder="`Rule ${i + 1}, e.g. “Always cite your sources.”`"
            :aria-label="`Rule ${i + 1}`"
            @input="onInput(i, $event.target.value)"
          />
          <p v-if="tooLong(rule)" class="error" role="alert">
            Max {{ MAX_RULE_LEN }} characters ({{ rule.length }}).
          </p>
        </div>
        <button type="button" class="remove" :aria-label="`Remove rule ${i + 1}`" @click="removeRule(i)">×</button>
      </li>
    </ul>

    <p v-if="rules.length >= MAX_RULES" class="error">Maximum {{ MAX_RULES }} rules reached.</p>

    <button type="button" class="add" :disabled="rules.length >= MAX_RULES" @click="addRule">
      + Add rule
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick } from 'vue'
import { MAX_RULES, MAX_RULE_LEN } from './agentRules'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

// Always work against an array (defensive: backend may send null on legacy rows).
const rules = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

const tooLong = (r) => (r || '').length > MAX_RULE_LEN

const inputRefs = []
function setInputRef(el, i) {
  if (el) inputRefs[i] = el
}

function emitRules(next) {
  emit('update:modelValue', next)
}

function onInput(i, value) {
  const next = rules.value.slice()
  next[i] = value
  emitRules(next)
}

async function addRule() {
  if (rules.value.length >= MAX_RULES) return
  const next = rules.value.slice()
  next.push('')
  emitRules(next)
  await nextTick()
  const el = inputRefs[next.length - 1]
  if (el && el.focus) el.focus()
}

function removeRule(i) {
  const next = rules.value.slice()
  next.splice(i, 1)
  emitRules(next)
}

// Exposed so the parent form's submit handler can block save on validation errors.
const isValid = computed(
  () => rules.value.length <= MAX_RULES && rules.value.every((r) => !tooLong(r)),
)
defineExpose({ isValid, MAX_RULES, MAX_RULE_LEN })
</script>

<style scoped>
.agent-rules-editor { display: flex; flex-direction: column; gap: 8px; }
.header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.title { font-size: 0.9rem; font-weight: 600; color: #0f172a; margin: 0; }
.muted { font-weight: 400; color: #94a3b8; font-size: 0.8rem; }
.hint { font-size: 0.75rem; color: #64748b; margin: 2px 0 0; }
.count { font-size: 0.75rem; color: #94a3b8; white-space: nowrap; }
.count.over { color: #dc2626; }
.rules-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rule-row { display: flex; align-items: flex-start; gap: 8px; }
.num { font-size: 0.8rem; color: #94a3b8; padding-top: 8px; min-width: 18px; }
.input-wrap { flex: 1; }
.rule-input {
  width: 100%; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 0.85rem; color: #0f172a;
}
.rule-input:focus { outline: none; border-color: #c7d2fe; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
.rule-input.invalid { border-color: #fca5a5; }
.error { font-size: 0.72rem; color: #dc2626; margin: 3px 0 0; }
.remove {
  border: none; background: transparent; color: #94a3b8; font-size: 1.1rem; line-height: 1;
  cursor: pointer; padding: 4px 6px; border-radius: 6px;
}
.remove:hover { color: #dc2626; background: #fef2f2; }
.add {
  align-self: flex-start; margin-top: 2px; padding: 5px 10px; font-size: 0.8rem; font-weight: 500;
  color: #4f46e5; background: #eef2ff; border: 1px solid #e0e7ff; border-radius: 8px; cursor: pointer;
}
.add:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
