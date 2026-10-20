<template>
  <!-- The AADML Asset Library (agentic-docs/ASSET_LIBRARY_ORIGINS_PLAN.md in the backend): the files of the
       person's AADML chats only: what they uploaded there and what their agents made. One Library is shared by
       every origin and never mixed: Video Studio and Training Data each list their own (GET /api/library/?origin=). -->
  <div class="assets-page" data-test="asset-library">
    <header class="page-head">
      <div>
        <h1>Asset Library</h1>
        <p>Photos, videos, sounds and documents from your chats: what you uploaded and what your agents made.</p>
      </div>
    </header>

    <div class="toolbar">
      <div class="type-tabs" role="tablist" aria-label="What to show">
        <button v-for="t in TYPES" :key="t.value" type="button" role="tab" :aria-selected="type === t.value"
                :class="{ active: type === t.value }" @click="type = t.value">{{ t.label }}</button>
      </div>
      <label class="mini-select">
        <select v-model="source" aria-label="Uploaded or made by an agent">
          <option value="all">Uploaded and made by agents</option>
          <option value="uploaded">Uploaded</option>
          <option value="generated">Made by agents</option>
        </select>
        <Icon icon="lucide:chevron-down" />
      </label>
      <label class="search">
        <Icon icon="lucide:search" />
        <input v-model="q" type="search" placeholder="Search by name…" aria-label="Search your Asset Library" />
      </label>
    </div>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="items === null" class="muted">Loading your Asset Library…</p>
    <section v-else-if="!items.length" class="empty">
      <Icon icon="lucide:images" class="empty-icon" />
      <h2>{{ q ? 'Nothing matches that name' : 'Nothing here yet' }}</h2>
      <p>Files you upload in a chat, and images and files your agents make, appear here.</p>
      <router-link class="btn" to="/dashboard/chat/new"><Icon icon="lucide:message-square-plus" /> Start a chat</router-link>
    </section>
    <template v-else>
      <ul class="grid">
        <li v-for="it in items" :key="it.attachment_id" class="card">
          <a class="thumb" :href="path(it.url)" target="_blank" rel="noopener" :aria-label="`Open ${it.title}`">
            <img v-if="it.media_type === 'image' && path(it.url)" :src="path(it.url)" :alt="it.title" loading="lazy" decoding="async" />
            <video v-else-if="it.media_type === 'video' && path(it.url)" :src="path(it.url)" preload="metadata" muted playsinline aria-hidden="true" />
            <span v-else class="thumb-icon"><Icon :icon="ICONS[it.media_type] || 'lucide:file'" /></span>
            <span v-if="it.media_type === 'video'" class="kind"><Icon icon="lucide:film" /> Video</span>
          </a>
          <div class="body">
            <strong :title="it.title">{{ it.title }}</strong>
            <small>{{ meta(it) }}</small>
            <span v-if="it.source === 'generated'" class="badge">Made by an agent</span>
          </div>
          <div class="actions">
            <router-link v-if="it.conversation_id" :to="`/dashboard/chat/${it.conversation_id}`" class="link">
              <Icon icon="lucide:message-square" /> Open its chat
            </router-link>
            <a v-if="download(it.url)" :href="download(it.url)" class="link icon-only" :aria-label="`Download ${it.title}`" title="Download">
              <Icon icon="lucide:download" />
            </a>
          </div>
        </li>
      </ul>
      <div class="more">
        <button v-if="more" type="button" class="btn" :disabled="busy" @click="load(true)">{{ busy ? 'Loading…' : 'Show more' }}</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '../services/api'

const TYPES = [
  { value: 'all', label: 'Everything' }, { value: 'image', label: 'Images' }, { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Sounds' }, { value: 'document', label: 'Documents' },
]
const ICONS = { video: 'lucide:film', audio: 'lucide:music', document: 'lucide:file-text' }
const PAGE = 40

const type = ref('all')
const source = ref('all')
const q = ref('')
const items = ref(null)
const page = ref(1)
const more = ref(false)
const busy = ref(false)
const error = ref('')

async function load(next = false) {
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.get('/library/', { params: {
      origin: 'aadml', type: type.value, source: source.value, q: q.value.trim(), page: next ? page.value + 1 : 1, limit: PAGE,
    } })
    items.value = next ? [...items.value, ...data.items] : data.items
    page.value = data.page
    more.value = data.has_more
  } catch (e) {
    error.value = e?.response?.data?.error?.message || 'Your Asset Library could not be loaded. Try again.'
    if (items.value === null) items.value = []
  } finally {
    busy.value = false
  }
}

let timer = null
watch([type, source], () => load())
watch(q, () => { clearTimeout(timer); timer = setTimeout(() => load(), 300) })
onMounted(() => load())

