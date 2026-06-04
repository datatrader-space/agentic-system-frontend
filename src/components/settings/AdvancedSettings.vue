<template>
  <div class="panel">
    <div class="card">
      <h3 class="card-title">Interface</h3>
      <p class="card-sub">Reset the v2 workspace layout (sidebar/panel collapse state).</p>
      <div class="row">
        <div class="row-label">Reset layout preferences</div>
        <button class="btn" @click="resetLayout">Reset</button>
      </div>
    </div>

    <div class="card danger">
      <h3 class="card-title">Danger Zone</h3>
      <p class="card-sub">Clears local app data (preferences, drafts, cached selections) from this browser. Does not affect your account or server data.</p>
      <div class="row">
        <div class="row-label">Clear local data</div>
        <button class="btn-danger" @click="clearLocal">Clear</button>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">About</h3>
      <div class="kv"><span>Interface</span><span>Agentic v2</span></div>
      <div class="kv"><span>Platform</span><span>{{ platform }}</span></div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const notify = inject('notify', () => {})
const platform = navigator.platform || 'web'

const resetLayout = () => {
  try {
    localStorage.removeItem('v2_layout_prefs')
    notify('Layout preferences reset. Reload to apply.', 'success')
  } catch {
    notify('Could not reset layout.', 'error')
  }
}

const clearLocal = () => {
  if (!confirm('Clear local app data from this browser? You will stay signed in.')) return
  try {
    const keys = ['v2_layout_prefs', 'v2_current_system', 'v2_agent_rules']
    keys.forEach((k) => localStorage.removeItem(k))
    notify('Local app data cleared.', 'success')
  } catch {
    notify('Could not clear local data.', 'error')
  }
}
</script>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #e7eaf0; border-radius: 14px; padding: 20px; }
.card.danger { border-color: #fecaca; }
.card-title { font-size: 1rem; font-weight: 600; color: #0f172a; margin: 0 0 2px; }
.card.danger .card-title { color: #dc2626; }
.card-sub { font-size: 0.8125rem; color: #94a3b8; margin: 0 0 16px; line-height: 1.5; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.row-label { font-size: 0.875rem; font-weight: 500; color: #334155; }
.btn { padding: 8px 16px; font-size: 0.8125rem; font-weight: 500; color: #475569; background: #fff; border: 1px solid #e2e8f0; border-radius: 9px; cursor: pointer; }
.btn:hover { border-color: #c7d2fe; color: #4f46e5; }
.btn-danger { padding: 8px 16px; font-size: 0.8125rem; font-weight: 600; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 9px; cursor: pointer; }
.btn-danger:hover { background: #fee2e2; }
.kv { display: flex; justify-content: space-between; padding: 7px 0; font-size: 0.8125rem; border-bottom: 1px solid #f1f5f9; }
.kv:last-child { border-bottom: none; }
.kv span:first-child { color: #94a3b8; }
.kv span:last-child { color: #334155; font-weight: 500; }
</style>
