<template>
  <!-- The person's Video Studio chats, newest first (owner, 2026-10-20: "no option to open the old conversations or open
       recent conversation in Video Studio"). Each opens in the Studio with its canvas and agent column, named by what
       the person asked for (GET /api/video/chats/, owner-scoped). -->
  <section v-if="chats.length || history" class="vrc" :aria-labelledby="headingId" data-test="studio-recent-chats">
    <div class="vrc-heading"><h2 :id="headingId" class="vrc-title">{{ history ? 'Your conversations' : 'Recent chats' }}</h2><button v-if="limit && !history" type="button" class="vrc-view-all" @click="emit('history',$event)">View all</button></div>
    <label v-if="history" class="vrc-search"><span>Search your conversations</span><input v-model="query" type="search" placeholder="Search names, pages, presets and messages…" data-test="studio-recent-search" /></label>
    <p v-if="history && error" class="vrc-note" role="alert">{{ error }} <button type="button" class="vrc-more" @click="load(1)">Try again</button></p>
    <p v-if="history && searching" class="vrc-note" role="status">Searching…</p>
    <p v-else-if="history && !loading && !error && !shownChats.length" class="vrc-note" role="status" data-test="studio-recent-empty">{{ applied ? `No conversation matches “${applied}”. Try other words.` : 'Your Studio conversations will appear here after you send a message.' }}</p>
    <ul class="vrc-list">
      <li v-for="c in shownChats" :key="c.id">
        <router-link :to="{ path: pageOf(c) ? featureLink(pageOf(c)) : '/video-studio/dashboard', query: { conversation: String(c.id) } }" class="vrc-item"
                     :class="{ active: isOpen(c) }" :aria-current="isOpen(c) ? 'page' : undefined" :title="label(c)"
                     data-test="studio-recent-chat">
          <span class="vrc-name">{{ label(c) }}</span>
          <span class="vrc-day">{{ day(c.updated_at || c.created_at) }}</span>
        </router-link>
      </li>
    </ul>
    <button v-if="hasMore && (!limit || history)" type="button" class="vrc-more" :disabled="loading" data-test="studio-recent-more" @click="load(page + 1)">
      {{ loading ? 'Loading…' : 'Show more' }}</button>
  </section>
</template>

<script setup>
import { studioChatName } from '../../services/studioMessagePresentation'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch, useId } from 'vue'
import { featureLink, getStudioFeature } from '../../services/studioFeatures'
import { studioOrigin } from '../../services/studioOrigins'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'

const PAGE = 15, SEARCH_DELAY = 300
const props=defineProps({ history: Boolean, limit: {type:Number,default:0} })
const emit=defineEmits(['history'])
const headingId = `studio-recent-${useId()}`
const query = ref(''), error = ref('')
const route = useRoute()
const chat = useChatStore()
const chats = ref([])
const page = ref(0)
const total = ref(0)
const loading = ref(false)
let sequence = 0, disposed = false
// The server searches every chat (name, page, preset and every message), so the list shows what it answered.
const applied = ref(''), searching = computed(() => loading.value && page.value === 0 && !!applied.value)
const shownChats = computed(() => props.limit && !props.history ? chats.value.slice(0, props.limit) : chats.value)

