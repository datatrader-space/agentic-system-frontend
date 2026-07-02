<template>
  <div class="ns">
    <header class="ns-head">
      <h2>Notifications</h2>
      <p>Choose which events also email you. The in-app bell always shows every notification —
        these switches only control outbound email. Security &amp; account emails are always sent.</p>
    </header>

    <div v-if="loading" class="ns-loading">Loading…</div>

    <div v-else class="ns-list">
      <label v-for="o in OPTIONS" :key="o.key" class="ns-row">
        <span class="ns-info">
          <span class="ns-title">{{ o.label }}</span>
          <span class="ns-desc">{{ o.desc }}</span>
        </span>
        <button type="button" class="ns-toggle" :class="{ on: prefs[o.key] }" :disabled="saving" @click="toggle(o.key)">
          <span class="ns-knob" :class="{ on: prefs[o.key] }" />
        </button>
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, inject } from 'vue'
import api from '../../services/api'

const notify = inject('notify', (m) => console.log(m))

const OPTIONS = [
  { key: 'agent_activity', label: 'Agent activity', desc: 'Runs that complete, fail, or resume.' },
  { key: 'escalations', label: 'Escalations & approvals', desc: 'Approvals awaiting a human, and agents auto-paused by a rule.' },
  { key: 'budget_alerts', label: 'Budget alerts', desc: 'Spend warnings and hard budget blocks.' },
  { key: 'product_updates', label: 'Product updates', desc: 'Occasional news about new features.' },
]

const prefs = reactive({ agent_activity: true, escalations: true, budget_alerts: true, product_updates: false })
const loading = ref(true)
const saving = ref(false)

async function load() {
  try { const { data } = await api.getNotifPreferences(); Object.assign(prefs, data || {}) } catch (e) { /* keep defaults */ }
  loading.value = false
}

async function toggle(key) {
  const next = !prefs[key]
  prefs[key] = next
  saving.value = true
  try { await api.updateNotifPreferences({ [key]: next }) }
  catch (e) { prefs[key] = !next; notify('Could not save preference', 'error') }
  saving.value = false
}

onMounted(load)
</script>

<style scoped>
.ns { max-width: 720px; }
.ns-head h2 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
.ns-head p { margin: 6px 0 20px; color: #64748b; font-size: 13px; line-height: 1.5; }
.ns-loading { color: #94a3b8; font-size: 13px; padding: 20px 0; }
.ns-list { display: flex; flex-direction: column; gap: 4px; }
.ns-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 4px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
.ns-row:last-child { border-bottom: 0; }
.ns-info { display: flex; flex-direction: column; gap: 2px; }
.ns-title { font-size: 14px; font-weight: 700; color: #0f172a; }
.ns-desc { font-size: 12.5px; color: #64748b; }
.ns-toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; border: 0; border-radius: 999px; background: #e2e8f0; cursor: pointer; transition: background .15s; }
.ns-toggle.on { background: #4f46e5; }
.ns-toggle:disabled { opacity: .6; }
.ns-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.2); transition: transform .15s; }
.ns-knob.on { transform: translateX(20px); }
</style>
