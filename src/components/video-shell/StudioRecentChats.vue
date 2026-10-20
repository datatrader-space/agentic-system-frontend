<template>
  <!-- The person's Video Studio chats, newest first (owner, 2026-10-20: "no option to open the old conversations or open
       recent conversation in Video Studio"). Each opens in the Studio with its canvas and agent column, named by what
       the person asked for (GET /api/video/chats/, owner-scoped). -->
  <section v-if="chats.length" class="vrc" aria-labelledby="vrc-title" data-test="studio-recent-chats">
    <h2 id="vrc-title" class="vrc-title">Recent chats</h2>
    <ul class="vrc-list">
      <li v-for="c in chats" :key="c.id">
        <router-link :to="{ path: '/video-studio', query: { conversation: String(c.id) } }" class="vrc-item"
                     :class="{ active: isOpen(c) }" :aria-current="isOpen(c) ? 'page' : undefined" :title="label(c)"
                     data-test="studio-recent-chat">
          <span class="vrc-name">{{ label(c) }}</span>
          <span class="vrc-day">{{ day(c.updated_at || c.created_at) }}</span>
        </router-link>
      </li>
    </ul>
    <button v-if="hasMore" type="button" class="vrc-more" :disabled="loading" data-test="studio-recent-more" @click="load(page + 1)">
      {{ loading ? 'Loading…' : 'Show more' }}</button>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'

const PAGE = 15
const route = useRoute()
const chat = useChatStore()
const chats = ref([])
const page = ref(0)
const total = ref(0)
const loading = ref(false)

const hasMore = computed(() => chats.value.length < total.value)
function label(c) { return c.name || 'Untitled chat' }
function isOpen(c) { return String(route.query.conversation || chat.conversationId || '') === String(c.id) }
function day(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

async function load(next = 1) {
  if (loading.value) return
  loading.value = true
  try {
    const { data } = await api.get('/video/chats/', { params: { page: next, page_size: PAGE } })
    const rows = data?.results || []
    total.value = Number(data?.count ?? rows.length)
    const seen = new Set(next === 1 ? [] : chats.value.map((c) => c.id))
    chats.value = next === 1 ? rows : [...chats.value, ...rows.filter((c) => !seen.has(c.id))]
    page.value = next
  } catch { /* the Studio still works without the list */ }
  finally { loading.value = false }
}

onMounted(() => load(1))
// A new chat starts with the first message, and a reply moves a chat to the top: refresh the first page then.
watch(() => chat.conversationId, (now, was) => { if (now && now !== was) load(1) })
watch(() => chat.isBusy, (busy, was) => { if (was && !busy) load(1) })
</script>

<style scoped>
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
