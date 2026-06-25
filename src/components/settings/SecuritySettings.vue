<template>
  <div class="panel">
    <!-- Session -->
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

    <!-- Email verification -->
    <div class="card">
      <h3 class="card-title">Email</h3>
      <p class="card-sub">{{ currentUser?.email || currentUser?.username }}</p>
      <div class="row">
        <div>
          <div class="row-label">Verification</div>
          <div class="row-hint">Confirm your email to secure account recovery.</div>
        </div>
        <span v-if="currentUser?.email_verified" class="chip ok">Verified</span>
        <button v-else class="btn-soft" :disabled="busy.resend" @click="resendVerification">
          {{ busy.resend ? 'Sending…' : 'Resend verification' }}
        </button>
      </div>
    </div>

    <!-- Change password -->
    <div class="card">
      <h3 class="card-title">Password</h3>
      <p class="card-sub">Use a strong, unique password. Changing it keeps this session active.</p>
      <form class="form" @submit.prevent="changePassword">
        <input v-model="pw.current" type="password" placeholder="Current password" class="inp" autocomplete="current-password" />
        <input v-model="pw.next" type="password" placeholder="New password (min 8 chars)" class="inp" autocomplete="new-password" />
        <input v-model="pw.confirm" type="password" placeholder="Confirm new password" class="inp" autocomplete="new-password" />
        <button type="submit" class="btn-primary" :disabled="busy.pw || !pwValid">
          {{ busy.pw ? 'Updating…' : 'Update password' }}
        </button>
      </form>
    </div>

    <!-- Two-factor -->
    <div class="card">
      <h3 class="card-title">Two-factor authentication</h3>
      <p class="card-sub">Add a second step at sign-in with an authenticator app (TOTP).</p>

      <!-- Enabled -->
      <div v-if="twofa.enabled && twofa.step === 'idle'" class="row">
        <div>
          <div class="row-label"><span class="chip ok">Enabled</span></div>
          <div class="row-hint">{{ twofa.recoveryRemaining }} recovery code(s) remaining.</div>
        </div>
        <button class="btn-danger" @click="twofa.step = 'disable'">Disable</button>
      </div>

      <!-- Disable: confirm with password -->
      <div v-else-if="twofa.step === 'disable'" class="setup">
        <p class="setup-step">Enter your password to turn off two-factor authentication.</p>
        <div class="confirm-row">
          <input v-model="twofa.disablePassword" type="password" placeholder="Password" class="inp" autocomplete="current-password" />
          <button class="btn-danger" :disabled="busy.twofa || !twofa.disablePassword" @click="disable2fa">Disable 2FA</button>
          <button class="btn-soft sm" @click="cancelDisable">Cancel</button>
        </div>
      </div>

      <!-- Disabled / not started -->
      <div v-else-if="twofa.step === 'idle'" class="row">
        <div>
          <div class="row-label"><span class="chip muted">Disabled</span></div>
          <div class="row-hint">Protect your account with an authenticator app.</div>
        </div>
        <button class="btn-primary" :disabled="busy.twofa" @click="startSetup">
          {{ busy.twofa ? 'Starting…' : 'Enable 2FA' }}
        </button>
      </div>

      <!-- Setup: show secret + confirm code -->
      <div v-else-if="twofa.step === 'setup'" class="setup">
        <p class="setup-step">1. Add this secret to your authenticator app (Google Authenticator, 1Password, etc.):</p>
        <div class="secret-box">
          <code>{{ twofa.secret }}</code>
          <button class="btn-soft sm" @click="copy(twofa.secret)">Copy</button>
        </div>
        <a class="otp-link" :href="twofa.uri">Open in authenticator app</a>
        <p class="setup-step">2. Enter the 6-digit code it shows:</p>
        <div class="confirm-row">
          <input v-model="twofa.code" inputmode="numeric" maxlength="6" placeholder="123456" class="inp code-inp" />
          <button class="btn-primary" :disabled="busy.twofa || twofa.code.length < 6" @click="confirmSetup">
            {{ busy.twofa ? 'Verifying…' : 'Verify & enable' }}
          </button>
        </div>
        <button class="btn-soft sm" @click="cancelSetup">Cancel</button>
      </div>

      <!-- Recovery codes (shown once) -->
      <div v-else-if="twofa.step === 'recovery'" class="setup">
        <p class="setup-step"><strong>Save your recovery codes.</strong> Each works once if you lose your device — they won't be shown again.</p>
        <div class="codes">
          <code v-for="c in twofa.recoveryCodes" :key="c">{{ c }}</code>
        </div>
        <div class="confirm-row">
          <button class="btn-soft sm" @click="copy(twofa.recoveryCodes.join('\n'))">Copy all</button>
          <button class="btn-primary" @click="finishSetup">Done</button>
        </div>
      </div>
    </div>

    <!-- Connected accounts -->
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
import { inject, ref, reactive, computed, onMounted } from 'vue'
import api from '../../services/api'
import { notify } from '../../composables/useNotify'

const currentUser = inject('currentUser', ref(null))
const logout = inject('logout', () => {})

