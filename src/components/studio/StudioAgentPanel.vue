<template>
  <section :id="chatId" class="sap" :class="{ 'sap-expanded': expanded }" aria-label="Studio agent" @keydown.esc="collapse">
    <header class="sap-head"><h2>{{ label }} agent</h2><button type="button" class="sap-new" aria-label="New chat" title="New chat" :disabled="chat.isBusy || video.busy || !!chat.hitlRequests.length" @click="emit('new')">↻</button><button type="button" class="sap-expand" data-test="studio-agent-expand" :aria-label="expanded ? 'Collapse chat' : 'Expand chat'" :title="expanded ? 'Collapse chat (Esc)' : 'Expand chat'" :aria-expanded="expanded ? 'true' : 'false'" :aria-controls="chatId" @click="emit('update:expanded', !expanded)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="expanded ? 'M4 10h6V4m10 10h-6v6M10 10 3 3m11 11 7 7' : 'M8 3H3v5m13 13h5v-5M3 3l7 7m11 11-7-7'" /></svg></button></header>
    <div ref="scroll" class="sap-scroll" role="log" :aria-label="`${label} agent conversation`" aria-live="polite" aria-relevant="additions">
      <p v-if="!chat.messages.length" class="sap-intro">{{ intro }}</p>
      <div v-if="look && !chat.messages.length" class="sap-look"><div><strong>{{ look.title }}</strong><p>Your prepared direction is editable below. Add references with +.</p></div></div>
      <div v-if="chat.messages.length" class="sap-messages"><ChatMessageList :present-message="message => presentStudioMessage(message, chat.messages)" :prepare-edit="prepareStudioEdit" /></div>
      <VideoJobsTray :conversation-id="chat.conversationId" in-studio />
      <HITLModal v-if="chat.hitlRequests.length" inline :requests="chat.hitlRequests" show-stop @respond="respond" @dismiss="chat.dismissHitl" @skip="chat.skipHitl" @stop="chat.stop" />
      <p v-if="chat.error" class="st-error" role="alert">{{ chat.error }}</p>
    </div>
    <div class="sap-composer">
      <VideoComposerPanel variant="chat" :show-mode="false" :show-tasks="false" :draft="modelValue">
        <label class="sap-prompt"><span class="st-sr">Message the {{ label }} agent</span><textarea ref="input" class="sap-input" :value="modelValue" rows="2" maxlength="8000" placeholder="What do you want to make?" @input="$emit('update:modelValue', $event.target.value)" @keydown.enter="onEnter" /></label>
        <template #actions><button type="button" class="sap-cheaper" data-test="studio-lower-cost" :aria-pressed="lowerCost ? 'true' : 'false'" title="Prefer a lower-cost draft: the agent keeps your direction and shows the model, its tradeoffs and the price before anything is made." :disabled="sending || chat.isBusy" @click="lowerCost = !lowerCost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" /></svg><span>Lower cost</span></button><button v-if="chat.isBusy" type="button" class="st-button sap-stop" @click="chat.stop()"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" /></svg>Stop</button><button v-else type="button" class="st-button sap-send" data-test="studio-agent-send" :disabled="!ready || sending || (!modelValue.trim() && !video.refs.length)" @click="send"><span>Send</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button></template>
      </VideoComposerPanel>
    </div>
    <VideoLibrary v-if="video.libraryOpen" />
  </section>
