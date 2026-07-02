<template>
  <div class="mx-auto w-full max-w-[1100px] px-6 py-6 font-[Inter,system-ui,sans-serif]">
    <!-- Page header -->
    <div class="mb-4 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <button class="back" @click="onClose"><Icon icon="lucide:arrow-left" /> Agents</button>
        <div>
          <h1 class="text-[20px] font-bold tracking-tight text-[#0F172A]">Workspace</h1>
          <p class="text-[13px] text-[#64748B]">{{ agent ? agent.name : 'Loading…' }} — files this agent reads &amp; writes.</p>
        </div>
      </div>
      <button v-if="agent" class="edit" @click="$router.push(`/dashboard/agents/${agent.id}/editor`)">
        <Icon icon="lucide:pencil" /> Configure
      </button>
    </div>

    <!-- Full-width, in-page workspace (embedded = no drawer/backdrop) -->
    <AgentWorkspacePanel v-if="agent" :agent="agent" :model-value="true" :embedded="true" @update:modelValue="onClose" />
    <div v-else class="grid min-h-[60vh] place-items-center text-[13px] text-slate-400">
      {{ error ? 'Could not load this agent.' : 'Loading workspace…' }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'
import AgentWorkspacePanel from '../components/AgentWorkspacePanel.vue'

const route = useRoute()
const router = useRouter()
const agent = ref(null)
const error = ref(false)

function onClose() { router.push('/dashboard/agents') }

onMounted(async () => {
  try { const { data } = await api.getAgent(route.params.id); agent.value = data }
  catch (e) { error.value = true }
})
</script>

<style scoped>
.back { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid #e5ebf3; border-radius: 9px; background: #fff; color: #334155; font-size: 13px; font-weight: 700; cursor: pointer; }
.back:hover { border-color: #c7d2fe; color: #4f46e5; }
.edit { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 13px; border: 1px solid #e5ebf3; border-radius: 9px; background: #fff; color: #334155; font-size: 13px; font-weight: 700; cursor: pointer; }
.edit:hover { border-color: #c7d2fe; color: #4f46e5; }
.back svg, .edit svg { width: 15px; height: 15px; }
</style>
