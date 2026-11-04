<template>
  <section v-if="look" class="sld" aria-label="Customize selected look">
    <div class="sld-heading"><span>MAKE IT YOURS</span><small>Prepared direction · editable</small></div>
    <div class="sld-fields"><label v-for="field in look.variables || []" :key="field.id" class="st-field">{{ field.label }}<input v-model="values[field.id]" class="st-input" :maxlength="1000" :placeholder="field.default" /></label></div>
    <div class="sld-references"><span v-for="slot in look.slots || []" :key="slot.id">{{ slot.label }} <small>{{ slot.required ? 'Required' : 'Optional' }}</small></span><span v-if="!look.slots?.length">No upload needed to start this direction.</span></div>
    <details><summary>View prepared prompt</summary><p>{{ prompt }}</p></details>
    <button type="button" class="st-button primary" :disabled="disabled" @click="apply">Use this direction ↗</button>
    <button v-if="look.clientOnly" type="button" class="st-button" :aria-pressed="saved.ids.value.includes(look.id)" @click="saved.toggle(look.id)">{{ saved.ids.value.includes(look.id) ? '♥ Saved template' : '♡ Save template' }}</button>
    <button v-if="!naming" ref="saveButton" type="button" class="st-button" data-test="look-save-mine" @click="startNaming">Save as my template</button>
    <form v-else class="sld-name" data-test="look-save-mine-form" aria-label="Save as my template" @submit.prevent="saveMine" @keydown.esc.prevent="stopNaming">
      <label class="st-field">Template name<input ref="nameInput" v-model="name" class="st-input" data-test="look-save-mine-name" :maxlength="TEMPLATE_TITLE_MAX" required :aria-invalid="nameError ? 'true' : undefined" :aria-describedby="nameError ? errorId : undefined" /></label>
      <div class="sld-name-actions"><button type="submit" class="st-button primary" data-test="look-save-mine-confirm" :disabled="busy || !name.trim()">{{ busy ? 'Saving…' : 'Save template' }}</button><button type="button" class="st-button" :disabled="busy" @click="stopNaming">Cancel</button></div>
      <p v-if="nameError" :id="errorId" class="st-error" role="alert" data-test="look-save-mine-error">{{ nameError }}</p>
    </form>
    <p v-if="savedNote" class="st-status" role="status" data-test="look-save-mine-done">{{ savedNote }}</p>
    <p class="sld-note">Attach your own media with + in the chat. Your agent checks the inputs, model and price before generation.</p>
  </section>
</template>
<script setup>
import { computed, nextTick, reactive, ref, useId, watch } from 'vue'
import { composePreset } from '../../services/studioPresets'
import { useStudioSavedLooks } from '../../composables/useStudioSavedLooks'
import { useStudioTemplates, TEMPLATE_TITLE_MAX } from '../../composables/useStudioTemplates'
// settings: the page's current settings (aspect ratio, duration...), saved with a template where the page has them.
const props = defineProps({ look: Object, disabled: Boolean, settings: { type: Object, default: null } })
const emit = defineEmits(['apply'])
const values = reactive({})
const saved = useStudioSavedLooks()
// A template used on the page keeps its look's id with its own texts, so the variables are watched too.
watch([() => props.look?.id, () => props.look?.variables], () => { for (const key of Object.keys(values)) delete values[key]; for (const field of props.look?.variables || []) values[field.id] = field.default }, { immediate: true })
const prompt = computed(() => composePreset({ ...props.look, variants: [] }, values))
// "Save as my template": the name is asked for here, in the page; the look's page, the look, its prompt as edited,
// the variable texts and the page's settings go to the person's account. Nothing is generated.
const mine = useStudioTemplates(), errorId = `sld-name-error-${useId()}`
const naming = ref(false), name = ref(''), busy = ref(false), nameError = ref(''), savedNote = ref(''), nameInput = ref(null), saveButton = ref(null)
watch(() => props.look?.id, () => { naming.value = false; nameError.value = ''; savedNote.value = '' })
async function startNaming() { name.value = String(props.look?.title || '').slice(0, TEMPLATE_TITLE_MAX); nameError.value = ''; savedNote.value = ''; naming.value = true; await nextTick(); nameInput.value?.focus(); nameInput.value?.select?.() }
async function stopNaming() { if (busy.value) return; naming.value = false; nameError.value = ''; await nextTick(); saveButton.value?.focus() }
async function saveMine() {
  if (busy.value || !props.look) return
  busy.value = true; nameError.value = ''
  const variables = Object.fromEntries((props.look.variables || []).map(field => [field.label, String(values[field.id] ?? field.default ?? '')]))
  try {
    const result = await mine.create({ page: props.look.feature, base_look: props.look.id || '', title: name.value, prompt: prompt.value, variables, settings: { ...(props.look.settings || {}), ...(props.settings || {}) } })
    if (result.ok) { naming.value = false; savedNote.value = `Saved "${result.template?.title || name.value.trim()}" to My templates.`; await nextTick(); saveButton.value?.focus() }
    else nameError.value = result.error || 'Could not save your template.'
  } finally { busy.value = false }
}
function apply() { emit('apply', { ...props.look, promptTemplate: prompt.value, variants: [], variables: props.look.variables?.map(field => ({ ...field, default: values[field.id] || field.default })) }) }
</script>
<style scoped>
.sld{display:grid;gap:16px;padding:20px;border:1px solid var(--vm-line);border-radius:10px;background:var(--vm-surface)}.sld-heading{display:flex;justify-content:space-between;gap:12px;font-size:10px;letter-spacing:.1em;color:var(--vs-accent-ink)}.sld-heading small{letter-spacing:0;color:var(--vm-ink-faint)}.sld-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.sld-references{display:flex;gap:10px;flex-wrap:wrap;color:var(--vm-ink-soft);font-size:12px}.sld-references span{padding:7px 9px;border:1px dashed var(--vm-line);border-radius:6px}.sld-references small{color:var(--vm-ink-faint);margin-left:6px}.sld details{font-size:12px;color:var(--vm-ink-soft)}.sld summary{cursor:pointer;min-height:32px}.sld details p{line-height:1.8;white-space:pre-wrap}.sld>.st-button{justify-self:start}.sld-note{font-size:11px;color:var(--vm-ink-faint);line-height:1.8}.sld-name{display:grid;gap:10px;max-width:420px}.sld-name-actions{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:680px){.sld-name{max-width:none}.sld-name-actions .st-button{min-height:44px;flex:1}.sld{padding:15px}.sld-fields{grid-template-columns:1fr}.sld>.st-button{width:100%}.sld-heading{flex-wrap:wrap}.sld summary{min-height:44px}}
</style>