</template>
<script setup>
import { ref, watch, nextTick, useId } from 'vue'
import { presentStudioMessage, prepareStudioEdit } from '../../services/studioMessagePresentation'
import { useChatStore } from '../../stores/useChatStore'
import { useVideoStore } from '../../stores/useVideoStore'
import ChatMessageList from '../chat/ChatMessageList.vue'
import VideoComposerPanel from '../video/VideoComposerPanel.vue'
import VideoJobsTray from '../video/VideoJobsTray.vue'
import VideoLibrary from '../video/VideoLibrary.vue'
import HITLModal from '../HITLModal.vue'
const props = defineProps({ modelValue: { type: String, default: '' }, look: Object, label: String, purpose: String, ready: Boolean, expanded: Boolean, intro: { type: String, default: 'Describe your idea or choose a preset. Use + to attach references.' } })
const emit = defineEmits(['new','update:modelValue','update:expanded','approved','sent'])
const chat = useChatStore(), video = useVideoStore(), sending = ref(false), input = ref(null), lowerCost = ref(false)
// One line to start on a phone, so the conversation keeps the screen (ADM-1170: it opened at 76px).
const minInput = () => (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches ? 48 : 76)
watch(() => props.modelValue, async () => {
  await nextTick()
  if (input.value) { input.value.style.height = 'auto'; input.value.style.height = `${Math.min(180, Math.max(minInput(), input.value.scrollHeight))}px` }
}, { immediate: true })
const scroll = ref(null)
watch(() => [chat.messages.length, chat.messages.at(-1)?.content, chat.hitlRequests.length, chat.isBusy], async () => { await nextTick(); if (scroll.value) scroll.value.scrollTop = scroll.value.scrollHeight })
const chatId = `studio-agent-${useId()}`
function collapse(event) {
  if (props.expanded && !event.defaultPrevented && !event.target?.closest?.('[role="menu"],[role="dialog"]')) {
    event.preventDefault(); emit('update:expanded', false)
  }
}
async function send() {
  if (!props.ready || sending.value || chat.isBusy || (!props.modelValue.trim() && !video.refs.length)) return
  sending.value = true
  // The page and preset travel as the message's studio_context field (set by the page), never as text; the
  // lower-cost preference is its typed lower_cost field, on every message sent while it is on.
  const pageContext = chat.studioContext, cheaper = lowerCost.value
  if (cheaper) chat.studioContext = { ...(pageContext || {}), lower_cost: true }
  try { if (await video.sendAgentMessage({ prompt: props.modelValue, chat })) { emit('update:modelValue', ''); emit('sent') } }
  finally { if (cheaper && chat.studioContext?.lower_cost) chat.studioContext = pageContext; sending.value = false }
}
function respond(event) { chat.respondHitl(event); if (event.response_value === true || event.response_value?.approved === true) emit('approved') }
function onEnter(event) {
  // A phone keyboard's Return inserts a line; Send stays the explicit submission action.
  const touchKeyboard = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (!event.shiftKey && !event.isComposing && (!touchKeyboard || event.ctrlKey || event.metaKey)) { event.preventDefault(); send() }
}
defineExpose({ focus() { input.value?.focus() } })
</script>
<style scoped>.sap-look{display:flex;gap:10px;padding:11px;border:1px solid var(--vm-line);border-radius:8px;flex-shrink:0;background:var(--vm-bg)}.sap-look strong{font-size:12px;font-weight:500}.sap-look p{font-size:11px;line-height:1.7;color:var(--vm-ink-soft);margin-top:6px}.sap{display:flex;flex-direction:column;flex:1;gap:14px;min-width:0;min-height:300px}.sap-scroll{display:flex;flex-direction:column;flex:1;gap:14px;min-height:0;overflow:auto;overscroll-behavior:contain}.sap-composer{flex-shrink:0;margin-top:auto}.sap-intro{flex-shrink:0;display:grid;gap:7px;font-size:13px;line-height:1.6;color:var(--vm-ink-soft)}.sap-messages{flex:1;min-height:140px;overflow:hidden;overflow-wrap:anywhere}.sap-prompt{display:block;min-width:0}.sap-input{display:block;width:100%;min-width:0;min-height:76px;max-height:180px;overflow-y:auto;padding:14px 14px 8px;border:0;border-radius:10px 10px 0 0;resize:none;background:transparent;color:var(--vm-ink);font:400 14px/1.6 var(--vm-font-sans)}.sap-input::placeholder{color:var(--vm-ink-soft)}.sap .sap-input:focus,.sap .sap-input:focus-visible{outline:none;box-shadow:none}.sap-send{min-height:36px;padding:7px 12px;border-color:transparent;border-radius:7px;background:var(--vm-violet-d);color:#fff}.sap-send:hover:not(:disabled){background:var(--vm-violet)}.sap-send:disabled{opacity:1;border-color:transparent;background:var(--vm-surface);color:var(--vm-ink-faint);cursor:not-allowed}.sap-stop{min-height:36px;padding:7px 12px;border-radius:7px}.sap-stop svg{width:12px;height:12px}.sap-send svg{width:16px;height:16px}@media(max-width:1023px){.sap{flex:none;height:clamp(300px,50dvh,520px)}}@media(max-width:767px){.sap-input{font-size:16px}.sap-send,.sap-stop{min-height:44px}}.sap :deep(.hitl-overlay--inline){position:static;display:block;padding:0;background:transparent}.sap :deep(.hitl-modal){width:100%;min-width:0;max-height:none}.sap :deep(.modal-body){max-height:400px}
/* Adapt the shared transcript to this narrow Studio panel only. */
.sap :deep(.msg-list-inner){padding:4px 0 12px}
.sap :deep(.msg){max-width:none;margin:0 0 16px;padding:0;gap:8px}
.sap :deep(.avatar){width:22px;height:22px}
.sap :deep(.user-col){max-width:92%}
.sap :deep(.bubble.user){padding:9px 12px;border-radius:12px 12px 4px 12px;background:var(--vm-violet-d);box-shadow:none;font-size:13px;line-height:1.6}
.sap :deep(.bubble.assistant){margin-top:6px;font-size:14px;line-height:1.65;color:var(--vm-ink)}
.sap :deep(.agent-timeline){margin:0;color:var(--vm-ink-soft)}
.sap :deep(.at-card){background:var(--vm-surface-2);border:1px solid var(--vm-line);border-radius:9px}
.sap :deep(.at-card.at-warn){border-color:var(--vs-warn-line)}
.sap :deep(.at-head),.sap :deep(.agent-step-label),.sap :deep(.at-reason-phrase),.sap :deep(.agent-status-line){color:var(--vm-ink)}
.sap :deep(.at-head:hover){background:var(--vm-surface)}
.sap :deep(.at-head-live),.sap :deep(.at-steps-toggle),.sap :deep(.at-reason-toggle),.sap :deep(.at-steer-by),.sap :deep(.at-steer-icon){color:var(--vs-accent-ink)}
.sap :deep(.at-head-live .at-dot){background:var(--vs-accent-ink)}
.sap :deep(.agent-step-dur),.sap :deep(.agent-step-count),.sap :deep(.at-head-tok),.sap :deep(.at-reason-text),.sap :deep(.agent-step-detail),.sap :deep(.agent-summary){color:var(--vm-ink-soft)}
.sap :deep(.agent-step-icon.icon-ok),.sap :deep(.at-check){color:var(--vs-ok-ink)}
.sap :deep(.agent-step-icon.icon-failed),.sap :deep(.agent-step-error){color:var(--vs-bad-ink)}
.sap :deep(.agent-step-icon.icon-interrupted),.sap :deep(.agent-step-warn),.sap :deep(.at-pause),.sap :deep(.at-check.warn){color:var(--vs-warn-ink)}
.sap :deep(.agent-spinner){border-color:var(--vm-line);border-top-color:var(--vs-accent-ink)}
.sap :deep(.agent-step-head){align-items:flex-start;gap:6px}.sap :deep(.agent-step-label){overflow-wrap:anywhere}
.sap :deep(.at-rows-done){border-color:var(--vm-line)}

.sap-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0}.sap-head h2{margin:0;font-size:13px;font-weight:600;color:var(--vm-ink)}.sap-expand{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--vm-ink-soft);cursor:pointer}.sap-expand svg{width:17px;height:17px}.sap-expand:hover{background:var(--vm-surface-2);color:var(--vm-ink)}.sap-expand[aria-expanded=true]{border-color:var(--vm-line);background:var(--vm-surface-2);color:var(--vs-accent-ink)}.sap-expand:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:2px}
@media(max-width:1023px){.sap.sap-expanded{height:max(300px,50dvh,calc(100dvh - 400px))}.sap-expand{width:44px;height:44px}}
</style>

