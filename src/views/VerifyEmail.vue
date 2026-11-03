<template>
  <AuthCard :title="heading" :subtitle="''">
    <div v-if="state === 'verifying'" class="center">
      <span class="spin big"></span>
      <p class="msg">Verifying your email…</p>
    </div>

    <div v-else-if="state === 'ok'" class="center">
      <div class="badge ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg></div>
      <p class="msg">Your email is verified. Sign in to continue.</p>
      <router-link to="/login" class="btn">Sign in</router-link>
    </div>

    <div v-else class="center">
      <div class="badge err"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div>
      <p class="msg">This verification link is invalid or has expired.</p>
      <label class="email-field">
        <span>Your email</span>
        <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
      </label>
      <button class="btn ghost" :disabled="resending || !email.trim()" @click="resend">
        <span v-if="resending" class="spin"></span><span v-else>Resend verification email</span>
      </button>
      <p v-if="resendMsg" class="hint">{{ resendMsg }}</p>
      <router-link to="/login" class="link">Back to sign in</router-link>
    </div>
  </AuthCard>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AuthCard from '../components/public/AuthCard.vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'

useMeta({ title: 'Verify email — AADML' })

const route = useRoute()
const state = ref('verifying') // verifying | ok | error
const resending = ref(false)
const resendMsg = ref('')
// An account cannot sign in until it is verified (ADM-1141), so a new link is asked for by address, signed out.
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')

const heading = computed(() => ({ verifying: 'Verifying email', ok: 'Email verified', error: 'Verification failed' }[state.value]))

onMounted(async () => {
  const token = route.query.token
  if (!token) { state.value = 'error'; return }
  try {
    await api.verifyEmail(token)
    state.value = 'ok'
  } catch (e) {
    state.value = 'error'
  }
})

async function resend() {
  resending.value = true
  resendMsg.value = ''
  try {
    const { data } = await api.resendVerification(email.value.trim())
    resendMsg.value = data?.message || 'A new verification email has been sent.'
  } catch (e) {
    resendMsg.value = e.response?.data?.error || 'The link could not be sent. Please try again in a minute.'
  } finally {
    resending.value = false
  }
}
</script>

<style scoped>
.center { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; margin-top: 10px; }
.msg { font-size: .95rem; color: var(--vm-ink-soft); }
.hint { font-size: .82rem; color: var(--vm-ink-faint); }
.email-field { display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 320px; text-align: left; font-size: .82rem; color: var(--vm-ink-soft); }
.email-field input { min-height: 44px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--vm-border); background: var(--vm-surface); color: var(--vm-ink); font-size: 1rem; }
.email-field input:focus-visible { outline: 2px solid var(--vm-primary); outline-offset: 1px; }
.badge { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; }
.badge svg { width: 28px; height: 28px; }
.badge.ok { color: #10b981; background: rgba(16,185,129,.12); }
.badge.err { color: #ef4444; background: rgba(239,68,68,.1); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 22px; border-radius: 11px; border: none; font-weight: 600; color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-p); text-decoration: none; cursor: pointer; }
.btn.ghost { color: var(--vm-ink); background: var(--vm-surface); border: 1px solid var(--vm-border); box-shadow: none; }
.link { font-size: .875rem; color: var(--vm-primary); text-decoration: none; font-weight: 600; }
.spin { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
.spin.big { width: 36px; height: 36px; border-width: 3px; border-color: var(--vm-primary-soft); border-top-color: var(--vm-primary); }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
