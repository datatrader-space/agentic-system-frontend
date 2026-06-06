<template>
  <div class="agent-library-container p-4 sm:p-6 bg-gray-50 min-h-screen">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Agent Library</h1>
          <p class="text-sm sm:text-base text-slate-500 mt-1.5">Design, test, and deploy specialized AI agents</p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search agents…"
            class="px-3 py-2 border border-slate-200 rounded-[10px] text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none w-44"
          />
          <select
            v-model="sortBy"
            class="px-3 py-2 border border-slate-200 rounded-[10px] text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="recent">Recently updated</option>
            <option value="name">Name (A–Z)</option>
          </select>
          <OwnerFilter v-model="ownerFilter" @update:modelValue="fetchAgents" />
          <button
            @click="createAgent"
            class="w-full sm:w-auto px-5 py-2.5 bg-slate-900 text-white rounded-[10px] hover:bg-slate-800 transition-all font-semibold flex items-center justify-center gap-2 shadow-sm border border-transparent shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
          >
            <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Create Agent
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-16">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p class="mt-4 text-gray-600">Loading agent profiles...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="agents.length === 0" class="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="text-6xl mb-4">🧬</div>
        <h3 class="text-xl font-bold text-gray-900">No Agents Found</h3>
        <p class="text-gray-500 mt-2 mb-6">Create your first specialized agent to get started.</p>
        <button
          @click="createAgent"
          class="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium"
        >
          Design an Agent
        </button>
      </div>

      <!-- No matches for current search/filter -->
      <div v-else-if="filteredAgents.length === 0" class="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
        <div class="text-5xl mb-3">🔍</div>
        <h3 class="text-lg font-bold text-gray-900">No agents match your search</h3>
        <p class="text-gray-500 mt-1">Try a different term or clear the filter.</p>
      </div>

      <!-- Agent Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div
          v-for="agent in filteredAgents"
          :key="agent.id"
          class="group bg-white rounded-[16px] shadow-sm border border-slate-200/60 hover:shadow-md hover:border-slate-300 transition-all duration-300 hover:-translate-y-1 flex flex-col overflow-hidden relative cursor-pointer"
          @click="editAgent(agent.id)"
        >
          <!-- Card Header & Metadata -->
          <div class="p-5 sm:p-6 pb-0">
              <div class="flex items-start justify-between">
                  <!-- Avatar -->
                  <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 shadow-sm flex items-center justify-center text-xl transition-transform group-hover:scale-105 duration-300">
                      <span v-if="agent.name.toLowerCase().includes('aws')">☁️</span>
                      <span v-else-if="agent.name.toLowerCase().includes('deploy')">🚀</span>
                      <span v-else-if="agent.name.toLowerCase().includes('bot')">🤖</span>
                      <span v-else>✨</span>
                  </div>
                  
                  <!-- Status badge -->
                  <div>
                      <span v-if="agent.signal_enabled" class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600" title="External access (webhook / WebSocket) enabled">● Live</span>
                      <span v-else class="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400" title="Signals off">● Idle</span>
                  </div>
              </div>

              <div class="mt-4">
                  <h3 class="text-base font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{{ agent.name }}</h3>
                  <div v-if="agent.default_model_name" class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-md px-2 py-0.5 max-w-full truncate" :title="agent.default_model_name">
                      🧠 {{ agent.default_model_name }}
                  </div>

                  <!-- Metadata Row -->
                  <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-500 font-medium tracking-wide">
                      <span class="flex items-center gap-1.5">
                          <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                          {{ agent.tools.length }} Tools
                      </span>
                      <div class="w-1 h-1 rounded-full bg-slate-300"></div>
                      <span v-if="agent.knowledge_scope === 'system'" class="flex items-center gap-1.5">
                          <svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                          Global Context
                      </span>
                       <span v-else-if="agent.knowledge_scope === 'repository'" class="flex items-center gap-1.5">
                          <svg class="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                          Repo Context
                      </span>
                      <span v-else class="flex items-center gap-1.5 opacity-70">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                          Isolated
                      </span>
                  </div>
              </div>
          </div>
          
          <!-- Content Description -->
          <div class="p-5 sm:p-6 pt-3 flex-1 flex flex-col">
            <p v-if="agent.description" class="text-slate-500 text-sm line-clamp-2 leading-relaxed">
              {{ agent.description }}
            </p>
            <div v-else class="h-[2.5rem]"></div> <!-- Spacer to maintain rigid height consistency -->
          </div>

          <!-- Footer / Actions -->
          <div class="px-5 py-4 border-t border-slate-100 flex items-center gap-2 bg-slate-50/50 mt-auto">
            <button
               @click.stop="openChat(agent)"
               class="flex-1 px-3 py-2 text-white bg-indigo-600 border border-indigo-600 rounded-[10px] hover:bg-indigo-700 transition-all text-[13px] font-semibold z-10 relative flex items-center justify-center gap-1.5"
            >
               💬 Chat
            </button>
            <button
              @click.stop="editAgent(agent.id)"
              class="flex-1 px-3 py-2 text-slate-700 bg-white border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] rounded-[10px] hover:bg-slate-50 hover:text-slate-900 transition-all text-[13px] font-semibold z-10 relative flex items-center justify-center gap-1.5"
            >
              ⚙ Configure
            </button>
            <!-- Overflow menu -->
            <div class="relative">
              <button
                @click.stop="toggleMenu(agent.id)"
                class="px-2.5 py-2 text-slate-500 bg-white border border-slate-200 rounded-[10px] hover:bg-slate-50 transition-all text-[13px] font-bold z-10 relative"
                title="More actions"
              >⋯</button>
              <div
                v-if="openMenuId === agent.id"
                @click.stop
                class="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-sm"
              >
                <button @click.stop="openMonitor(agent)" class="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2">📊 Monitor</button>
                <button @click.stop="openIntegrationGuide(agent)" class="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2">📖 Integration Guide ↗</button>
                <button @click.stop="duplicateAgent(agent)" class="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2">📋 Duplicate</button>
                <button v-if="agent.is_owner !== false" @click.stop="confirmDelete(agent); closeMenus()" class="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2">🗑 Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';
