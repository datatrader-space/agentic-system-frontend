<template>
  <AuthCard title="Forgot password?" subtitle="Enter your email and we'll send you a reset link.">
    <div v-if="sent" class="note ok">
      If an account exists for <strong>{{ email }}</strong>, a reset link is on its way. Check your inbox.
    </div>
    <form v-else class="form" @submit.prevent="submit">
      <label class="lbl">Email address</label>
      <input v-model="email" type="email" required placeholder="you@company.com" class="inp" autocomplete="email" />
      <button type="submit" class="btn" :disabled="loading">
        <span v-if="loading" class="spin"></span>
        <span v-else>Send reset link</span>
      </button>
    </form>
    <p class="alt">Remembered it? <router-link to="/login">Sign in</router-link></p>
  </AuthCard>
</template>

<script setup>
import { ref } from 'vue'
import AuthCard from '../components/public/AuthCard.vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'

useMeta({ title: 'Reset password — AADML' })

const email = ref('')
const loading = ref(false)
const sent = ref(false)

async function submit() {
  loading.value = true
  try {
    await api.forgotPassword(email.value)
    sent.value = true
  } catch (e) {
    // Backend always returns 200; treat anything else as sent too (no enumeration).
    sent.value = true
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.lbl { font-size: .85rem; font-weight: 500; color: var(--vm-ink-soft); }
.inp { padding: 12px 14px; border-radius: 11px; border: 1px solid var(--vm-border); background: var(--vm-surface); outline: none; font-size: .95rem; color: var(--vm-ink); }
.inp:focus { border-color: var(--vm-primary); box-shadow: 0 0 0 3px var(--vm-primary-soft); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; padding: 13px; border-radius: 11px; border: none; font-weight: 600; color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-p); cursor: pointer; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.note { margin-top: 8px; padding: 14px; border-radius: 12px; font-size: .9rem; }
.note.ok { color: #047857; background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.25); }
.alt { margin-top: 18px; font-size: .875rem; color: var(--vm-ink-soft); text-align: center; }
.alt a { color: var(--vm-primary); font-weight: 600; text-decoration: none; }
.spin { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
