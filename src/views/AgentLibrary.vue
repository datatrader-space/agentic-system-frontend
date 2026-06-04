<template>
  <div class="agent-library-container p-4 sm:p-6 bg-gray-50 min-h-screen">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Agent Library</h1>
          <p class="text-sm sm:text-base text-slate-500 mt-1.5">Design, test, and deploy specialized AI agents</p>
        </div>
        <div class="flex items-center gap-3">
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

      <!-- Agent Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div 
          v-for="agent in agents" 
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
                  
                  <!-- Action Menu (Delete on hover) -->
                  <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button v-if="agent.is_owner !== false" @click.stop="confirmDelete(agent)" class="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors z-10 relative" title="Delete agent">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                  </div>
              </div>
              
              <div class="mt-4">
                  <h3 class="text-base font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{{ agent.name }}</h3>
                  
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
              @click.stop="editAgent(agent.id)"
              class="flex-1 px-3 py-2 text-slate-700 bg-white border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] rounded-[10px] hover:bg-slate-50 hover:text-slate-900 transition-all text-[13px] font-semibold z-10 relative"
            >
              Configure
            </button>
            <button
               @click.stop="launchSession(agent)"
               class="flex-1 px-3 py-2 text-indigo-700 bg-indigo-50/80 border border-indigo-100 shadow-[0_1px_2px_rgba(79,70,229,0.05)] rounded-[10px] hover:bg-indigo-600 hover:text-white transition-all duration-300 text-[13px] font-semibold z-10 relative"
            >
               Deploy
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';
import OwnerFilter from '../components/common/OwnerFilter.vue';

const router = useRouter();
const loading = ref(true);
const agents = ref([]);
const ownerFilter = ref('');

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
    router.push('/agents/new'); // Opens Playground in 'new' mode
};

const editAgent = (id) => {
    router.push(`/agents/${id}`); // Opens Playground in 'edit' mode
};

const launchSession = (agent) => {
    // TODO: Open a modal to select System/Repo before launching
    alert("Launch feature coming soon! Use 'Edit / Test' to run in Playground.");
};

const confirmDelete = async (agent) => {
    const confirmed = confirm(
        `⚠️ Delete "${agent.name}"?\n\n` +
        `This will permanently delete:\n` +
        `- The agent configuration\n` +
        `- All conversations (${agent.conversation_count || 'unknown'} total)\n` +
        `- All knowledge files\n` +
        `- All related data\n\n` +
        `This action cannot be undone.`
    );
    
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
        alert('✅ Agent deleted successfully');
    } catch (error) {
        console.error('Failed to delete agent:', error);
        alert(
            '❌ Failed to delete agent\n\n' +
            (error.response?.data?.error || error.message || 'Unknown error')
        );
    }
};

onMounted(() => {
    fetchAgents();
});
</script>
