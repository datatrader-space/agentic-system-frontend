<!--
  Integrations › Agents (owner, 2026-10-16).
  The person's own agents (?owner=me), a page at a time, with the three ways an agent is used outside AADML:
  WebSocket live chat, Webhook events, the website chat widget. Search, channel filter and sort run on the
  server (/agents/?search=&channel=&ordering=), and the tiles are counted there too (/agents/stats/), so both
  stay right however many agents there are. "Set up" opens the agent's Integrations & Deploy page.
-->
<template>
  <div>
    <!-- Tiles -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div v-for="t in tiles" :key="t.key" class="rounded-[10px] border border-[#DDE6F2] bg-white px-4 py-3.5">
        <div class="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#667994]">
          <component :is="t.icon" :size="14" :class="t.color" /> {{ t.label }}
        </div>
        <div class="mt-1.5 flex items-baseline gap-1.5">
          <span v-if="statsLoading" class="inline-block h-6 w-10 animate-pulse rounded bg-[#EDF2F9]"></span>
          <span v-else class="text-[24px] font-[800] leading-none text-[#0F172A]">{{ stats[t.key] ?? 0 }}</span>
          <span v-if="!statsLoading" class="text-[12.5px] text-[#667994]">of {{ stats.total ?? 0 }} agents</span>
        </div>
      </div>
    </div>

    <section class="mt-4 rounded-[10px] border border-[#DDE6F2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2.5 border-b border-[#EDF2F9] px-4 py-3">
        <div class="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input v-model="query" type="search" placeholder="Search agents" aria-label="Search agents"
                 class="w-full rounded-[9px] border border-[#DDE6F2] py-2 pl-9 pr-3 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB]" />
        </div>
        <select v-model="channel" aria-label="Channel"
                class="rounded-[9px] border border-[#DDE6F2] bg-white px-3 py-2 text-[13px] text-[#344054] outline-none focus:border-[#2563EB]">
          <option value="">All agents</option>
          <option value="live">Live on any channel</option>
          <option value="none">Not live anywhere</option>
          <option value="websocket">WebSocket on</option>
          <option value="webhook">Webhook on</option>
          <option value="widget">Widget on</option>
        </select>
        <select v-model="ordering" aria-label="Sort"
                class="rounded-[9px] border border-[#DDE6F2] bg-white px-3 py-2 text-[13px] text-[#344054] outline-none focus:border-[#2563EB]">
          <option value="-updated_at">Recently updated</option>
          <option value="name">Name A–Z</option>
        </select>
        <button type="button" class="ml-auto inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-[13px] font-semibold text-[#2563EB] hover:bg-[#EFF4FF]"
                :aria-expanded="showHelp" @click="showHelp = !showHelp">
          <Info :size="15" /> How channels work
        </button>
      </div>

      <!-- The short version of the guide, on demand -->
      <div v-if="showHelp" class="grid gap-4 border-b border-[#EDF2F9] bg-[#F8FAFC] px-5 py-4 sm:grid-cols-3">
        <div v-for="c in channels" :key="c.key">
          <div class="flex items-center gap-1.5 text-[13px] font-[750] text-[#0F172A]">
            <component :is="c.icon" :size="14" class="text-[#2563EB]" /> {{ c.label }}
          </div>
          <p class="mt-1 text-[12.5px] leading-relaxed text-[#52627A]">{{ c.desc }}</p>
        </div>
      </div>

      <!-- Error -->
      <div v-if="loadError" class="px-6 py-10 text-center">
        <p class="text-[13px] font-semibold text-[#B42318]">{{ loadError }}</p>
        <button class="mt-3 rounded-[9px] border border-[#DDE6F2] px-3 py-1.5 text-[13px] font-semibold text-[#344054] hover:bg-[#F8FAFC]" @click="load">Try again</button>
      </div>

      <!-- No agents at all -->
      <div v-else-if="!loading && !rows.length && !filtering" class="px-6 py-14 text-center">
        <Bot :size="28" class="mx-auto text-[#98A2B3]" />
        <p class="mt-3 text-[14px] font-[700] text-[#0F172A]">No agents yet</p>
        <p class="mt-1 text-[13px] text-[#52627A]">Create an agent, then put it in your app, backend or website from here.</p>
        <router-link to="/dashboard/agents/new" class="mt-4 inline-block rounded-[9px] bg-[#2563EB] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#1D4ED8]">Create agent</router-link>
      </div>

      <!-- Nothing matches the search or filter -->
      <div v-else-if="!loading && !rows.length" class="px-6 py-14 text-center">
        <p class="text-[14px] font-[700] text-[#0F172A]">No agents match</p>
        <p class="mt-1 text-[13px] text-[#52627A]">Try another search or channel.</p>
        <button class="mt-4 rounded-[9px] border border-[#DDE6F2] px-3 py-1.5 text-[13px] font-semibold text-[#344054] hover:bg-[#F8FAFC]" @click="clearFilters">Clear filters</button>
      </div>

      <!-- Phone: one card per agent -->
      <ul v-else-if="!loading" class="divide-y divide-[#F2F4F7] md:hidden">
        <li v-for="a in rows" :key="'m' + a.id" class="px-4 py-3.5">
          <router-link :to="setupLink(a)" class="block truncate text-[14px] font-[700] text-[#0F172A]">{{ a.name }}</router-link>
          <div class="truncate text-[12.5px] text-[#667994]">{{ a.description || 'No description' }}</div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span v-for="c in channels" :key="c.key" class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                  :class="isOn(a, c.key) ? 'bg-[#ECFDF3] text-[#067647]' : 'bg-[#F2F4F7] text-[#667085]'">
              <span class="h-1.5 w-1.5 rounded-full" :class="isOn(a, c.key) ? 'bg-[#12B76A]' : 'bg-[#98A2B3]'"></span>{{ c.label }}
            </span>
          </div>
          <div class="mt-2.5 flex items-center gap-3">
            <router-link :to="setupLink(a)" class="inline-flex rounded-[8px] border border-[#DDE6F2] px-3 py-1.5 text-[13px] font-semibold text-[#344054]">Set up</router-link>
            <router-link :to="`${setupLink(a)}#guide`" class="text-[13px] font-semibold text-[#52627A]">Guide</router-link>
            <span class="ml-auto text-[12px] text-[#98A2B3]">{{ ago(a.updated_at) }}</span>
          </div>
        </li>
      </ul>

      <!-- Table (and the loading rows, on every width) -->
      <div v-if="!loadError && (loading || rows.length)" :class="['overflow-x-auto', loading ? '' : 'hidden md:block']">
        <table class="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr class="border-b border-[#EDF2F9] text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#667994]">
              <th class="px-5 py-2.5 font-semibold">Agent</th>
              <th v-for="c in channels" :key="c.key" class="w-[112px] px-3 py-2.5 font-semibold">{{ c.label }}</th>
              <th class="w-[120px] px-3 py-2.5 font-semibold">Updated</th>
              <th class="w-[170px] px-5 py-2.5"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="n in 5" :key="'s' + n" class="border-b border-[#F2F4F7] last:border-0">
                <td class="px-5 py-3.5"><div class="h-3.5 w-48 animate-pulse rounded bg-[#EDF2F9]"></div><div class="mt-2 h-3 w-72 animate-pulse rounded bg-[#F2F4F7]"></div></td>
                <td v-for="c in channels" :key="c.key" class="px-3 py-3.5"><div class="h-3.5 w-12 animate-pulse rounded bg-[#EDF2F9]"></div></td>
                <td class="px-3 py-3.5"><div class="h-3.5 w-16 animate-pulse rounded bg-[#EDF2F9]"></div></td>
                <td class="px-5 py-3.5"></td>
              </tr>
            </template>
            <tr v-for="a in rows" v-else :key="a.id" class="group border-b border-[#F2F4F7] last:border-0 hover:bg-[#F8FAFC]">
              <td class="max-w-0 px-5 py-3">
                <router-link :to="setupLink(a)" class="block truncate text-[13.5px] font-[700] text-[#0F172A] hover:text-[#2563EB]">{{ a.name }}</router-link>
                <div class="truncate text-[12.5px] text-[#667994]">{{ a.description || 'No description' }}</div>
              </td>
              <td v-for="c in channels" :key="c.key" class="px-3 py-3">
                <span class="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" :class="isOn(a, c.key) ? 'text-[#067647]' : 'text-[#98A2B3]'">
                  <span class="h-2 w-2 rounded-full" :class="isOn(a, c.key) ? 'bg-[#12B76A]' : 'bg-[#D0D5DD]'"></span>
                  {{ isOn(a, c.key) ? 'On' : 'Off' }}
                </span>
              </td>
              <td class="px-3 py-3 text-[12.5px] text-[#667994]" :title="a.updated_at">{{ ago(a.updated_at) }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center justify-end gap-3 whitespace-nowrap">
                  <router-link :to="`${setupLink(a)}#guide`" class="text-[13px] font-semibold text-[#52627A] hover:text-[#2563EB]">Guide</router-link>
                  <router-link :to="setupLink(a)" class="inline-flex rounded-[8px] border border-[#DDE6F2] px-3 py-1.5 text-[13px] font-semibold text-[#344054] hover:border-[#2563EB] hover:text-[#2563EB]">Set up</router-link>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="!loadError && count > 0" class="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDF2F9] px-5 py-3">
        <span class="text-[12.5px] text-[#667994]">Showing {{ firstRow }}–{{ lastRow }} of {{ count }} {{ count === 1 ? 'agent' : 'agents' }}</span>
        <nav v-if="totalPages > 1" class="flex items-center gap-1" aria-label="Pages">
          <button class="rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-40" :disabled="page <= 1" @click="page--">
            <ChevronLeft :size="15" class="inline" /> Prev
          </button>
          <template v-for="p in pageItems" :key="String(p)">
            <span v-if="typeof p !== 'number'" class="px-1.5 text-[13px] text-[#98A2B3]">…</span>
            <button v-else class="min-w-[32px] rounded-[8px] px-2 py-1.5 text-[13px] font-semibold"
                    :class="p === page ? 'bg-[#2563EB] text-white' : 'text-[#344054] hover:bg-[#F2F4F7]'"
                    :aria-current="p === page ? 'page' : undefined" @click="page = p">{{ p }}</button>
          </template>
          <button class="rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-40" :disabled="page >= totalPages" @click="page++">
            Next <ChevronRight :size="15" class="inline" />
          </button>
        </nav>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Bot, ChevronLeft, ChevronRight, Globe, Info, MessagesSquare, Radio, Search, Webhook } from 'lucide-vue-next'

import api from '../../services/api'

const PAGE_SIZE = 10

const channels = [
  { key: 'websocket', label: 'WebSocket', icon: MessagesSquare,
    desc: 'Live, streamed chat inside your own app or product. Your server holds the access key.' },
  { key: 'webhook', label: 'Webhook', icon: Webhook,
    desc: 'Send an event from your backend and collect the result later. No person needs to be chatting.' },
  { key: 'widget', label: 'Widget', icon: Globe,
    desc: 'A chat bubble on your website for any visitor. Only the websites you list can show it.' },
]
// Stats keys from /agents/stats/: `live` is the webhook count (the library's existing name).
const tiles = [
  { key: 'any_channel', label: 'Live on a channel', icon: Radio, color: 'text-[#12B76A]' },
  { key: 'websocket', label: 'WebSocket', icon: MessagesSquare, color: 'text-[#2563EB]' },
  { key: 'live', label: 'Webhook', icon: Webhook, color: 'text-[#2563EB]' },
  { key: 'widget', label: 'Widget', icon: Globe, color: 'text-[#2563EB]' },
]

const rows = ref([])
const count = ref(0)
const page = ref(1)
const loading = ref(true)
const loadError = ref('')
const query = ref('')
const search = ref('')                 // the query, once typing pauses
const channel = ref('')
const ordering = ref('-updated_at')
const showHelp = ref(false)
const stats = ref({})
const statsLoading = ref(true)

const filtering = computed(() => !!search.value || !!channel.value)
const totalPages = computed(() => Math.max(1, Math.ceil(count.value / PAGE_SIZE)))
const firstRow = computed(() => (count.value ? (page.value - 1) * PAGE_SIZE + 1 : 0))
const lastRow = computed(() => Math.min(page.value * PAGE_SIZE, count.value))
// 1 … 4 5 6 … 12: the first, the last and two either side of the current page.
const pageItems = computed(() => {
  const n = totalPages.value, cur = page.value, out = []
  for (let p = 1; p <= n; p++) {
    if (p === 1 || p === n || Math.abs(p - cur) <= 1) out.push(p)
    else if (out[out.length - 1] !== 'gap-' + (p < cur ? 'l' : 'r')) out.push('gap-' + (p < cur ? 'l' : 'r'))
  }
  return out
})

function isOn(agent, key) {
  if (key === 'websocket') return agent.ws_chat_enabled !== false
  if (key === 'webhook') return !!agent.signal_enabled
  return !!agent.is_public
}
const setupLink = (a) => `/dashboard/integrations/agents/${a.id}`

function ago(iso) {
  if (!iso) return ''
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60, h = m / 60, d = h / 24
  if (m < 60) return `${Math.floor(m)} min ago`
  if (h < 24) return `${Math.floor(h)} h ago`
  if (d < 30) return `${Math.floor(d)} d ago`
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

let seq = 0
async function load() {
  const mine = ++seq                   // a slower, older answer never replaces a newer one
  loading.value = true
  loadError.value = ''
  try {
    const params = { owner: 'me', page: page.value, page_size: PAGE_SIZE, ordering: ordering.value }
    if (search.value) params.search = search.value
    if (channel.value) params.channel = channel.value
    const { data } = await api.getAgentsPage(params)
    if (mine !== seq) return
    rows.value = Array.isArray(data) ? data : (data?.results || [])
    count.value = Array.isArray(data) ? rows.value.length : (data?.count ?? rows.value.length)
    if (page.value > totalPages.value) { page.value = totalPages.value; return }   // the watch reloads
  } catch (e) {
    if (mine !== seq) return
    loadError.value = 'Could not load your agents.'
  } finally {
    if (mine === seq) loading.value = false
  }
}

async function loadStats() {
  statsLoading.value = true
  try {
    const { data } = await api.getAgentStats({ owner: 'me' })
    stats.value = data || {}
  } catch (e) {
    stats.value = {}
  } finally {
    statsLoading.value = false
  }
}

function clearFilters() {
  query.value = ''
  search.value = ''
  channel.value = ''
}

let typing = null
watch(query, (q) => {
  clearTimeout(typing)
  typing = setTimeout(() => { search.value = q.trim() }, 300)
})
watch([search, channel, ordering], () => { if (page.value !== 1) page.value = 1; else load() })
watch(page, load)

onMounted(() => { load(); loadStats() })
onBeforeUnmount(() => clearTimeout(typing))
</script>
