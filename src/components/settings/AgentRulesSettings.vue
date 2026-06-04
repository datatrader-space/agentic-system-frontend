<template>
  <div class="panel">
    <div class="card">
      <h3 class="card-title">Agent Rules</h3>
      <p class="card-sub">Global instructions applied to your agents. Saved locally for now — backend wiring lands in a later step.</p>
      <textarea
        v-model="rules"
        class="rules-input"
        rows="8"
        placeholder="e.g. Always confirm before running destructive commands. Prefer concise answers…"
      ></textarea>
      <div class="actions">
        <span v-if="saved" class="saved-note">Saved</span>
        <button class="save-btn" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'

const LS_KEY = 'v2_agent_rules'
const notify = inject('notify', () => {})

const load = () => {
  try {
    return localStorage.getItem(LS_KEY) || ''
  } catch {
    return ''
  }
}

const rules = ref(load())
const saved = ref(false)

const save = () => {
  try {
    localStorage.setItem(LS_KEY, rules.value)
    saved.value = true
    notify('Agent rules saved locally.', 'success')
    setTimeout(() => (saved.value = false), 2000)
  } catch {
    notify('Could not save rules.', 'error')
  }
}
</script>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #e7eaf0; border-radius: 14px; padding: 20px; }
.card-title { font-size: 1rem; font-weight: 600; color: #0f172a; margin: 0 0 2px; }
.card-sub { font-size: 0.8125rem; color: #94a3b8; margin: 0 0 16px; line-height: 1.5; }
.rules-input {
  width: 100%;
  padding: 12px 14px;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.6;
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  resize: vertical;
}
.rules-input:focus { outline: none; border-color: #c7d2fe; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 14px; }
.saved-note { font-size: 0.8125rem; color: #16a34a; }
.save-btn { padding: 9px 20px; font-size: 0.875rem; font-weight: 600; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 9px; cursor: pointer; }
.save-btn:hover { transform: translateY(-1px); }
</style>