const busy = reactive({ pw: false, twofa: false, resend: false })
const pw = reactive({ current: '', next: '', confirm: '' })
const twofa = reactive({ enabled: false, recoveryRemaining: 0, step: 'idle', secret: '', uri: '', code: '', recoveryCodes: [], disablePassword: '' })

const pwValid = computed(() => pw.current && pw.next.length >= 8 && pw.next === pw.confirm)

onMounted(refreshTwofa)

async function refreshTwofa() {
  try {
    const { data } = await api.twofaStatus()
    twofa.enabled = data.enabled
    twofa.recoveryRemaining = data.recovery_codes_remaining || 0
  } catch (e) { /* non-fatal */ }
}

async function refreshUser() {
  try {
    const { data } = await api.getCurrentUser()
    if (data.user) currentUser.value = data.user
  } catch (e) { /* non-fatal */ }
}

async function changePassword() {
  if (!pwValid.value) { notify.error('Passwords must match and be at least 8 characters'); return }
  busy.pw = true
  try {
    await api.changePassword(pw.current, pw.next)
    notify.success('Password updated')
    pw.current = pw.next = pw.confirm = ''
  } catch (e) {
    notify.error(e.response?.data?.error || 'Could not update password')
  } finally { busy.pw = false }
}

async function resendVerification() {
  busy.resend = true
  try {
    await api.resendVerification()
    notify.success('Verification email sent')
  } catch (e) {
    notify.error(e.response?.data?.error || 'Could not send email')
  } finally { busy.resend = false }
}

async function startSetup() {
  busy.twofa = true
  try {
    const { data } = await api.twofaSetup()
    twofa.secret = data.secret
    twofa.uri = data.otpauth_uri
    twofa.code = ''
    twofa.step = 'setup'
  } catch (e) {
    notify.error(e.response?.data?.error || 'Could not start 2FA setup')
  } finally { busy.twofa = false }
}

async function confirmSetup() {
  busy.twofa = true
  try {
    const { data } = await api.twofaConfirm(twofa.code)
    twofa.recoveryCodes = data.recovery_codes || []
    twofa.step = 'recovery'
    twofa.enabled = true
    await refreshUser()
  } catch (e) {
    notify.error(e.response?.data?.error || 'Invalid code')
  } finally { busy.twofa = false }
}

function cancelSetup() { twofa.step = 'idle'; twofa.secret = ''; twofa.code = '' }

function finishSetup() {
  twofa.step = 'idle'
  twofa.secret = ''
  twofa.code = ''
  twofa.recoveryCodes = []
  notify.success('Two-factor authentication enabled')
  refreshTwofa()
}

function cancelDisable() { twofa.step = 'idle'; twofa.disablePassword = '' }

async function disable2fa() {
  if (!twofa.disablePassword) return
  busy.twofa = true
  try {
    await api.twofaDisable(twofa.disablePassword)
    twofa.enabled = false
    twofa.step = 'idle'
    twofa.disablePassword = ''
    notify.success('2FA disabled')
    await refreshUser()
    await refreshTwofa()
  } catch (e) {
    notify.error(e.response?.data?.error || 'Could not disable 2FA')
  } finally { busy.twofa = false }
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); notify.success('Copied') }
  catch (e) { notify.error('Copy failed') }
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
.form { display: flex; flex-direction: column; gap: 10px; max-width: 360px; }
.inp { padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 9px; font-size: 0.875rem; color: #0f172a; outline: none; }
.inp:focus { border-color: #2563EB; box-shadow: 0 0 0 3px #EFF6FF; }
.code-inp { letter-spacing: 4px; font-family: monospace; text-align: center; max-width: 140px; }
.btn-primary { padding: 9px 16px; font-size: 0.8125rem; font-weight: 600; color: #fff; background: #2563EB; border: none; border-radius: 9px; cursor: pointer; width: fit-content; }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-soft { padding: 8px 14px; font-size: 0.8125rem; font-weight: 600; color: #2563EB; background: #EFF6FF; border: 1px solid #dbeafe; border-radius: 9px; cursor: pointer; }
.btn-soft.sm { padding: 6px 10px; font-size: 0.75rem; }
.btn-danger { padding: 8px 16px; font-size: 0.8125rem; font-weight: 600; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 9px; cursor: pointer; }
.btn-danger:hover { background: #fee2e2; }
.chip { padding: 4px 11px; font-size: 0.75rem; font-weight: 500; border-radius: 999px; }
.chip.ok { color: #16a34a; background: #f0fdf4; }
.chip.muted { color: #94a3b8; background: #f1f5f9; }
.setup { display: flex; flex-direction: column; gap: 10px; }
.setup-step { font-size: 0.85rem; color: #334155; margin: 4px 0; }
.secret-box { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; }
.secret-box code { font-family: monospace; font-size: 0.9rem; letter-spacing: 1px; color: #0f172a; word-break: break-all; }
.otp-link { font-size: 0.8rem; font-weight: 600; color: #2563EB; text-decoration: none; }
.confirm-row { display: flex; align-items: center; gap: 10px; }
.codes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; }
.codes code { font-family: monospace; font-size: 0.85rem; color: #0f172a; }
</style>