import OwnerFilter from '../components/common/OwnerFilter.vue';
import { notify } from '@/composables/useNotify';
import { confirm } from '@/composables/useConfirm';

const router = useRouter();
const loading = ref(true);
const agents = ref([]);
const ownerFilter = ref('');
const searchQuery = ref('');
const sortBy = ref('recent');   // 'recent' | 'name'
const openMenuId = ref(null);

const filteredAgents = computed(() => {
    let list = agents.value.slice();
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
        list = list.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.description || '').toLowerCase().includes(q)
        );
    }
    if (sortBy.value === 'name') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else {
        list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
    }
    return list;
});

const fetchAgents = async () => {
    try {
        loading.value = true;
        const params = {};
        if (ownerFilter.value) params.owner = ownerFilter.value;
        const response = await api.get('/agents/', { params });
        agents.value = response.data.results || response.data;
    } catch (e) {
        console.error("Failed to fetch agents", e);
    } finally {
        loading.value = false;
    }
};

const createAgent = () => {
    router.push('/dashboard/agents/new'); // Opens Playground in 'new' mode (inside dashboard shell)
};

const editAgent = (id) => {
    router.push(`/dashboard/agents/${id}/configure`); // Opens the new single-canvas builder (inside dashboard shell)
};

const openChat = (agent) => {
    router.push(`/dashboard/agents/${agent.id}`); // Playground (chat / test)
};

const openMonitor = (agent) => {
    openMenuId.value = null;
    router.push(`/dashboard/agents/${agent.id}/monitor`);
};

const openIntegrationGuide = (agent) => {
    openMenuId.value = null;
    window.open(`/integration-guide/${agent.id}`, '_blank', 'noopener');
};

const duplicateAgent = async (agent) => {
    openMenuId.value = null;
    try {
        // Fetch the full agent, strip identity, post a copy
        const res = await api.get(`/agents/${agent.id}/`);
        const full = res.data || {};
        const copy = {
            name: `${full.name || 'Agent'} (copy)`,
            description: full.description || '',
            system_prompt_template: full.system_prompt_template || '',
            prompt_mode: full.prompt_mode || 'append',
            default_model: full.default_model || null,
            temperature: full.temperature,
            max_history_messages: full.max_history_messages,
            knowledge_scope: full.knowledge_scope,
            code_mode_enabled: full.code_mode_enabled,
            code_mode_services: full.code_mode_services || [],
            builder_mode_enabled: full.builder_mode_enabled,
            tool_ids: (full.tools || []).map(t => t.id),
        };
        const created = await api.post('/agents/', copy);
        await fetchAgents();
        if (created?.data?.id) router.push(`/dashboard/agents/${created.data.id}/configure`);
    } catch (e) {
        notify.error('Failed to duplicate agent: ' + (e.response?.data?.error || e.message));
    }
};

const toggleMenu = (id) => {
    openMenuId.value = openMenuId.value === id ? null : id;
};
const closeMenus = () => { openMenuId.value = null; };

const confirmDelete = async (agent) => {
    const confirmed = await confirm({
        title: `Delete "${agent.name}"?`,
        message: `⚠️ Delete "${agent.name}"?\n\n` +
        `This will permanently delete:\n` +
        `- The agent configuration\n` +
        `- All conversations (${agent.conversation_count || 'unknown'} total)\n` +
        `- All knowledge files\n` +
        `- All related data\n\n` +
        `This action cannot be undone.`,
        confirmText: 'Delete',
        danger: true
    });

    if (confirmed) {
        await deleteAgent(agent.id);
    }
};

const deleteAgent = async (agentId) => {
    try {
        await api.delete(`/agents/${agentId}/`);
        
        // Remove from local state
        agents.value = agents.value.filter(a => a.id !== agentId);
        
        // Show success message (you can use a toast notification library here)
        notify.success('✅ Agent deleted successfully');
    } catch (error) {
        console.error('Failed to delete agent:', error);
        notify.error(
            '❌ Failed to delete agent\n\n' +
            (error.response?.data?.error || error.message || 'Unknown error')
        );
    }
};

onMounted(() => {
    fetchAgents();
    document.addEventListener('click', closeMenus);
});
onBeforeUnmount(() => {
    document.removeEventListener('click', closeMenus);
});
</script>
