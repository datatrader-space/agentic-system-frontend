<template>
  <div class="bal">
    <header class="bal-head">
      <div>
        <h1>Built-in agents</h1>
        <p>Ready-made agents provided by the platform. Run one as-is, or make an editable copy — the
          original stays unchanged so you can safely customize your own version.</p>
      </div>
      <button class="btn ghost" @click="$router.back()"><Icon icon="lucide:arrow-left" /> Back</button>
    </header>

    <div v-if="loading" class="grid">
      <div v-for="n in 6" :key="n" class="card skel" />
    </div>

    <div v-else-if="error" class="state err">Couldn’t load built-in agents. <button class="link" @click="load">Retry</button></div>

    <div v-else-if="!agents.length" class="state">
      No built-in agents are available to you yet. An admin can publish one (scope <strong>All users</strong>) in the admin console.
    </div>

    <div v-else class="grid">
      <article v-for="a in agents" :key="a.id" class="card">
        <div class="card-top">
          <span class="ic" :class="tint(a)"><Icon :icon="icon(a)" /></span>
          <span class="scope" :class="a.builtin_visibility">{{ scopeLabel(a.builtin_visibility) }}</span>
        </div>
        <h3>{{ a.name }}</h3>
        <p class="desc">{{ a.description || 'A platform-provided agent.' }}</p>
        <div class="card-actions">
          <button class="btn primary" :disabled="cloning === a.builtin_key" @click="clone(a)">
            <Icon :icon="cloning === a.builtin_key ? 'lucide:loader-2' : 'lucide:copy'" :class="{ spin: cloning === a.builtin_key }" />
            {{ cloning === a.builtin_key ? 'Copying…' : 'Use a copy' }}
          </button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import api from '../services/api'

const notify = inject('notify', (m) => console.log(m))
const router = useRouter()
const agents = ref([])
const loading = ref(true)
const error = ref(false)
const cloning = ref(null)

const TINTS = ['t-blue', 't-violet', 't-emerald', 't-amber', 't-rose', 't-cyan']
function tint(a) { return TINTS[(a.id || 0) % TINTS.length] }
function icon(a) {
  const n = (a.name || '').toLowerCase()
  if (n.includes('help') || n.includes('support')) return 'lucide:life-buoy'
  if (n.includes('research') || n.includes('analyst')) return 'lucide:search'
  if (n.includes('onboard')) return 'lucide:compass'
  return 'lucide:bot'
}
function scopeLabel(v) { return v === 'user' ? 'All users' : (v === 'admin' ? 'Admin' : 'System') }

async function load() {
  loading.value = true; error.value = false
  try {
    const { data } = await api.listBuiltinAgents()
    agents.value = Array.isArray(data) ? data : (data?.agents || [])
  } catch (e) { error.value = true }
  loading.value = false
}

async function clone(a) {
  cloning.value = a.builtin_key
  try {
    const { data } = await api.cloneBuiltinAgent(a.builtin_key)
    notify(`Copied "${a.name}" — opening your editable version`, 'success')
    if (data?.id) router.push(`/dashboard/agents/${data.id}/editor`)
  } catch (e) { notify(e?.response?.data?.detail || 'Could not make a copy', 'error') }
  cloning.value = null
}

onMounted(load)
</script>

<style scoped>
.bal { padding: 28px 32px 60px; }
.bal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.bal-head h1 { margin: 0; font-size: 22px; font-weight: 800; }
.bal-head p { margin: 6px 0 0; color: #64748b; font-size: 13px; max-width: 640px; line-height: 1.5; }
.btn { display: inline-flex; align-items: center; gap: 7px; height: 38px; border-radius: 9px; padding: 0 15px; font-size: 13px; font-weight: 700; border: 1px solid transparent; cursor: pointer; }
.btn.primary { background: #4f46e5; color: #fff; } .btn.ghost { background: #fff; border-color: #d8e2f0; color: #334155; }
.btn:disabled { opacity: .6; } .btn svg { width: 15px; height: 15px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.card { display: flex; flex-direction: column; background: #fff; border: 1px solid #e5ebf3; border-radius: 14px; padding: 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04); }
.card.skel { height: 190px; background: linear-gradient(90deg,#f1f5f9,#f8fafc,#f1f5f9); animation: pulse 1.4s infinite; }
@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .6 } }
.card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.ic { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 12px; }
.ic svg { width: 22px; height: 22px; }
.t-blue { background: #eff4ff; color: #2563eb; } .t-violet { background: #f5f3ff; color: #7c3aed; }
.t-emerald { background: #ecfdf5; color: #059669; } .t-amber { background: #fffbeb; color: #d97706; }
.t-rose { background: #fff1f2; color: #e11d48; } .t-cyan { background: #ecfeff; color: #0891b2; }
.scope { border-radius: 6px; padding: 3px 9px; font-size: 10.5px; font-weight: 850; text-transform: capitalize; }
.scope.user { background: #dff8ef; color: #059669; } .scope.admin { background: #eef4ff; color: #2563eb; } .scope.system { background: #f1f5f9; color: #64748b; }
.card h3 { margin: 0 0 6px; font-size: 15px; font-weight: 800; color: #0f172a; }
.desc { margin: 0 0 16px; flex: 1; font-size: 12.5px; line-height: 1.5; color: #64748b; }
.card-actions { display: flex; gap: 8px; }
.state { padding: 44px; text-align: center; color: #64748b; } .state.err { color: #b45309; }
.link { border: 0; background: transparent; color: #4f46e5; font-weight: 700; cursor: pointer; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
</style>
