<template>
  <Teleport to="body">
    <Transition name="mg-fade">
      <div v-if="open" class="mg-overlay" @click.self="close">
        <div class="mg-modal">
          <!-- Header -->
          <div class="mg-head">
            <div class="mg-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              Media
            </div>
            <button class="mg-x" aria-label="Close" @click="close">&times;</button>
          </div>

          <!-- Controls -->
          <div class="mg-controls">
            <div class="mg-seg">
              <button :class="{ on: scope === 'conversation' }" @click="setScope('conversation')">This chat</button>
              <button :class="{ on: scope === 'agent' }" @click="setScope('agent')">This agent</button>
            </div>
            <select v-model="sourceFilter" class="mg-sel" @change="load">
              <option value="">All sources</option>
              <option value="generated">Generated</option>
              <option value="uploaded">Uploaded</option>
            </select>
            <select v-model="typeFilter" class="mg-sel" @change="load">
              <option value="">All types</option>
              <option value="image">Images</option>
              <option value="video">Video</option>
            </select>
            <select v-model="sortOrder" class="mg-sel">
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
            </select>
            <span class="mg-count">{{ sortedMedia.length }} item{{ sortedMedia.length === 1 ? '' : 's' }}</span>
          </div>

          <!-- Grid -->
          <div class="mg-body">
            <div v-if="loading" class="mg-empty">Loading…</div>
            <div v-else-if="!sortedMedia.length" class="mg-empty">No media in this {{ scope === 'agent' ? 'agent' : 'chat' }} yet.</div>
            <div v-else class="mg-grid">
              <div v-for="m in sortedMedia" :key="m.attachment_id"
                   class="mg-cell" :class="{ sel: selected.has(m.attachment_id) }"
                   @click="toggle(m)">
                <div class="mg-thumb">
                  <img v-if="m.type === 'image' && m.url" :src="m.url" :alt="m.filename" loading="lazy" />
                  <video v-else-if="m.type === 'video' && m.url" :src="m.url" muted preload="metadata"></video>
                  <div v-else class="mg-noimg">{{ m.filename }}</div>
                  <span class="mg-check" :class="{ on: selected.has(m.attachment_id) }">
                    <svg v-if="selected.has(m.attachment_id)" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </span>
                  <button class="mg-dl" title="Download" @click.stop="download(m)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  </button>
                </div>
                <div class="mg-meta">
                  <span class="mg-src" :class="m.source">{{ m.source === 'generated' ? 'Generated' : 'Uploaded' }}</span>
                  <span class="mg-name" :title="m.filename">{{ m.filename }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="mg-foot">
            <span class="mg-selcount">{{ selected.size }} selected</span>
            <div class="mg-actions">
              <button class="mg-btn ghost" @click="close">Cancel</button>
              <button class="mg-btn primary" :disabled="!selected.size" @click="attachSelected">
                Attach selected{{ selected.size ? ` (${selected.size})` : '' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'

const props = defineProps({
  open: { type: Boolean, default: false },
  conversationId: { type: [String, Number], default: null },
})
const emit = defineEmits(['close', 'attach'])

const media = ref([])
const loading = ref(false)
const scope = ref('conversation')
const sourceFilter = ref('')
const typeFilter = ref('')
const sortOrder = ref('new')
const selected = ref(new Set())

const sortedMedia = computed(() => {
  const list = [...media.value]
  list.sort((a, b) => {
    const av = a.created_at || '', bv = b.created_at || ''
    return sortOrder.value === 'new' ? bv.localeCompare(av) : av.localeCompare(bv)
  })
  return list
})

async function load() {
  if (!props.conversationId) return
  loading.value = true
  try {
    const res = await api.getConversationMedia(props.conversationId, {
      scope: scope.value,
      source: sourceFilter.value || undefined,
      type: typeFilter.value || undefined,
    })
    media.value = Array.isArray(res?.data?.media) ? res.data.media : []
  } catch {
    media.value = []
    notify.error('Could not load media.')
  } finally {
    loading.value = false
  }
}

function setScope(s) { if (scope.value !== s) { scope.value = s; load() } }
function toggle(m) {
  const s = new Set(selected.value)
  s.has(m.attachment_id) ? s.delete(m.attachment_id) : s.add(m.attachment_id)
  selected.value = s
}

async function download(m) {
  if (!m.url) return
  try {
    const resp = await fetch(m.url)
    const blob = await resp.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = m.filename || 'media'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  } catch {
    window.open(m.url, '_blank', 'noopener')
  }
}

function attachSelected() {
  const chosen = sortedMedia.value.filter((m) => selected.value.has(m.attachment_id))
  if (!chosen.length) return
  emit('attach', chosen)
  close()
}

function close() {
  selected.value = new Set()
  emit('close')
}

// Load whenever the modal opens.
watch(() => props.open, (v) => { if (v) { selected.value = new Set(); load() } })
</script>

<style scoped>
.mg-overlay { position: fixed; inset: 0; z-index: 9998; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; padding: 24px; }
.mg-modal { width: min(920px, 96vw); max-height: 88vh; background: #fff; border-radius: 14px; box-shadow: 0 24px 70px rgba(0,0,0,0.35); display: flex; flex-direction: column; overflow: hidden; }
.mg-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #eef0f4; }
.mg-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: #111827; }
.mg-title svg { width: 18px; height: 18px; color: #6366f1; }
.mg-x { border: none; background: transparent; font-size: 24px; line-height: 1; color: #6b7280; cursor: pointer; }
.mg-controls { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-bottom: 1px solid #f1f2f6; flex-wrap: wrap; }
.mg-seg { display: inline-flex; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
.mg-seg button { border: none; background: #fff; padding: 6px 12px; font-size: 13px; cursor: pointer; color: #374151; }
.mg-seg button.on { background: #6366f1; color: #fff; }
.mg-sel { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 8px; font-size: 13px; background: #fff; color: #374151; }
.mg-count { margin-left: auto; font-size: 12px; color: #9ca3af; }
.mg-body { flex: 1; overflow-y: auto; padding: 16px 18px; }
.mg-empty { text-align: center; color: #9ca3af; padding: 48px 0; font-size: 14px; }
.mg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
.mg-cell { cursor: pointer; border-radius: 10px; }
.mg-thumb { position: relative; aspect-ratio: 1; background: #f3f4f6; border-radius: 10px; overflow: hidden; border: 2px solid transparent; }
.mg-cell.sel .mg-thumb { border-color: #6366f1; }
.mg-thumb img, .mg-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
.mg-noimg { display: flex; align-items: center; justify-content: center; height: 100%; font-size: 11px; color: #9ca3af; padding: 6px; text-align: center; }
.mg-check { position: absolute; top: 8px; left: 8px; width: 22px; height: 22px; border-radius: 6px; background: rgba(255,255,255,0.85); border: 1px solid #d1d5db; display: flex; align-items: center; justify-content: center; }
.mg-check.on { background: #6366f1; border-color: #6366f1; }
.mg-check svg { width: 14px; height: 14px; }
.mg-dl { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 6px; border: none; background: rgba(0,0,0,0.5); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity .12s; }
.mg-thumb:hover .mg-dl { opacity: 1; }
.mg-dl svg { width: 15px; height: 15px; }
.mg-meta { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.mg-src { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 10px; text-transform: uppercase; letter-spacing: .3px; }
.mg-src.generated { background: #ede9fe; color: #6d28d9; }
.mg-src.uploaded { background: #dbeafe; color: #1d4ed8; }
.mg-name { font-size: 11px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mg-foot { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-top: 1px solid #eef0f4; }
.mg-selcount { font-size: 13px; color: #6b7280; }
.mg-actions { display: flex; gap: 10px; }
.mg-btn { border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
.mg-btn.ghost { background: #fff; border-color: #e5e7eb; color: #374151; }
.mg-btn.primary { background: #6366f1; color: #fff; }
.mg-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
.mg-fade-enter-active, .mg-fade-leave-active { transition: opacity .16s ease; }
.mg-fade-enter-from, .mg-fade-leave-to { opacity: 0; }

@media (prefers-color-scheme: dark) {
  .mg-modal { background: #1f2430; color: #e5e7eb; }
  .mg-head, .mg-controls, .mg-foot { border-color: #333a48; }
  .mg-title { color: #f3f4f6; }
  .mg-seg { border-color: #3a4150; } .mg-seg button { background: #262c38; color: #cbd5e1; }
  .mg-sel { background: #262c38; border-color: #3a4150; color: #cbd5e1; }
  .mg-thumb, .mg-noimg { background: #262c38; }
  .mg-btn.ghost { background: #262c38; border-color: #3a4150; color: #cbd5e1; }
}
</style>
