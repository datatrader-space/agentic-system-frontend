<template>
  <section class="st-page" :class="{ 'st-chat-expanded': chatExpanded, 'st-page-agent': agentMode, 'st-mobile-output': mobilePane === 'output' }" :aria-labelledby="titleId">
    <header class="st-page-head"><div class="st-title-block"><span v-if="feature" class="st-title-icon"><StudioNavIcon :name="feature.icon" /></span><div><span v-if="feature" class="st-title-category">{{ feature.group }}</span><h1 :id="titleId">{{ title }}</h1><p class="st-muted">{{ purpose }}</p></div></div><slot name="header"><StudioProjectPicker v-if="agentMode" /><button v-else-if="presetPicker" type="button" class="st-button" :disabled="newDisabled" @click="emit('new')">{{ agentMode ? 'New chat' : 'New' }}</button></slot></header>
    <nav v-if="agentMode && narrow" class="st-mobile-tabs" role="tablist" aria-label="Workspace sections"><button v-for="(item,index) in mobileTabs" :key="item.key" type="button" role="tab" :id="`${titleId}-mobile-${item.key}-tab`" :aria-controls="item.key === 'create' ? `${titleId}-chat` : `${titleId}-${item.key}`" :aria-selected="mobilePane === 'create' ? item.key === 'create' : item.key === activeTab" :tabindex="(mobilePane === 'create' ? item.key === 'create' : item.key === activeTab) ? 0 : -1" @click="selectMobile(item.key)" @keydown="moveMobile($event,index)">{{ item.label }}</button></nav>
    <div class="st-page-body">
      <aside :id="`${titleId}-chat`" class="st-controls" aria-label="Inputs and settings"><div ref="form" class="st-form" tabindex="-1"><slot name="form" :narrow="narrow" /></div><div v-if="!agentMode" class="st-quote"><slot name="quote" /></div></aside>
      <section class="st-output" aria-label="Presets and results">
        <div v-if="$slots.references" ref="references" class="st-reference-panel" role="region" aria-label="Reference inputs"><slot name="references" /></div>
        <h2 v-if="narrow && presetPicker && !agentMode" class="st-results-heading">My results</h2>
        <div v-else class="st-tabs" role="tablist" aria-label="Creative workspace">
          <button v-for="(tab, i) in tabs" :key="tab.key" type="button" role="tab" :id="`${titleId}-${tab.key}-tab`" :aria-controls="`${titleId}-${tab.key}`" :aria-selected="activeTab === tab.key" :tabindex="activeTab === tab.key ? 0 : -1" :class="{ active: activeTab === tab.key }" @click="emit('update:activeTab', tab.key)" @keydown="moveTab($event, i)">{{ tab.label }}</button>
        </div>
        <div v-if="narrow && presetPicker && !agentMode" class="st-output-body" aria-label="My results"><slot name="results" /></div>
        <template v-else><div v-for="tab in tabs" :key="tab.key" v-show="activeTab === tab.key" :id="`${titleId}-${tab.key}`" role="tabpanel" :aria-labelledby="narrow && agentMode ? `${titleId}-mobile-${tab.key}-tab` : `${titleId}-${tab.key}-tab`" class="st-output-body"><slot :name="tab.key" /></div></template>
      </section>
    </div>
  </section>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId, useSlots } from 'vue'
