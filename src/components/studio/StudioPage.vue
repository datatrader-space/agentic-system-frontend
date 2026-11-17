<template>
  <section class="st-page" :class="{ 'st-chat-expanded': chatExpanded, 'st-page-agent': agentMode, 'st-mobile-output': mobilePane === 'output' }" :aria-labelledby="titleId">
    <!-- No title band (owner, 2026-11-11: it took the room the work needs). The bar's breadcrumb names the page; the
         name and purpose stay here for screen readers, and the page's actions ("Add to project", "New") go to the
         bar beside Chats and Jobs. Outside the Studio shell (no bar) they stay at the top of the page. -->
    <h1 :id="titleId" class="st-sr">{{ title }}</h1><p v-if="purpose" class="st-sr">{{ purpose }}</p>
    <Teleport defer to="#swb-page-actions" :disabled="!inBar"><div class="st-page-actions" :class="{ 'st-page-actions--here': !inBar }" data-test="studio-page-actions"><slot name="header"><StudioProjectPicker v-if="agentMode" /><button v-else-if="presetPicker" type="button" class="st-button" :disabled="newDisabled" @click="emit('new')">{{ agentMode ? 'New chat' : 'New' }}</button></slot></div></Teleport>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useSlots } from 'vue'
import './studio.css'
import StudioProjectPicker from './StudioProjectPicker.vue'
// workLabel: what the first output tab holds (presets on Image and Video, a preview or a workspace elsewhere).
const props = defineProps({ feature: Object, chatExpanded: Boolean, agentMode: Boolean, title: String, purpose: String, activeTab: { type: String, default: 'presets' }, presetPicker: Boolean, newDisabled: Boolean, workLabel: { type: String, default: 'Presets' } })
const emit = defineEmits(['update:activeTab','new'])
const titleId = `studio-${useId()}`
// The Studio shell's bar has a place for the page's actions; without the shell (a test, an embed) they stay here.
const inBar = ref(false)
onMounted(() => { inBar.value = !!document.getElementById('swb-page-actions') })
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
/* One rule per element and state, one breakpoint scale (480 / 767 / 1023 px), colours from the --vm-* tokens
   (ADM-1170, VIDEO_STUDIO_PRODUCTION_READY_PLAN.md section 3 item 6). Wider than 1023 px the controls column and the
   side padding narrow smoothly instead of at a fourth breakpoint. */
.st-page{display:flex;flex-direction:column;gap:26px;height:100%;min-height:0;padding:27px clamp(26px,3vw,38px) 22px;background:var(--vm-bg)}
.st-page-body{display:grid;grid-template-columns:clamp(320px,29vw,366px) minmax(0,1fr);gap:23px;flex:1;min-height:0}
.st-controls,.st-output{display:flex;flex-direction:column;min-width:0;min-height:0;border:1px solid var(--vm-line);border-radius:11px;overflow:hidden}
.st-controls{background:var(--vm-surface)}
.st-output{background:var(--vm-bg)}
.st-form{display:flex;flex-direction:column;gap:20px;flex:1;min-height:0;overflow-y:auto;padding:24px;outline:0}
.st-quote{flex-shrink:0;border-top:1px solid var(--vm-line);background:var(--vm-surface)}
.st-tabs{display:flex;flex-shrink:0;gap:21px;padding:0 22px;border-bottom:1px solid var(--vm-line);background:var(--vm-surface-2)}
.st-tabs button{min-height:52px;border:0;border-bottom:2px solid transparent;background:none;color:var(--vm-ink-soft);font:500 12px var(--vm-font-sans);cursor:pointer}
.st-tabs button.active{border-bottom-color:var(--vm-violet);color:var(--vm-ink)}
.st-output-body{flex:1;min-height:0;overflow:auto;padding:22px}
.st-reference-panel{flex-shrink:0;min-width:0;max-height:min(45vh,420px);overflow:auto;padding:20px 24px;border-bottom:1px solid var(--vm-line-2);background:var(--vm-surface)}
.st-results-heading{padding:16px 24px;border-bottom:1px solid var(--vm-line-2)}
.st-mobile-tabs{display:none}
.st-chat-expanded .st-page-body{grid-template-columns:1fr}
.st-chat-expanded .st-output{display:none}
.st-chat-expanded .st-controls{border-right:0}
.st-chat-expanded .st-form{width:100%;max-width:1000px;margin-inline:auto}
.st-page-agent .st-form{gap:14px;padding:18px 20px;overflow:hidden}
.st-page-agent :deep(.sap){min-height:0;height:100%;gap:14px}
.st-page-agent :deep(.sap-scroll){min-height:120px}
.st-page-agent :deep(.sap-intro){font-size:13px;line-height:1.8}
.st-page-agent :deep(.sap-composer){padding-bottom:2px;background:var(--vm-surface-2);border-color:var(--vm-line)}
.st-page-agent :deep(.sm-switch){width:100%;padding:3px;background:var(--vm-bg);border-color:var(--vm-line)}
.st-page-agent :deep(.sm-switch button){flex:1;min-height:36px;font-size:12px}
.st-page-agent :deep(.sm-switch button[aria-checked=true]){background:var(--vm-primary-hover-soft);border-color:var(--vm-primary-line);color:var(--vm-ink)}
/* The page's actions in the Studio bar (or at the top of the page outside the shell), sized like the bar's buttons. */
.st-page-actions{display:flex;align-items:center;gap:8px}
.st-page-actions--here{justify-content:flex-end}
.st-page-actions :deep(.st-button){min-height:36px;padding:8px 11px;font-size:11px}

