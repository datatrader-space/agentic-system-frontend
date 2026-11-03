<template>
  <section v-if="look" class="sld" aria-label="Customize selected look">
    <div class="sld-heading"><span>MAKE IT YOURS</span><small>Prepared direction · editable</small></div>
    <div class="sld-fields"><label v-for="field in look.variables || []" :key="field.id" class="st-field">{{ field.label }}<input v-model="values[field.id]" class="st-input" :maxlength="1000" :placeholder="field.default" /></label></div>
    <div class="sld-references"><span v-for="slot in look.slots || []" :key="slot.id">{{ slot.label }} <small>{{ slot.required ? 'Required' : 'Optional' }}</small></span><span v-if="!look.slots?.length">No upload needed to start this direction.</span></div>
    <details><summary>View prepared prompt</summary><p>{{ prompt }}</p></details>
    <button type="button" class="st-button primary" :disabled="disabled" @click="apply">Use this direction ↗</button>
    <button v-if="look.clientOnly" type="button" class="st-button" :aria-pressed="saved.ids.value.includes(look.id)" @click="saved.toggle(look.id)">{{ saved.ids.value.includes(look.id) ? '♥ Saved template' : '♡ Save template' }}</button>
    <p class="sld-note">Attach your own media with + in the chat. Your agent checks the inputs, model and price before generation.</p>
  </section>
</template>
<script setup>
import { computed, reactive, watch } from 'vue'
import { composePreset } from '../../services/studioPresets'
import { useStudioSavedLooks } from '../../composables/useStudioSavedLooks'
const props = defineProps({ look: Object, disabled: Boolean })
const emit = defineEmits(['apply'])
const values = reactive({})
const saved = useStudioSavedLooks()
watch(() => props.look?.id, () => { for (const key of Object.keys(values)) delete values[key]; for (const field of props.look?.variables || []) values[field.id] = field.default }, { immediate: true })
const prompt = computed(() => composePreset({ ...props.look, variants: [] }, values))
function apply() { emit('apply', { ...props.look, promptTemplate: prompt.value, variants: [], variables: props.look.variables?.map(field => ({ ...field, default: values[field.id] || field.default })) }) }
</script>
<style scoped>
.sld{display:grid;gap:16px;padding:20px;border:1px solid var(--vm-line);border-radius:10px;background:var(--vm-surface)}.sld-heading{display:flex;justify-content:space-between;gap:12px;font-size:10px;letter-spacing:.1em;color:var(--vs-accent-ink)}.sld-heading small{letter-spacing:0;color:var(--vm-ink-faint)}.sld-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.sld-references{display:flex;gap:10px;flex-wrap:wrap;color:var(--vm-ink-soft);font-size:12px}.sld-references span{padding:7px 9px;border:1px dashed var(--vm-line);border-radius:6px}.sld-references small{color:var(--vm-ink-faint);margin-left:6px}.sld details{font-size:12px;color:var(--vm-ink-soft)}.sld summary{cursor:pointer;min-height:32px}.sld details p{line-height:1.8;white-space:pre-wrap}.sld>.st-button{justify-self:start}.sld-note{font-size:11px;color:var(--vm-ink-faint);line-height:1.8}@media(max-width:680px){.sld{padding:15px}.sld-fields{grid-template-columns:1fr}.sld>.st-button{width:100%}.sld-heading{flex-wrap:wrap}.sld summary{min-height:44px}}
</style>
