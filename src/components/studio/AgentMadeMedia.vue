<template>
  <section v-if="items.length" class="amm" aria-labelledby="amm-title" data-test="agent-made-media">
    <h3 id="amm-title" class="amm-title">Made by the agent in this chat</h3>
    <ul class="amm-grid">
      <li v-for="item in items" :key="item.attachment_id" class="amm-card">
        <video v-if="item.media_type === 'video'" :src="item.url" :poster="item.thumbnail_url || undefined" controls preload="none" playsinline />
        <audio v-else-if="item.media_type === 'audio'" :src="item.url" controls preload="metadata" />
        <MediaThumb v-else :item="{ ...item, media_type: 'image' }" :src="item.url" :alt="item.title || 'A picture the agent made'" />
        <div class="amm-foot"><span class="amm-name">{{ item.title || 'Result' }}</span><a :href="item.url" :download="item.title || 'result'" class="st-button amm-dl" target="_blank" rel="noopener noreferrer">Download</a></div>
      </li>
    </ul>
  </section>
</template>
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'
import MediaThumb from '../common/MediaThumb.vue'
// What the agent made in this chat without a Studio job (a picture from GENERATE_IMAGE / EDIT_IMAGE), so My results
// shows it too (live 2026-10-28: the agent's relit photo was only in the chat; My results said "No results yet").
// A job's own result is left out: its card shows it already.
const props = defineProps({ conversationId: [String, Number], exclude: { type: Array, default: () => [] } })
const emit = defineEmits(['count'])
const chat = useChatStore()
const all = ref([]), items = ref([])
let seq = 0, gone = false
async function load() {
  const cid = props.conversationId, mine = ++seq
  if (!cid) { all.value = []; return }
  try {
    const { data } = await api.getConversationMedia(cid, { source: 'generated' })
    if (gone || mine !== seq) return
    all.value = (data.media || []).filter(m => m.attachment_id && m.url)
  } catch { /* the chat still shows them */ }
}
watch(() => [all.value, props.exclude.join(',')], () => {
  const skip = new Set(props.exclude)
  items.value = all.value.filter(m => !skip.has(m.attachment_id)).map(m => ({ ...m, media_type: m.media_type || m.type || 'image' }))
  emit('count', items.value.length)
}, { immediate: true })
watch(() => props.conversationId, load, { immediate: true })
watch(() => chat.isBusy, (busy, was) => { if (was && !busy) load() })          // a turn just ended
onBeforeUnmount(() => { gone = true })
</script>
<style scoped>
.amm{display:grid;gap:12px;margin-top:8px}
.amm-title{margin:0;font-size:13px;font-weight:600;color:var(--vm-ink)}
.amm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:0;padding:0;list-style:none}
.amm-card{display:grid;gap:8px;padding:10px;border:1px solid var(--vm-line);border-radius:8px;background:var(--vm-surface);min-width:0}
.amm-card video,.amm-card :deep(img){width:100%;max-height:240px;object-fit:contain;border-radius:6px;background:var(--vm-surface-2)}
.amm-card audio{width:100%}
.amm-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.amm-name{overflow:hidden;font-size:12px;color:var(--vm-ink-soft);text-overflow:ellipsis;white-space:nowrap}
.amm-dl{flex-shrink:0;min-height:36px;font-size:12px}
@media (max-width:767px){.amm-dl{min-height:44px}}
</style>
