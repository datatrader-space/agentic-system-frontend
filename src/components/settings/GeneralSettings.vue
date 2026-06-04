<template>
  <div class="panel">
    <div class="card">
      <h3 class="card-title">Appearance</h3>
      <p class="card-sub">Choose how the interface looks.</p>
      <div class="row">
        <div>
          <div class="row-label">Theme</div>
          <div class="row-hint">Dark mode is in beta.</div>
        </div>
        <div class="seg">
          <button class="seg-btn" :class="{ active: !isDark }" @click="setTheme('light')">Light</button>
          <button class="seg-btn" :class="{ active: isDark }" @click="setTheme('dark')">Dark</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Account</h3>
      <p class="card-sub">Your profile details.</p>
      <div class="field">
        <label>Username</label>
        <input :value="currentUser?.username || ''" readonly />
      </div>
      <div class="field">
        <label>Email</label>
        <input :value="currentUser?.email || '—'" readonly />
      </div>
      <div class="field">
        <label>Plan</label>
        <input :value="currentUser?.github_username ? 'Pro Plan' : 'Free Plan'" readonly />
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'
import { useTheme } from '../../composables/useTheme'

const currentUser = inject('currentUser', ref(null))
const { theme, isDark, toggleTheme } = useTheme()

const setTheme = (mode) => {
  if ((mode === 'dark') !== isDark.value) toggleTheme()
}
</script>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #e7eaf0; border-radius: 14px; padding: 20px; }
.card-title { font-size: 1rem; font-weight: 600; color: #0f172a; margin: 0 0 2px; }
.card-sub { font-size: 0.8125rem; color: #94a3b8; margin: 0 0 16px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.row-label { font-size: 0.875rem; font-weight: 500; color: #334155; }
.row-hint { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
.seg { display: inline-flex; padding: 3px; background: #f1f5f9; border-radius: 9px; }
.seg-btn { padding: 6px 14px; font-size: 0.8125rem; font-weight: 500; color: #64748b; background: transparent; border: none; border-radius: 7px; cursor: pointer; }
.seg-btn.active { background: #fff; color: #4f46e5; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.field { display: flex; flex-direction: column; gap: 5px; margin-top: 12px; }
.field label { font-size: 0.8125rem; font-weight: 500; color: #475569; }
.field input { padding: 9px 12px; font-size: 0.875rem; color: #0f172a; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; }
.field input[readonly] { color: #64748b; cursor: default; }
</style>