const hasMore = computed(() => chats.value.length < total.value)
const user = inject('studioUser', ref(null))
// The page a chat belongs to: the server's record (from its first message), else this browser's note of where it
// was opened (a session with only an uploaded file has no message yet). It opens there and is named after it.
function pageOf(c) {
  const id = c.studio_feature || c.page, server = id ? getStudioFeature(id) : null
  return server && server.status !== 'soon' ? server : studioOrigin(user.value?.id, 'conversation', c.id)
}
// The server answers "Untitled chat" (video_studio/services/studio_chats.UNTITLED) for a chat with nothing to name it by.
function label(c) { const page = pageOf(c); return studioChatName(c.name === 'Untitled chat' ? '' : c.name, page && page.id !== 'home' ? `${page.label} chat` : 'Untitled chat') }
function isOpen(c) { return String(route.query.conversation || chat.conversationId || '') === String(c.id) }
function day(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// A first page replaces whatever was loading (a new search, a refresh); "Show more" waits for the current read.
async function load(next = 1) {
  if (loading.value && next !== 1) return
  const seq = ++sequence
  if (next === 1 && applied.value !== query.value.trim()) { applied.value = query.value.trim(); chats.value = []; total.value = 0; page.value = 0 }
  loading.value = true
  error.value = ''
  try {
    const params = { page: next, page_size: PAGE, ...(applied.value ? { q: applied.value } : {}) }
    const { data } = await api.get('/video/chats/', { params })
    if (disposed || seq !== sequence) return
    const rows = data?.results || []
    total.value = Number(data?.count ?? rows.length)
    const seen = new Set(next === 1 ? [] : chats.value.map((c) => c.id))
    chats.value = next === 1 ? rows : [...chats.value, ...rows.filter((c) => !seen.has(c.id))]
    page.value = next
  } catch { if (!disposed && seq === sequence) error.value = 'Could not load your conversations.' }
  finally { if (!disposed && seq === sequence) loading.value = false }
}

let typing = null
onMounted(() => load(1))
watch(() => user.value?.id, () => { clearTimeout(typing); sequence++; chats.value = []; total.value = 0; page.value = 0; query.value = ''; applied.value = ''; loading.value = false; load(1) })
// Typing waits for a short pause before it asks the server; an older answer is dropped by the sequence check.
watch(query, () => { clearTimeout(typing); typing = setTimeout(() => { if (!disposed && query.value.trim() !== applied.value) load(1) }, SEARCH_DELAY) })
onBeforeUnmount(() => { disposed = true; sequence++; clearTimeout(typing) })
// A new chat starts with the first message, and a reply moves a chat to the top: refresh the first page then.
watch(() => chat.conversationId, (now, was) => { if (now && now !== was) load(1) })
watch(() => chat.isBusy, (busy, was) => { if (was && !busy) load(1) })
</script>

<style scoped>
.vrc-search{display:grid;gap:7px;margin:14px 0;font-size:12px;color:var(--vm-ink-soft)}.vrc-search input{width:100%;min-height:44px;border:1px solid var(--vm-line);border-radius:7px;padding:10px 12px;background:var(--vm-surface-2);color:var(--vm-ink);font:inherit}.vrc-note{font-size:12px;line-height:1.8;color:var(--vm-ink-soft)}
.vrc { margin-top: 18px; min-height: 0; min-width: 0; display: flex; flex-direction: column; }
.vrc-title { margin: 0 0 6px; padding: 0 10px; font-size: 12px; font-weight: 600; color: var(--vm-ink-faint); }
/* minmax(0, 1fr): a long name is cut with an ellipsis inside the navigation's width, never widens it. Many chats
   scroll inside the list, so the brand, the pages and the footer stay in place (seen on a phone: the list ran over
   "Back to AADML"). */
.vrc-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px;
  flex: 0 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.vrc-item { display: flex; align-items: baseline; gap: 8px; min-height: 36px; padding: 8px 10px; box-sizing: border-box; border-radius: 6px;
  color: var(--vm-ink-soft); font-size: 13px; text-decoration: none; transition: background-color .15s, color .15s; }
.vrc-item:hover { background: var(--vm-surface); color: var(--vm-ink); }
.vrc-item.active { background: var(--vm-surface); color: var(--vm-ink); }
.vrc-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vrc-day { flex-shrink: 0; font-size: 11.5px; color: var(--vm-ink-faint); font-variant-numeric: tabular-nums; }
.vrc-more { align-self: flex-start; margin: 6px 10px 0; min-height: 32px; padding: 0 10px; border: 1px solid var(--vm-line); border-radius: 6px;
  background: transparent; color: var(--vm-ink-soft); font: inherit; font-size: 12.5px; cursor: pointer; }
.vrc-more:hover:not(:disabled) { background: var(--vm-surface); color: var(--vm-ink); }
.vrc-item:focus-visible, .vrc-more:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
@media (pointer: coarse) { .vrc-item { min-height: 44px; } .vrc-more { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .vrc-item { transition: none; } }
</style>

<style scoped>.vrc-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.vrc-view-all{background:none;border:0;color:var(--vm-ink-soft);font:inherit;font-size:10px;min-height:36px;padding:0;cursor:pointer}.vrc-heading .vrc-title{margin:0}@media(pointer:coarse){.vrc-view-all{min-height:44px}}</style>
