<template>
  <section class="st-page" :class="{ 'st-chat-expanded': chatExpanded }" :aria-labelledby="titleId">
    <header class="st-page-head"><div><h1 :id="titleId">{{ title }}</h1><p class="st-muted">{{ purpose }}</p></div><slot name="header"><button v-if="presetPicker" type="button" class="st-button" :disabled="newDisabled" @click="emit('new')">New</button></slot></header>
    <div class="st-page-body">
      <aside class="st-controls" aria-label="Inputs and settings"><div ref="form" class="st-form" tabindex="-1"><slot name="form" :narrow="narrow" /></div><div class="st-quote"><slot name="quote" /></div></aside>
      <section class="st-output" aria-label="Presets and results">
        <div v-if="$slots.references" ref="references" class="st-reference-panel" role="region" aria-label="Reference inputs"><slot name="references" /></div>
        <h2 v-if="narrow && presetPicker" class="st-results-heading">My results</h2>
        <div v-else class="st-tabs" role="tablist" aria-label="Creative workspace">
          <button v-for="(tab, i) in tabs" :key="tab.key" type="button" role="tab" :id="`${titleId}-${tab.key}-tab`" :aria-controls="`${titleId}-${tab.key}`" :aria-selected="activeTab === tab.key" :tabindex="activeTab === tab.key ? 0 : -1" :class="{ active: activeTab === tab.key }" @click="emit('update:activeTab', tab.key)" @keydown="moveTab($event, i)">{{ tab.label }}</button>
        </div>
        <div v-if="narrow && presetPicker" class="st-output-body" aria-label="My results"><slot name="results" /></div>
        <template v-else><div v-for="tab in tabs" :key="tab.key" v-show="activeTab === tab.key" :id="`${titleId}-${tab.key}`" role="tabpanel" :aria-labelledby="`${titleId}-${tab.key}-tab`" class="st-output-body"><slot :name="tab.key" /></div></template>
      </section>
    </div>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import './studio.css'
// workLabel: what the first output tab holds (presets on Image and Video, a preview or a workspace elsewhere).
const props = defineProps({ chatExpanded: Boolean, title: String, purpose: String, activeTab: { type: String, default: 'presets' }, presetPicker: Boolean, newDisabled: Boolean, workLabel: { type: String, default: 'Presets' } })
const emit = defineEmits(['update:activeTab','new'])
const titleId = `studio-${useId()}`
const form = ref(null), references = ref(null)
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 1023px)') : null
const narrow = ref(media?.matches ?? false)
function mediaChanged(event) { narrow.value = event.matches }
media?.addEventListener?.('change', mediaChanged)
onBeforeUnmount(() => media?.removeEventListener?.('change', mediaChanged))
const tabs = computed(() => [{ key: 'presets', label: props.workLabel }, { key: 'results', label: 'My results' }])
function moveTab(event, index) {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (index + 1) % 2
  emit('update:activeTab', tabs.value[next].key)
  event.currentTarget.parentElement.querySelectorAll('button')[next]?.focus()
}
defineExpose({ focusInputs() { const target = props.chatExpanded ? (form.value?.querySelector('textarea') || form.value) : references.value?.querySelector('[data-studio-required-empty="true"]') || form.value?.querySelector('[data-studio-required-empty="true"]') || form.value; target?.scrollIntoView?.({ block: 'center' }); target?.focus() } })
</script>
<style scoped>
.st-page{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--vm-bg)}.st-page-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0;min-height:76px;padding:14px 24px 14px calc(24px + var(--vs-bar-inset,0px));border-bottom:1px solid var(--vm-line-2)}.st-page-head p{margin-top:5px;max-width:65ch;font-size:13px}.st-page-body{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);flex:1;min-height:0}.st-controls{display:flex;flex-direction:column;min-width:0;min-height:0;border-right:1px solid var(--vm-line-2);background:var(--vm-surface)}.st-form{display:flex;flex-direction:column;gap:20px;flex:1;min-height:0;overflow-y:auto;padding:24px;outline:0}.st-quote{flex-shrink:0;border-top:1px solid var(--vm-line);background:var(--vm-surface)}.st-output{display:flex;flex-direction:column;min-width:0;min-height:0}.st-tabs{display:flex;gap:24px;flex-shrink:0;padding:0 24px;border-bottom:1px solid var(--vm-line-2)}.st-tabs button{min-height:52px;border:0;border-bottom:2px solid transparent;background:none;color:var(--vm-ink-soft);font:500 13px var(--vm-font-sans);cursor:pointer}.st-tabs button.active{border-bottom-color:var(--vm-violet);color:var(--vm-ink)}.st-output-body{flex:1;min-height:0;overflow:auto;padding:24px}
.st-reference-panel{flex-shrink:0;min-width:0;max-height:min(45vh,420px);overflow:auto;padding:20px 24px;border-bottom:1px solid var(--vm-line-2);background:var(--vm-surface)}
.st-results-heading{padding:16px 24px;border-bottom:1px solid var(--vm-line-2)}
@media(max-width:1023px){.st-page{flex:none;height:auto;min-height:100%;padding-bottom:150px}.st-page-head{padding:12px 16px 12px calc(16px + var(--vs-bar-inset,0px));min-height:76px;align-items:flex-start}.st-page-head p{font-size:13px}.st-page-body{display:flex;flex:none;flex-direction:column;min-height:auto}.st-output{order:1;flex:none;min-height:260px}.st-controls{order:0;flex:none;min-height:auto;border-right:0;border-top:1px solid var(--vm-line-2)}.st-form{flex:none;min-height:auto;padding:20px 16px;overflow:visible}.st-output-body{flex:none;min-height:auto;padding:20px 16px;overflow:visible}.st-reference-panel{max-height:none;overflow:visible;padding:20px 16px}.st-tabs{padding-inline:16px}.st-tabs button{min-height:48px;font-size:14px}.st-quote{position:fixed;bottom:0;left:0;right:0;z-index:40;padding-bottom:env(safe-area-inset-bottom)}}

.st-chat-expanded .st-page-body{grid-template-columns:minmax(0,1fr)}.st-chat-expanded .st-output{display:none}.st-chat-expanded .st-controls{border-right:0}.st-chat-expanded .st-form{width:100%;max-width:1000px;margin-inline:auto}
</style>
