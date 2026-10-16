<!--
  Agent integrations — the first section of Integrations (owner, 2026-10-16).
  Every agent the person owns, with the three ways it can be used outside AADML (WebSocket live chat, Webhook
  events, the website chat widget) shown on/off. "Set up" opens the agent's page (its switches and settings,
  then the guide); "Guide" opens the same page at the guide. Only owned agents: nobody else can switch an
  agent's channels (the server checks it too).
-->
<template>
  <section class="rounded-[10px] border border-[#DDE6F2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b border-[#EDF2F9] px-6 py-5">
      <div class="flex min-w-0 items-start gap-3.5">
        <div class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#2563EB]">
          <Bot :size="19" class="text-white" />
        </div>
        <div class="min-w-0">
          <h2 class="text-[17px] font-[800] tracking-tight text-[#0F172A]">Agent integrations</h2>
          <p class="mt-1 max-w-[78ch] text-[13px] leading-relaxed text-[#52627A]">
            Use your agents outside AADML: in your own app over a live chat connection, from your backend with
            webhook events, or as a chat widget on your website. Choose an agent to turn each one on and get its guide.
          </p>
        </div>
      </div>
      <input v-model="query" type="search" placeholder="Search agents" aria-label="Search agents"
             class="w-[240px] rounded-[9px] border border-[#DDE6F2] px-3 py-2 text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB]" />
    </div>

    <!-- What the three channels are: the short version of the guide. -->
    <div class="grid gap-3 border-b border-[#EDF2F9] px-6 py-4 sm:grid-cols-3">
      <div v-for="c in channels" :key="c.key" class="rounded-[9px] bg-[#F8FAFC] px-3.5 py-3">
        <div class="flex items-center gap-2 text-[13px] font-[750] text-[#0F172A]">
          <component :is="c.icon" :size="15" class="text-[#2563EB]" /> {{ c.label }}
        </div>
        <p class="mt-1 text-[12px] leading-relaxed text-[#52627A]">{{ c.desc }}</p>
      </div>
    </div>

    <div v-if="loading" class="px-6 py-10 text-center text-[13px] font-semibold text-[#667994]">Loading…</div>
    <div v-else-if="loadError" class="px-6 py-8">
      <p class="text-[13px] font-semibold text-[#B42318]">{{ loadError }}</p>
      <button class="mt-2 text-[13px] font-semibold text-[#2563EB] underline" @click="load">Try again</button>
    </div>
    <div v-else-if="!owned.length" class="px-6 py-10 text-center text-[13px] text-[#52627A]">
      You have no agents yet.
      <router-link to="/dashboard/agents/new" class="font-semibold text-[#2563EB]">Create one</router-link>
      to put it in your app or on your website.
    </div>
    <div v-else-if="!shown.length" class="px-6 py-10 text-center text-[13px] text-[#52627A]">
      No agent matches “{{ query }}”.
    </div>
    <ul v-else class="divide-y divide-[#EDF2F9]">
      <li v-for="a in shown" :key="a.id" class="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <div class="min-w-0">
          <div class="truncate text-[14px] font-[700] text-[#0F172A]">{{ a.name }}</div>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <span v-for="c in channels" :key="c.key"
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold"
                  :class="isOn(a, c.key) ? 'bg-[#ECFDF3] text-[#067647]' : 'bg-[#F2F4F7] text-[#667085]'">
              <span class="h-1.5 w-1.5 rounded-full" :class="isOn(a, c.key) ? 'bg-[#12B76A]' : 'bg-[#98A2B3]'"></span>
              {{ c.label }} {{ isOn(a, c.key) ? 'on' : 'off' }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <router-link :to="`/dashboard/integrations/agents/${a.id}#guide`"
                       class="rounded-[9px] border border-[#DDE6F2] px-3 py-1.5 text-[13px] font-semibold text-[#344054] hover:bg-[#F8FAFC]">
            Guide
          </router-link>
          <router-link :to="`/dashboard/integrations/agents/${a.id}`"
                       class="rounded-[9px] bg-[#2563EB] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#1D4ED8]">
            Set up
          </router-link>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Bot, Globe, MessagesSquare, Webhook } from 'lucide-vue-next'

import api from '../../services/api'

const channels = [
  { key: 'websocket', label: 'WebSocket', icon: MessagesSquare,
    desc: 'Live, streamed chat inside your own app or product. Your server holds the access key.' },
  { key: 'webhook', label: 'Webhook', icon: Webhook,
    desc: 'Send an event from your backend and collect the result later. No person needs to be chatting.' },
  { key: 'widget', label: 'Widget', icon: Globe,
    desc: 'A chat bubble on your website for any visitor. Only the websites you list can show it.' },
]

const agents = ref([])
const loading = ref(true)
const loadError = ref('')
const query = ref('')

// The list endpoint's booleans: ws_chat_enabled is on unless switched off, like the agent page reads it.
function isOn(agent, key) {
  if (key === 'websocket') return agent.ws_chat_enabled !== false
  if (key === 'webhook') return !!agent.signal_enabled
  return !!agent.is_public
}

const owned = computed(() => agents.value.filter((a) => a.is_owner !== false))
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = q ? owned.value.filter((a) => (a.name || '').toLowerCase().includes(q)) : owned.value
  return [...rows].sort((x, y) => (x.name || '').localeCompare(y.name || ''))
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.getAgents()
    agents.value = Array.isArray(data) ? data : (data?.results || [])
  } catch (e) {
    loadError.value = 'Could not load your agents.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