import './studio.css'
import StudioNavIcon from '../video-shell/StudioNavIcon.vue'
import StudioProjectPicker from './StudioProjectPicker.vue'
// workLabel: what the first output tab holds (presets on Image and Video, a preview or a workspace elsewhere).
const props = defineProps({ feature: Object, chatExpanded: Boolean, agentMode: Boolean, title: String, purpose: String, activeTab: { type: String, default: 'presets' }, presetPicker: Boolean, newDisabled: Boolean, workLabel: { type: String, default: 'Presets' } })
const emit = defineEmits(['update:activeTab','new'])
const titleId = `studio-${useId()}`
const form = ref(null), references = ref(null), mobilePane = ref('create'), slots = useSlots()
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 1023px)') : null
const narrow = ref(media?.matches ?? false)
function mediaChanged(event) { narrow.value = event.matches }
media?.addEventListener?.('change', mediaChanged)
onBeforeUnmount(() => media?.removeEventListener?.('change', mediaChanged))
const tabs = computed(() => [{ key: 'presets', label: props.workLabel }, ...(slots.looks ? [{ key: 'looks', label: 'Looks' }] : []), { key: 'results', label: 'My results' }, ...(slots.versions ? [{ key: 'versions', label: 'Versions' }] : [])])
const mobileTabs = computed(() => [{ key: 'create', label: 'Chat' }, ...tabs.value.map(tab => ({ ...tab, label: tab.key === 'presets' ? 'Preview' : tab.key === 'results' ? 'Results' : tab.label }))])
function selectMobile(key) { mobilePane.value = key === 'create' ? 'create' : 'output'; if (key !== 'create') emit('update:activeTab', key) }
function moveMobile(event,index) { if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? mobileTabs.value.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + mobileTabs.value.length) % mobileTabs.value.length; selectMobile(mobileTabs.value[next].key); event.currentTarget.parentElement.querySelectorAll('button')[next]?.focus() }
function moveTab(event, index) {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.value.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.value.length) % tabs.value.length
  emit('update:activeTab', tabs.value[next].key)
  event.currentTarget.parentElement.querySelectorAll('button')[next]?.focus()
}
defineExpose({ async focusInputs() { if (props.agentMode && narrow.value && mobilePane.value !== 'create') { mobilePane.value = 'create'; await nextTick() } const target = props.chatExpanded || props.agentMode ? (form.value?.querySelector('textarea') || form.value) : references.value?.querySelector('[data-studio-required-empty="true"]') || form.value?.querySelector('[data-studio-required-empty="true"]') || form.value; target?.scrollIntoView?.({ block: 'center' }); target?.focus() } })
</script>
<style scoped>
.st-page{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--vm-bg)}.st-page-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0;min-height:76px;padding:14px 24px 14px calc(24px + var(--vs-bar-inset,0px));border-bottom:1px solid var(--vm-line-2)}.st-page-head p{margin-top:5px;max-width:65ch;font-size:13px}.st-page-body{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);flex:1;min-height:0}.st-controls{display:flex;flex-direction:column;min-width:0;min-height:0;border-right:1px solid var(--vm-line-2);background:var(--vm-surface)}.st-form{display:flex;flex-direction:column;gap:20px;flex:1;min-height:0;overflow-y:auto;padding:24px;outline:0}.st-quote{flex-shrink:0;border-top:1px solid var(--vm-line);background:var(--vm-surface)}.st-output{display:flex;flex-direction:column;min-width:0;min-height:0}.st-tabs{display:flex;gap:24px;flex-shrink:0;padding:0 24px;border-bottom:1px solid var(--vm-line-2)}.st-tabs button{min-height:52px;border:0;border-bottom:2px solid transparent;background:none;color:var(--vm-ink-soft);font:500 13px var(--vm-font-sans);cursor:pointer}.st-tabs button.active{border-bottom-color:var(--vm-violet);color:var(--vm-ink)}.st-output-body{flex:1;min-height:0;overflow:auto;padding:24px}
.st-reference-panel{flex-shrink:0;min-width:0;max-height:min(45vh,420px);overflow:auto;padding:20px 24px;border-bottom:1px solid var(--vm-line-2);background:var(--vm-surface)}
.st-results-heading{padding:16px 24px;border-bottom:1px solid var(--vm-line-2)}
@media(max-width:1023px){.st-page{flex:none;height:auto;min-height:100%;padding-bottom:150px}.st-page-head{padding:12px 16px 12px calc(16px + var(--vs-bar-inset,0px));min-height:76px;align-items:flex-start}.st-page-head p{font-size:13px}.st-page-body{display:flex;flex:none;flex-direction:column;min-height:auto}.st-output{order:1;flex:none;min-height:260px}.st-controls{order:0;flex:none;min-height:auto;border-right:0;border-top:1px solid var(--vm-line-2)}.st-form{flex:none;min-height:auto;padding:20px 16px;overflow:visible}.st-output-body{flex:none;min-height:auto;padding:20px 16px;overflow:visible}.st-reference-panel{max-height:none;overflow:visible;padding:20px 16px}.st-tabs{padding-inline:16px}.st-tabs button{min-height:48px;font-size:14px}.st-quote{position:fixed;bottom:0;left:0;right:0;z-index:40;padding-bottom:env(safe-area-inset-bottom)}}

