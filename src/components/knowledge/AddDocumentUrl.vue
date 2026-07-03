<script setup>
/**
 * Add a document from an approved URL or YouTube link (unified MarkItDown pipeline).
 * POSTs to /document_sources/url/ which SSRF-checks the URL, creates a DocumentSource, and queues the
 * isolated conversion worker. YouTube links enter here too (captions-first; audio fallback stays off
 * unless the agent enabled it). Blocked URLs (loopback/private/metadata) return a clear error.
 *
 * Drop-in for the agent Knowledge Base or a connector page. Uses useNotify — never native dialogs.
 */
import { ref, computed } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'
import IndexStatusBadge from './IndexStatusBadge.vue'

const props = defineProps({
  agentId: { type: [Number, String], default: null },
  conversationId: { type: [Number, String], default: null },
  scope: { type: String, default: 'agent_knowledge' },
})
const emit = defineEmits(['added'])

const url = ref('')
const busy = ref(false)
const sources = ref([])   // { id, source_name, source_type, status, error_code }

const isYoutube = computed(() => /(?:youtube\.com|youtu\.be)/i.test(url.value))
const canSubmit = computed(() => /^https?:\/\//i.test(url.value.trim()) && !busy.value)

async function submit() {
  const u = url.value.trim()
  if (!/^https?:\/\//i.test(u)) { notify.warning('Enter a full http(s) URL.'); return }
  busy.value = true
  try {
    const payload = { url: u, scope: props.scope }
    if (props.agentId != null) payload.agent_id = props.agentId
    if (props.conversationId != null) payload.conversation_id = props.conversationId
    const res = await api.addDocumentUrl(payload)
    const src = res.data || {}
    sources.value.unshift(src)
    url.value = ''
    notify.success(`${src.source_type === 'youtube' ? 'YouTube' : 'URL'} queued — converting & indexing.`)
    emit('added', src)
    if (src.id != null) poll(src.id)
  } catch (err) {
    const d = err.response?.data || {}
    // SSRF / bad URL → clear message (backend returns error_code URL_BLOCKED etc.)
    notify.error(d.error || 'Could not add that URL.')
  } finally {
    busy.value = false
  }
}

async function poll(id) {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    let d
    try { d = (await api.getDocumentSource(id)).data } catch { continue }
    const i2 = sources.value.findIndex((s) => s.id === id)
    if (i2 !== -1) sources.value[i2] = { ...sources.value[i2], ...d }
    if (d.status === 'ready') { notify.success(`Ready: ${d.source_name || 'document'}`); return }
    if (d.status === 'failed') {
      notify.error(`Failed: ${d.source_name || 'document'}${d.error_code ? ` (${d.error_code})` : ''}`)
      return
    }
  }
}
</script>

<template>
  <div class="adu">
    <label class="adu-lbl">Add a document from a URL or YouTube link</label>
    <div class="adu-row">
      <input v-model="url" type="url" placeholder="https://…  or  https://youtube.com/watch?v=…"
             class="adu-input" data-test="adu-input" @keyup.enter="canSubmit && submit()" />
      <button class="adu-btn" :disabled="!canSubmit" data-test="adu-submit" @click="submit">
        {{ busy ? 'Adding…' : (isYoutube ? 'Add YouTube' : 'Add URL') }}
      </button>
    </div>
    <p class="adu-hint">
      Captions are used for YouTube (audio fallback only if enabled). Internal/private addresses are blocked.
    </p>
    <ul v-if="sources.length" class="adu-list">
      <li v-for="s in sources" :key="s.id" class="adu-item" :data-test="`adu-src-${s.id}`">
        <span class="adu-name">{{ s.source_name || s.source_url }}</span>
        <IndexStatusBadge :status="s.status" :error="s.error_message || s.error_code" compact />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.adu { display: flex; flex-direction: column; gap: 6px; }
.adu-lbl { font-size: 12.5px; font-weight: 650; color: #344054; }
.adu-row { display: flex; gap: 8px; }
.adu-input { flex: 1; min-width: 0; height: 36px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0 10px; font-size: 12.5px; }
.adu-btn { border: 0; border-radius: 8px; padding: 0 14px; background: #4f46e5; color: #fff; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.adu-btn:disabled { opacity: .5; cursor: not-allowed; }
.adu-hint { font-size: 11px; color: #98a2b3; margin: 0; }
.adu-list { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.adu-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; }
.adu-name { color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