<style scoped>/* The lower-cost preference, beside Send: it was the only thing inside "More controls" (ADM-1170). */
.sap-cheaper{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:6px 10px;border:1px solid var(--vm-line);border-radius:8px;background:transparent;color:var(--vm-ink-soft);font:500 12px var(--vm-font-sans);cursor:pointer;transition:background-color .15s,color .15s,border-color .15s}.sap-cheaper svg{width:15px;height:15px}.sap-cheaper:hover{background:var(--vm-surface-2);color:var(--vm-ink)}.sap-cheaper[aria-pressed=true]{border-color:var(--vs-accent-ink);background:var(--vm-surface-2);color:var(--vs-accent-ink)}.sap-cheaper:focus-visible{outline:2px solid var(--vs-accent-ink);outline-offset:2px}.sap-cheaper:disabled{opacity:.5;cursor:not-allowed}@media(max-width:1023px){.sap-cheaper{min-height:44px;min-width:44px}}@media(max-width:400px){.sap-cheaper span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.sap-cheaper{padding:6px 12px}}</style>

<style scoped>.sap-new{margin-left:auto;flex:none;min-width:32px;min-height:32px;padding:5px;border:0;background:none;color:var(--vm-ink-soft);font-size:18px;cursor:pointer}.sap-new+.sap-expand{margin-left:0}@media(max-width:1023px){.sap-new{min-width:44px;min-height:44px}}</style>
