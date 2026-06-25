<template>
  <AuthCard title="Set a new password" :subtitle="done ? '' : 'Choose a strong password for your account.'">
    <div v-if="!token" class="note err">This reset link is invalid or incomplete. Request a new one from the
      <router-link to="/forgot-password">forgot password</router-link> page.</div>

    <div v-else-if="done" class="note ok">
      Your password has been reset. <router-link to="/login">Sign in</router-link> with your new password.
    </div>

    <form v-else class="form" @submit.prevent="submit">
      <div v-if="error" class="note err">{{ error }}</div>
      <label class="lbl">New password</label>
      <div class="pw">
        <input v-model="password" :type="show ? 'text' : 'password'" required placeholder="At least 8 characters" class="inp" autocomplete="new-password" />
        <button type="button" class="toggle" @click="show = !show">{{ show ? 'Hide' : 'Show' }}</button>
      </div>
      <div v-if="password" class="strength">
        <div class="bar"><div class="fill" :class="strengthClass" :style="{ width: strength + '%' }"></div></div>
        <span class="stext" :class="strengthClass">{{ strengthText }}</span>
      </div>
      <label class="lbl">Confirm password</label>
      <input v-model="confirm" type="password" required placeholder="Re-enter password" class="inp" autocomplete="new-password" />
      <button type="submit" class="btn" :disabled="loading || !valid">
        <span v-if="loading" class="spin"></span><span v-else>Reset password</span>
      </button>
    </form>
  </AuthCard>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import AuthCard from '../components/public/AuthCard.vue'
import { useMeta } from '../composables/useMeta'
import api from '../services/api'

useMeta({ title: 'Reset password — AADML' })

const route = useRoute()
const token = ref(route.query.token || '')
const password = ref('')
const confirm = ref('')
const show = ref(false)
const loading = ref(false)
const error = ref('')
const done = ref(false)

const strength = computed(() => {
  const p = password.value; if (!p) return 0
  let s = 0
  if (p.length >= 8) s += 25
  if (p.length >= 12) s += 15
  if (/[a-z]/.test(p)) s += 15
  if (/[A-Z]/.test(p)) s += 15
  if (/[0-9]/.test(p)) s += 15
  if (/[^a-zA-Z0-9]/.test(p)) s += 15
  return Math.min(s, 100)
})
const strengthClass = computed(() => strength.value < 30 ? 'weak' : strength.value < 60 ? 'medium' : strength.value < 80 ? 'good' : 'strong')
const strengthText = computed(() => ({ weak: 'Weak', medium: 'Medium', good: 'Good', strong: 'Strong' }[strengthClass.value]))
const valid = computed(() => password.value.length >= 8 && password.value === confirm.value)

async function submit() {
  error.value = ''
  if (!valid.value) { error.value = 'Passwords must match and be at least 8 characters.'; return }
  loading.value = true
  try {
    await api.resetPassword(token.value, password.value)
    done.value = true
  } catch (e) {
    error.value = e.response?.data?.error || 'Could not reset password. The link may have expired.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.form { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.lbl { font-size: .85rem; font-weight: 500; color: var(--vm-ink-soft); }
.inp { width: 100%; padding: 12px 14px; border-radius: 11px; border: 1px solid var(--vm-border); background: var(--vm-surface); outline: none; font-size: .95rem; color: var(--vm-ink); }
.inp:focus { border-color: var(--vm-primary); box-shadow: 0 0 0 3px var(--vm-primary-soft); }
.pw { position: relative; }
.toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); border: none; background: none; font-size: .8rem; font-weight: 600; color: var(--vm-primary); cursor: pointer; }
.strength { display: flex; align-items: center; gap: 10px; }
.bar { flex: 1; height: 4px; background: var(--vm-surface-soft); border-radius: 2px; overflow: hidden; }
.fill { height: 100%; transition: width .3s, background .3s; }
.fill.weak { background: #ef4444; } .fill.medium { background: #f59e0b; } .fill.good { background: #3b82f6; } .fill.strong { background: #10b981; }
.stext { font-size: .72rem; font-weight: 600; min-width: 48px; }
.stext.weak { color: #ef4444; } .stext.medium { color: #f59e0b; } .stext.good { color: #3b82f6; } .stext.strong { color: #10b981; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; padding: 13px; border-radius: 11px; border: none; font-weight: 600; color: #fff; background: var(--vm-g-brand); box-shadow: var(--vm-glow-p); cursor: pointer; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.note { margin-top: 8px; padding: 14px; border-radius: 12px; font-size: .9rem; }
.note.ok { color: #047857; background: rgba(16,185,129,.1); border: 1px solid rgba(16,185,129,.25); }
.note.err { color: #b91c1c; background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.22); }
.note a { color: var(--vm-primary); font-weight: 600; text-decoration: none; }
.spin { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
