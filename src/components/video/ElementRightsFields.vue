<template>
  <!-- The rights statement (the IP check) and a real person's consent, as the server words and versions them. One
       piece for every place an Element is approved: the Elements page, Character Studio, the brand kit. -->
  <div class="erf">
    <fieldset v-if="needsRights" class="erf-set">
      <legend>Your rights to {{ name || 'this' }}</legend>
      <label v-for="b in bases" :key="b.value" class="erf-radio"><input v-model="model.basis" type="radio" :name="`basis-${uid}`" :value="b.value" :data-test="`ea-basis-${b.value}`" /> {{ b.label }}</label>
      <p class="erf-statement">{{ statements.rights?.statement }}</p>
      <label class="erf-check"><input v-model="model.rightsConfirmed" type="checkbox" data-test="ea-rights-confirm" /> I confirm this statement</label>
    </fieldset>
    <label v-if="kind === 'character'" class="erf-check"><input v-model="model.realPerson" type="checkbox" data-test="ea-real-person" /> This character is a real person</label>
    <fieldset v-if="realPerson" class="erf-set">
      <legend>{{ hasSample ? 'Whose voice this is' : 'Who is shown' }}</legend>
      <label class="erf-field"><span>Their name</span><input v-model="model.subject" maxlength="200" autocomplete="off" data-test="ea-subject" /></label>
      <label v-for="b in consentBases" :key="b.value" class="erf-radio"><input v-model="model.consentBasis" type="radio" :name="`consent-${uid}`" :value="b.value" /> {{ b.label }}</label>
      <p class="erf-statement">{{ statements.likeness?.statement }}</p>
      <label class="erf-check"><input v-model="model.consentConfirmed" type="checkbox" data-test="ea-consent-confirm" /> I confirm this statement</label>
    </fieldset>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { BASIS_LABELS, RIGHTS_KINDS } from './elementKinds'

const props = defineProps({ kind: { type: String, required: true }, name: { type: String, default: '' },
  hasSample: { type: Boolean, default: false }, schema: { type: Object, default: null } })
const model = defineModel({ type: Object, required: true })
const uid = Math.random().toString(36).slice(2, 8)
const statements = computed(() => props.schema?.statements || {})
const bases = computed(() => statements.value.rights?.bases || Object.entries(BASIS_LABELS).map(([value, label]) => ({ value, label })))
const consentBases = computed(() => statements.value.likeness?.bases || [{ value: 'self', label: 'This is me' }, { value: 'permission', label: 'I have their written permission' }])
const needsRights = computed(() => RIGHTS_KINDS.includes(props.kind))
const realPerson = computed(() => props.hasSample || (props.kind === 'character' && !!model.value.realPerson))
</script>

<style scoped>
.erf { display: grid; gap: 10px; }
.erf-set { display: grid; gap: 6px; margin: 0; padding: 0; border: 0; min-width: 0; }
.erf-set legend { padding: 0; margin-bottom: 4px; font-size: 13px; font-weight: 600; color: var(--vm-ink, #0f172a); }
.erf-radio, .erf-check { display: flex; align-items: center; gap: 8px; min-height: 32px; font-size: 13px; color: var(--vm-ink, #0f172a); cursor: pointer; }
.erf-radio input, .erf-check input { width: 16px; height: 16px; accent-color: var(--vm-violet-d, #4f46e5); }
.erf-statement { margin: 2px 0; padding-left: 10px; border-left: 2px solid var(--vm-line, #cbd5e1); font-size: 12.5px; line-height: 1.55; color: var(--vm-ink-soft, #475569); max-width: 60ch; }
.erf-field { display: grid; gap: 6px; font-size: 12.5px; font-weight: 500; color: var(--vm-ink-soft, #64748b); }
.erf-field input { min-height: 40px; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px;
  background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; }
.erf :focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
@media (pointer: coarse) { .erf-radio, .erf-check { min-height: 44px; } }
@media (max-width: 640px) { .erf-field input { font-size: 16px; } }
</style>
