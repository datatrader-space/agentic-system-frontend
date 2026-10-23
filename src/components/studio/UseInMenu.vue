<template>
  <div ref="root" class="uim" @keydown.esc.stop.prevent="close(true)">
    <button ref="trigger" type="button" class="st-button" aria-haspopup="menu" :aria-expanded="open" :aria-controls="open ? menuId : undefined" @click="open = !open" @keydown.down.prevent="show">Use in <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>
    <div v-if="open" :id="menuId" class="uim-menu" role="menu" aria-label="Use this result" @keydown="move">
      <template v-if="item.media_type === 'image'"><button type="button" role="menuitem" @click="useVideo">Video as opening shot</button><button type="button" role="menuitem" @click="saving = true; close()">Save as Element</button></template>
      <button v-if="item.media_type === 'video'" type="button" role="menuitem" @click="useEnhance">Enhance video</button>
      <button v-for="target in soonTargets" :key="target" type="button" role="menuitem" disabled>{{ target }} <span class="st-pill">Soon</span></button>
    </div>
    <form v-if="saving" class="uim-save" @submit.prevent="save"><label class="st-field">Element name<input v-model="name" class="st-input" maxlength="80" required /></label><label class="st-field">Kind<select v-model="kind" class="st-input"><option value="product">Product</option><option value="character">Character</option><option value="location">Location</option><option value="style">Style</option></select></label><div class="uim-actions"><button class="st-button" type="button" @click="saving = false">Cancel</button><button class="st-button primary" type="submit" :disabled="busy || !name.trim()">{{ busy ? 'Saving...' : 'Save Element' }}</button></div></form>
    <p v-if="error" class="st-error" role="alert">{{ error }}</p>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { useRouter } from 'vue-router'
import { useVideoStore } from '../../stores/useVideoStore'
const props = defineProps({ item: { type: Object, required: true }, conversationId: [String,Number] })
const router = useRouter(), video = useVideoStore()
const root = ref(null), trigger = ref(null), open = ref(false), saving = ref(false), name = ref(''), kind = ref('product'), busy = ref(false), error = ref('')
const menuId = `use-in-${useId()}`
const soonTargets = computed(() => props.item.media_type === 'image' ? ['Image edit','Talking avatar','Motion transfer'] : ['Extend','Upscale','Editor'])
function close(focus = false) { open.value = false; if (focus) trigger.value?.focus() }
async function show() { open.value = true; await nextTick(); root.value?.querySelector('[role="menuitem"]:not(:disabled)')?.focus() }
function move(event) {
  if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return
  event.preventDefault()
  const items = [...root.value.querySelectorAll('[role="menuitem"]:not(:disabled)')]
  const i = items.indexOf(document.activeElement), j = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : (i + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
  items[j]?.focus()
}
function query(handoff = false) { return { ...(props.conversationId ? { conversation: String(props.conversationId) } : {}), ...(handoff ? { useIn: '1', mode: video.studioMode } : {}) } }
function useVideo() {
  const existing = video.refs.find(ref => ref.role === 'first_frame' && ref.attachment_id !== props.item.attachment_id)
  if (existing) { error.value = 'Remove the current opening shot before using another one.'; close(); return }
  window.dispatchEvent(new Event('studio-save-draft'))
  video.refs = []
  video.addExistingRef(props.item, 'first_frame')
  const added = video.refs.find(r => r.attachment_id === props.item.attachment_id && r.role === 'first_frame'); if (added) added.studioSlot = 'opening'
  close()
  router.push({ path: '/video-studio/video', query: query(true) })
}
function useEnhance() { window.dispatchEvent(new Event('studio-save-draft')); video.refs = []; video.addExistingRef(props.item, 'edit_source'); close(); router.push({ path: '/video-studio/enhance', query: query(true) }) }
async function save() {
  if (busy.value || !name.value.trim()) return
  busy.value = true; error.value = ''
  try {
    const result = await video.createIngredient({ kind: kind.value, name: name.value.trim(), description: '', attachmentIds: [props.item.attachment_id] })
    if (!result) { error.value = 'Could not save this Element. Try again.'; return }
    saving.value = false
    router.push({ path: '/video-studio/elements', query: query() })
  } catch { error.value = 'Could not save this Element. Try again.' } finally { busy.value = false }
}
function outside(event) { if (!root.value?.contains(event.target)) close() }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
<style scoped>
.uim{position:relative;min-width:0}.uim-menu{position:absolute;z-index:10;top:calc(100% + 5px);left:0;width:min(240px,75vw);padding:5px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface);box-shadow:var(--vm-shadow-m)}.uim-menu button{display:flex;align-items:center;gap:8px;width:100%;min-height:38px;padding:7px 10px;border:0;border-radius:4px;background:none;color:var(--vm-ink);font:400 13px var(--vm-font-sans);text-align:left;cursor:pointer}.uim-menu button:hover:not(:disabled){background:var(--vm-surface-2)}.uim-menu button:disabled{color:var(--vm-ink-soft);cursor:not-allowed}.uim-menu .st-pill{margin-left:auto}.uim-save{display:grid;gap:10px;margin-top:10px;padding:12px;border:1px solid var(--vm-line);border-radius:6px;background:var(--vm-surface)}.uim-actions{display:flex;flex-wrap:wrap;gap:6px}.uim>p{margin-top:8px!important}@media(max-width:767px){.uim-menu button{min-height:44px}.uim-menu{width:230px}}
</style>