// A Library file's address on this site: the Library answers absolute addresses; the path alone is asked from
// this page's origin so the sign-in cookie goes with it.
function path(url) {
  if (!url) return ''
  try {
    const p = new URL(url, window.location.origin)
    return /^\/media(-dl)?\//.test(p.pathname) ? `${p.pathname}${p.search}` : ''
  } catch { return '' }
}
function download(url) {
  const p = path(url)
  return p.startsWith('/media/') ? `/media-dl/${p.slice('/media/'.length)}` : ''
}
function size(bytes) {
  if (!bytes) return ''
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function meta(it) {
  const day = it.created_at ? new Date(it.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
  return [it.ext ? it.ext.toUpperCase() : it.media_type, size(it.size_bytes), day].filter(Boolean).join(', ')
}
</script>

<style scoped>
.assets-page { padding: 24px; max-width: 1180px; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
.page-head h1 { margin: 0 0 4px; color: #13223a; font-size: 20px; font-weight: 850; }
.page-head p { margin: 0; max-width: 640px; color: #64748b; font-size: 12.5px; line-height: 1.5; }

.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.type-tabs { display: flex; gap: 4px; flex: 1; min-width: 260px; overflow-x: auto; }
.type-tabs button {
  padding: 7px 12px; border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: pointer;
  color: #5b6b82; font-size: 12.5px; font-weight: 700; white-space: nowrap; transition: background .15s, color .15s;
}
.type-tabs button:hover { background: #eef2f8; color: #273a5a; }
.type-tabs button.active { background: #f6f9ff; border-color: #2563eb; color: #2563eb; }
.mini-select { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid #e6edf7; border-radius: 8px; background: #fff; }
.mini-select select { border: 0; background: transparent; font-size: 12px; font-weight: 700; color: #273a5a; cursor: pointer; appearance: none; }
.search { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px; border: 1px solid #e6edf7; border-radius: 8px; background: #fff; color: #64748b; min-width: 220px; }
.search input { border: 0; outline: 0; background: transparent; font-size: 12.5px; color: #13223a; width: 100%; }
.search:focus-within, .mini-select:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px #dbe7ff; }

.muted { color: #64748b; font-size: 12.5px; }
.error { color: #b42318; font-size: 12.5px; }

.empty { text-align: center; padding: 56px 24px; border: 1px dashed #d5deea; border-radius: 12px; background: #fff; }
.empty-icon { font-size: 36px; color: #2563eb; }
.empty h2 { margin: 10px 0 6px; font-size: 16px; color: #13223a; }
.empty p { margin: 0 auto 16px; max-width: 420px; color: #64748b; font-size: 12.5px; line-height: 1.5; }

.grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
.card { display: flex; flex-direction: column; border: 1px solid #e6edf7; border-radius: 10px; background: #fff; overflow: hidden; transition: border-color .15s; }
.card:hover { border-color: #b9cdf3; }
.thumb { position: relative; display: block; aspect-ratio: 4 / 3; background: #f1f4f9; cursor: pointer; }
.thumb:focus-visible { outline: 3px solid #2563eb; outline-offset: -3px; }
.thumb img, .thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-icon { position: absolute; inset: 0; display: grid; place-items: center; font-size: 30px; color: #8a97ab; }
.kind { position: absolute; left: 8px; bottom: 8px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 5px; background: #13223acc; color: #fff; font-size: 11px; }
.body { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 6px; min-width: 0; }
.body strong { font-size: 13px; color: #13223a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.body small { font-size: 11.5px; color: #64748b; }
.badge { align-self: flex-start; padding: 2px 8px; border-radius: 999px; background: #eef3ff; color: #2549a8; font-size: 11px; font-weight: 700; }
.actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 12px 12px; margin-top: auto; }
.link { display: inline-flex; align-items: center; gap: 5px; color: #2563eb; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 6px; padding: 4px 2px; cursor: pointer; }
.link:hover { text-decoration: underline; }
.link:focus-visible, .btn:focus-visible, .type-tabs button:focus-visible { outline: 3px solid #2563eb; outline-offset: 2px; }
.icon-only { margin-left: auto; color: #5b6b82; font-size: 15px; padding: 4px 6px; }
.icon-only:hover { color: #2563eb; text-decoration: none; background: #eef2f8; }

.btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border: 1px solid #e6edf7; border-radius: 8px; background: #fff; color: #273a5a; font-size: 12.5px; font-weight: 700; cursor: pointer; text-decoration: none; }
.btn:hover:not(:disabled) { border-color: #2563eb; color: #2563eb; }
.btn:disabled { opacity: .6; cursor: default; }
.more { display: flex; justify-content: center; margin: 20px 0 8px; }

@media (max-width: 560px) {
  .assets-page { padding: 16px; }
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .search { min-width: 0; flex: 1; }
  .actions .link span, .actions .link { font-size: 11.5px; }
}
@media (prefers-reduced-motion: reduce) { .card, .type-tabs button { transition: none; } }
</style>