.st-chat-expanded .st-page-body{grid-template-columns:minmax(0,1fr)}.st-chat-expanded .st-output{display:none}.st-chat-expanded .st-controls{border-right:0}.st-chat-expanded .st-form{width:100%;max-width:1000px;margin-inline:auto}
.st-mobile-tabs{display:none}.st-page-agent .st-form{padding:18px;gap:14px;overflow:hidden}.st-page-agent .st-controls{background:var(--vm-surface)}.st-page-agent :deep(.sap){min-height:0;height:100%;gap:14px}.st-page-agent :deep(.sap-scroll){min-height:120px}.st-page-agent :deep(.sap-intro){font-size:13px;line-height:1.8}.st-page-agent :deep(.sap-composer){padding-bottom:2px}
@media(max-width:1023px){.st-page-agent{flex:1;height:100%;min-height:0;padding-bottom:0}.st-page-agent .st-page-head{min-height:62px;padding-block:14px}.st-page-agent .st-page-head p{display:none}.st-page-agent .st-page-body{flex:1;min-height:0;overflow:hidden}.st-page-agent .st-controls{flex:1;min-height:0;overflow:hidden}.st-page-agent .st-form{flex:1;min-height:0;overflow:hidden;padding:14px}.st-page-agent .st-output{display:none;flex:1;min-height:0;overflow:auto}.st-page-agent .st-output-body{flex:1;min-height:0;overflow:auto}.st-page-agent.st-mobile-output .st-output{display:flex}.st-page-agent.st-mobile-output .st-controls{display:none}.st-page-agent .st-tabs{display:none}.st-page-agent :deep(.sap),.st-page-agent :deep(.sap.sap-expanded){flex:1;min-height:0;height:100%;max-height:none}.st-page-agent :deep(.sap-scroll){min-height:90px}.st-mobile-tabs{display:flex;flex-shrink:0;gap:5px;overflow:auto;padding:8px 14px;border-bottom:1px solid var(--vm-line)}.st-mobile-tabs button{min-height:44px;padding:10px 13px;border:1px solid transparent;border-radius:7px;background:none;color:var(--vm-ink-soft);font:500 12px var(--vm-font-sans);white-space:nowrap}.st-mobile-tabs button[aria-selected=true]{border-color:var(--vm-line);background:var(--vm-surface-2);color:var(--vm-ink)}.st-page-agent.st-chat-expanded .st-output{display:none}.st-page-agent.st-chat-expanded.st-mobile-output .st-output{display:flex}}
@media(max-width:480px){.st-page-agent .st-form{padding:12px;gap:12px}.st-page-agent .st-page-head h1{font-size:21px}.st-page-agent :deep(.sap-input){max-height:130px}}
</style>

<style scoped>
@media(max-width:1023px){.st-page-agent :deep(.sap-scroll){min-height:0}.st-page-agent .st-form{overscroll-behavior:contain}}

</style>