@media(max-width:1023px){
 /* The page scrolls as one column: the controls, then the output; the Manual bar is fixed at the bottom. */
 .st-page{flex:none;gap:16px;height:auto;min-height:100%;padding:18px 16px}
 .st-page:not(.st-page-agent){padding-bottom:calc(140px + env(safe-area-inset-bottom))}
 .st-page-body{display:flex;flex:none;flex-direction:column;min-height:auto;grid-template-columns:minmax(0,1fr)}
 .st-controls{order:0;flex:none;min-height:auto}
 .st-output{order:1;flex:none;min-height:0}
 .st-form{flex:none;min-height:auto;padding:20px 16px;overflow:visible}
 .st-output-body{flex:none;min-height:auto;padding:16px;overflow:visible}
 .st-reference-panel{max-height:none;overflow:visible;padding:20px 16px}
 .st-quote{position:fixed;bottom:0;left:0;right:0;z-index:40;padding:0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
 .st-page-actions :deep(.st-button){min-height:44px;min-width:44px;padding:7px}
 .st-page-actions :deep(.spp-label){display:none}

 /* Phone layout of an agent page (ADM-1170, phone QA 2026-11-04: the chrome above the first message took about 45%
    of the screen). The top bar already names the page, so there is no title row: the section tabs fill the first row
    and the agent's New chat / Expand buttons sit at the end of the Agent | Manual row. */
 .st-page-agent{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto minmax(0,1fr);flex:1 1 0;gap:8px;height:auto;min-height:0;padding:10px 12px max(8px,env(safe-area-inset-bottom))}
 .st-page-agent>.st-mobile-tabs{grid-column:1;grid-row:1;min-width:0}
 .st-page-agent>.st-page-body{grid-column:1/-1;grid-row:2}
 .st-page-agent .st-page-body{display:flex;flex:1;gap:0;min-height:0;overflow:hidden}
 .st-page-agent .st-controls{flex:1;min-height:0;overflow:hidden;border:0;border-radius:0;background:transparent}
 .st-page-agent .st-form{display:flex;flex:1;gap:8px;min-height:0;padding:0;overflow:hidden;overscroll-behavior:contain}
 .st-page-agent .st-form:has(.st-tool-options){position:relative}
 .st-page-agent .st-output{display:none;flex:1;min-height:0;overflow:auto}
 .st-page-agent .st-output-body{flex:1;min-height:0;padding:16px;overflow:auto}
 .st-page-agent .st-tabs{display:none}
 .st-page-agent.st-mobile-output .st-output{display:flex}
 .st-page-agent.st-mobile-output .st-controls{display:none}
 .st-page-agent.st-chat-expanded .st-output{display:none}
 .st-page-agent.st-chat-expanded.st-mobile-output .st-output{display:flex}
 .st-page-agent.st-chat-expanded .st-mobile-tabs{display:none}
 .st-mobile-tabs{display:flex;flex-shrink:0;gap:2px;min-height:44px;padding:0;border:0;overflow:auto;scrollbar-width:none}
 .st-mobile-tabs button{flex:1;min-height:44px;padding:8px 10px;border:1px solid transparent;border-radius:7px;background:none;color:var(--vm-ink-soft);font:500 12px var(--vm-font-sans);white-space:nowrap}
 .st-mobile-tabs button[aria-selected=true]{border-color:var(--vm-line);background:var(--vm-surface-2);color:var(--vm-ink)}
 .st-page-agent .st-form>:deep(.sm-switch){width:auto;align-self:flex-start;padding:2px}
 .st-page-agent .st-form>:deep(.sm-switch button){min-height:44px;padding:7px 18px}
 .st-page-agent .st-form>:deep(.sps){gap:8px}
 .st-page-agent :deep(.sm-switch button){min-height:44px}
 .st-page-agent :deep(.st-tool-setup){gap:8px}
 .st-page-agent :deep(.st-tool-options){display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center}
 .st-page-agent .st-form:has(.st-tool-options) :deep(.st-tool-options){padding-right:96px}
 .st-page-agent :deep(.st-tool-options .sm-switch){width:100%;padding:2px}
 .st-page-agent :deep(.st-tool-options .sm-switch button){padding:7px 8px;font-size:12px;gap:5px}
 .st-page-agent :deep(.st-tool-options .sm-switch svg){width:13px;height:13px}
 .st-page-agent :deep(.st-tool-options .sps>span){display:none}
 .st-page-agent.st-chat-expanded :deep(.st-tool-setup:not(:has([role="alert"]))){display:none}
 .st-page-agent.st-chat-expanded :deep(.st-tool-options),.st-page-agent.st-chat-expanded :deep(.sc-blocked){display:none}
 .st-page-agent :deep(.sap),.st-page-agent :deep(.sap.sap-expanded){flex:1 1 0;gap:6px;height:auto;min-height:0;max-height:none}
 .st-page-agent :deep(.sap-head){min-height:44px}
 .st-page-agent .st-form:has(.st-tool-options) :deep(.sap-head){position:absolute;top:0;right:0;z-index:2;gap:4px}
 .st-page-agent .st-form :deep(.sap-head h2){position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
 .st-page-agent.st-chat-expanded .st-form :deep(.sap-head){position:static;justify-content:flex-end}
 .st-page-agent :deep(.sap-scroll){flex:1 1 0;min-height:0}
 /* Long prompts and attached references yield space to the Send row on a short phone screen. */
 .st-page-agent :deep(.sap-composer){display:flex;flex-direction:column;flex:0 1 auto;min-height:0;max-height:75%;padding:0;border:0;background:transparent}
 .st-page-agent :deep(.sap .vcp-chat){display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
 .st-page-agent :deep(.sap .vcp-box){display:flex;flex-direction:column;flex:1 1 auto;min-height:0;background:var(--vm-surface-2);border-color:var(--vm-primary-line)}
 .st-page-agent :deep(.sap-prompt){flex:1 1 auto;min-height:48px;overflow:auto}
 .st-page-agent :deep(.sap-input){min-height:62px;max-height:110px;padding:10px 12px 4px;font-size:16px}
 .st-page-agent :deep(.sap .vcp-chips){flex:0 1 auto;min-height:0;max-height:90px;overflow:auto}
 .st-page-agent :deep(.sap .vcp-bar){flex:none}
 .st-page-agent :deep(.sap-send),.st-page-agent :deep(.sap-stop){min-height:44px}
 .st-page-agent :deep(.sap .vcp-plus){min-width:44px;width:44px;min-height:44px;height:44px}

 /* A short screen (a phone with its keyboard open): the options give way while the person types. */
 @media(max-height:700px){
  .st-page-agent{gap:4px;padding-block:4px}
  .st-page-agent .st-form{gap:4px}
  .st-page-agent .st-form:has(.sap-input:focus) :deep(.st-tool-options){display:none}
  .st-page-agent :deep(.sap-intro){font-size:12px;line-height:1.5}
 }
 /* A landscape phone has room beside the conversation, not above it. */
 @media(min-width:481px) and (max-height:500px){
  .st-page-agent .st-form{display:grid;grid-template-columns:190px minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:8px;align-items:stretch}
  .st-page-agent .st-form>:deep(.st-tool-setup){grid-column:1;grid-row:1;min-height:0;height:100%;max-height:100%;overflow:auto}
  .st-page-agent :deep(.st-tool-options){display:flex;flex-direction:column;align-items:stretch}
  .st-page-agent .st-form>:deep(.sap){grid-column:2;grid-row:1;align-self:stretch;height:100%;overflow:hidden}
  .st-page-agent.st-chat-expanded .st-form{display:flex}
 }
 /* After the landscape layout: an expanded chat keeps only a sliver for the tool's setup. */
 .st-page-agent.st-chat-expanded :deep(.st-tool-setup){height:auto;max-height:20%;overflow:auto}
}
@media(max-width:480px){
 .st-page:not(.st-page-agent){padding-top:14px;padding-inline:12px}
 @media(max-height:480px){
  .st-page-agent:has(.sap-input:focus) :deep(.sap-head),.st-page-agent .st-form:has(.sap-input:focus) :deep(.sc-blocked){display:none}
 }
}
</style>
