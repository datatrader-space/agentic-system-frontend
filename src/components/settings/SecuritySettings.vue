<template>
  <div class="panel">
    <div class="card">
      <h3 class="card-title">Session</h3>
      <p class="card-sub">You're signed in as <strong>{{ currentUser?.username || 'this account' }}</strong>.</p>
      <div class="row">
        <div>
          <div class="row-label">Sign out</div>
          <div class="row-hint">End your session on this device.</div>
        </div>
        <button class="btn-danger" @click="logout">Sign out</button>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">Connected accounts</h3>
      <p class="card-sub">External accounts linked to your profile.</p>
      <div class="row">
        <div class="row-label">GitHub</div>
        <span class="chip" :class="currentUser?.github_username ? 'ok' : 'muted'">
          {{ currentUser?.github_username || 'Not connected' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'

const currentUser = inject('currentUser', ref(null))
const logout = inject('logout', () => {})
</script>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #e7eaf0; border-radius: 14px; padding: 20px; }
.card-title { font-size: 1rem; font-weight: 600; color: #0f172a; margin: 0 0 2px; }
.card-sub { font-size: 0.8125rem; color: #94a3b8; margin: 0 0 16px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.row-label { font-size: 0.875rem; font-weight: 500; color: #334155; }
.row-hint { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
.btn-danger { padding: 8px 16px; font-size: 0.8125rem; font-weight: 600; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 9px; cursor: pointer; }
.btn-danger:hover { background: #fee2e2; }
.chip { padding: 4px 11px; font-size: 0.75rem; font-weight: 500; border-radius: 999px; }
.chip.ok { color: #16a34a; background: #f0fdf4; }
.chip.muted { color: #94a3b8; background: #f1f5f9; }
</style>