<style scoped>
.st-page{padding:26px 30px 22px;gap:22px}.st-page-head{border:0;padding:0;min-height:75px;align-items:center}.st-page-head h1{font-size:27px;font-weight:550;letter-spacing:-.04em}.st-page-head p{font-size:12px;color:var(--vm-ink-soft);margin-top:9px}.st-page-body{gap:22px;grid-template-columns:minmax(300px,360px) minmax(0,1fr)}.st-controls,.st-output{border:1px solid var(--vm-line);border-radius:11px;overflow:hidden}.st-output{background:#182232}.st-tabs{background:var(--vm-surface-2);gap:21px;padding-inline:22px}.st-tabs button{min-height:52px;font-size:12px}.st-page-agent .st-form{padding:18px}.st-output-body{padding:22px}.st-chat-expanded .st-page-body{grid-template-columns:minmax(0,1fr)}
@media(max-width:1023px){.st-page{padding:18px 16px;gap:16px}.st-page-head{padding:0;min-height:55px}.st-page-head h1{font-size:24px}.st-page-agent .st-page-head{padding:0;min-height:48px}.st-page-agent{height:100%;padding-bottom:12px}.st-page-body{gap:15px}.st-mobile-tabs{padding:0 0 8px;gap:3px;border:0}.st-mobile-tabs button{padding:9px 10px}.st-page-agent .st-page-body{gap:0}.st-page-agent .st-form{padding:14px}.st-page-agent .st-output-body{padding:16px}.st-output{min-height:0}.st-page-agent .st-controls{border-top:1px solid var(--vm-line)}}
@media(max-width:480px){.st-page{padding:14px 12px 12px}.st-page-agent .st-form{padding:12px}.st-page-head h1{font-size:23px}.st-page-head p{font-size:11px}.st-mobile-tabs button{font-size:11px;padding-inline:9px}.st-page-head .st-button{font-size:11px}}
</style>

<style scoped>
.st-page{padding:27px 38px 22px;gap:26px}.st-page-head{min-height:84px}.st-title-block{display:flex;align-items:center;gap:14px;min-width:0}.st-title-icon{width:46px;height:46px;display:grid;place-items:center;flex:none;background:#2b354c;border:1px solid #414f70;border-radius:10px;color:#c7d6fb}.st-title-icon svg{width:22px;height:22px}.st-title-category{display:block;font-size:9px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#9ba6bc;margin-bottom:6px}.st-page-head h1{font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-.8px}.st-page-head p{font-size:12px;line-height:1.8;margin-top:10px}.st-page-body{grid-template-columns:366px minmax(0,1fr);gap:23px}.st-controls{background:#202329;border-color:#3a414f}.st-output{background:#141e2a;border-color:#3a414f}.st-tabs{background:#26334b;border-color:#435169}.st-output-body{padding:22px}.st-page-agent .st-form{padding:18px 20px}.st-page-agent :deep(.sm-switch){width:100%;background:#151d29;border-color:#3a4353;padding:3px}.st-page-agent :deep(.sm-switch button){flex:1;font-size:12px;min-height:36px}.st-page-agent :deep(.sm-switch button[aria-checked=true]){background:#354c70;border-color:#5a7096;color:#d9e5ff}.st-page-agent :deep(.sap-composer){background:#292d35;border-color:#414a59}.st-chat-expanded .st-page-body{grid-template-columns:1fr}
@media(max-width:1260px){.st-page-body{grid-template-columns:320px minmax(0,1fr)}.st-page{padding-inline:26px}}
@media(max-width:1023px){.st-page{padding:18px 16px;gap:16px}.st-title-icon{width:40px;height:40px}.st-page-head h1{font-size:24px}.st-title-category{font-size:8px}.st-page-head{min-height:60px}.st-page-agent .st-page-body{display:flex}.st-page-body{grid-template-columns:minmax(0,1fr)}.st-page-agent .st-form{padding:16px}.st-page-agent :deep(.sm-switch button){min-height:44px}.st-output-body{padding:16px}}
@media(max-width:480px){.st-page{padding:14px 12px 12px}.st-title-block{gap:10px}.st-title-icon{width:36px;height:36px}.st-title-icon svg{width:18px;height:18px}.st-page-head h1{font-size:21px}.st-page-head p{font-size:11px}.st-page-agent .st-form{padding:12px}}
</style>

<style scoped>
@media(max-width:1023px){
 .st-page-agent{flex:1 1 0;height:auto;min-height:0;gap:8px;padding:10px 12px max(8px,env(safe-area-inset-bottom))}
 .st-page-agent .st-page-head{min-height:44px;gap:8px}
 .st-page-agent .st-page-head h1{font-size:19px;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .st-page-agent .st-title-category{display:none}
 .st-page-agent .st-title-icon{width:30px;height:30px}
 .st-page-agent .st-title-block{gap:8px}
 .st-page-agent .st-page-head :deep(.spp-trigger){font-size:11px;padding:8px;flex:none}
 .st-mobile-tabs{gap:2px;padding:0;min-height:44px;scrollbar-width:none}
 .st-mobile-tabs button{font-size:12px;min-height:44px;padding:8px 10px;flex:1}
 .st-page-agent .st-controls{border:0;background:transparent;border-radius:0}
 .st-page-agent .st-form{display:flex;flex:1;min-height:0;gap:8px;padding:0;overflow:hidden}
 .st-page-agent .st-form>:deep(.sm-switch){width:auto;align-self:flex-start;padding:2px}
 .st-page-agent .st-form>:deep(.sm-switch button){min-height:44px;padding:7px 18px}
 .st-page-agent .st-form>:deep(.sps){gap:8px}
 .st-page-agent :deep(.st-tool-options){display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center}
 .st-page-agent :deep(.st-tool-options .sm-switch){width:100%;padding:2px}
 .st-page-agent :deep(.st-tool-options .sm-switch button){padding:7px 8px;font-size:12px;gap:5px}
 .st-page-agent :deep(.st-tool-options .sm-switch svg){width:13px;height:13px}
 .st-page-agent :deep(.st-tool-options .sps>span){display:none}
 .st-page-agent :deep(.sap),.st-page-agent :deep(.sap.sap-expanded){flex:1 1 0;height:auto;min-height:0;max-height:none;gap:6px}
 .st-page-agent :deep(.sap-head){min-height:44px}
 .st-page-agent :deep(.sap-scroll){flex:1 1 0;min-height:0}
 .st-page-agent :deep(.sap-composer){padding:0;background:transparent;border:0}
 .st-page-agent :deep(.sap-more){margin-bottom:4px}
 .st-page-agent :deep(.sap-more summary){min-height:44px;padding:12px 2px;font-size:12px}
 .st-page-agent :deep(.sap-more[open]){max-height:140px;overflow:auto}
 .st-page-agent :deep(.sap-input){min-height:62px;max-height:110px;padding:10px 12px 4px;font-size:16px}
 .st-page-agent :deep(.sap .vcp-chips){max-height:90px;overflow:auto}
 .st-page-agent :deep(.sap .vcp-box){background:#202e45;border-color:#506b94}
 .st-page-agent .st-output{min-height:0}
}
@media(max-width:1023px) and (max-height:700px){
 .st-page-agent{gap:4px;padding-block:4px}
 .st-page-agent .st-page-head{display:none}
 .st-page-agent .st-title-icon{display:none}
 .st-page-agent .st-form{gap:4px}
 .st-page-agent:has(.sap-input:focus) .st-page-head{display:none}
 .st-page-agent .st-form:has(.sap-input:focus)>:deep(.st-tool-options){display:none}
 .st-page-agent :deep(.sap-intro){font-size:12px;line-height:1.5}
 .st-page-agent :deep(.sap-more summary){min-height:36px;padding-block:8px}
}
</style>
