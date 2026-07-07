<template>
  <div class="aadml-public login-page">
    <!-- Decorative rings on the paper backdrop -->
    <div class="bg-effects" aria-hidden="true">
      <span class="ring r1"></span><span class="ring r2"></span>
    </div>

    <div class="login-container">
      <!-- ── Left: editorial branding ─────────────────────────────────── -->
      <div class="branding-section">
        <router-link to="/" class="brand">
          <AadmlMark :size="34" />AADML
        </router-link>

        <div class="eyebrow">The operating layer for intelligent systems</div>
        <h1 class="branding-title">Build agents that <em>finish the work.</em></h1>
        <p class="branding-subtitle">
          Governed access to tools, data, workspaces, signals, and people—so autonomy
          stays accountable across software, science, and public institutions.
        </p>

        <div class="feature-list">
          <div v-for="f in perks" :key="f.title" class="feature-item">
            <span class="feature-mark" :style="{ '--tone': f.tone }">{{ f.mark }}</span>
            <div>
              <b>{{ f.title }}</b>
              <span>{{ f.desc }}</span>
            </div>
          </div>
        </div>

        <div class="brand-foot">A North Rays platform · built for consequential work</div>
      </div>

      <!-- ── Right: form ──────────────────────────────────────────────── -->
      <div class="form-section">
        <div class="form-card">
          <router-link to="/" class="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to home
          </router-link>

          <!-- Mobile brand (branding column hidden on small screens) -->
          <router-link to="/" class="brand brand-mobile"><AadmlMark :size="30" />AADML</router-link>

          <div class="form-header">
            <h2 class="form-title">{{ isLogin ? 'Welcome back' : 'Create account' }}</h2>
            <p class="form-subtitle">
              {{ isLogin ? 'Enter your credentials to access your account' : 'Start building governed agents with AADML' }}
            </p>
          </div>

          <!-- Error -->
          <Transition name="message">
            <div v-if="error" class="message message-error">
              <svg class="message-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <span>{{ error }}</span>
              <button @click="error = null" class="message-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </Transition>

          <!-- Success -->
          <Transition name="message">
            <div v-if="success" class="message message-success">
              <svg class="message-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span>{{ success }}</span>
            </div>
          </Transition>

          <!-- Credentials form -->
          <form v-if="!twoFA.active" @submit.prevent="handleSubmit" class="login-form">
            <div class="form-group">
              <label class="form-label">{{ isLogin ? 'Email or Username' : 'Email Address' }}</label>
              <div class="input-wrapper" :class="{ 'input-focused': focusedField === 'username', 'input-error': validationErrors.username }">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input
                  v-model="formData.username"
                  :type="isLogin ? 'text' : 'email'"
                  required
                  :placeholder="isLogin ? 'name@example.com' : 'you@institution.org'"
                  @focus="focusedField = 'username'"
                  @blur="handleBlur('username')"
                  autocomplete="username"
                />
              </div>
              <span v-if="validationErrors.username" class="field-error">{{ validationErrors.username }}</span>
            </div>

            <div class="form-group">
              <label class="form-label">
                Password
                <router-link v-if="isLogin" to="/forgot-password" class="forgot-link">Forgot password?</router-link>
              </label>
              <div class="input-wrapper" :class="{ 'input-focused': focusedField === 'password', 'input-error': validationErrors.password }">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <input
                  v-model="formData.password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  placeholder="Enter your password"
                  @focus="focusedField = 'password'"
                  @blur="handleBlur('password')"
                  :autocomplete="isLogin ? 'current-password' : 'new-password'"
                />
                <button type="button" class="password-toggle" @click="showPassword = !showPassword">
                  <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
              </div>
              <span v-if="validationErrors.password" class="field-error">{{ validationErrors.password }}</span>

              <div v-if="!isLogin && formData.password" class="password-strength">
                <div class="strength-bar">
                  <div class="strength-fill" :class="passwordStrengthClass" :style="{ width: passwordStrength + '%' }"></div>
                </div>
                <span class="strength-text" :class="passwordStrengthClass">{{ passwordStrengthText }}</span>
              </div>
            </div>

            <div v-if="isLogin" class="form-options">
              <label class="checkbox-label">
                <input type="checkbox" v-model="rememberMe" />
                <span class="checkbox-custom"></span>
                <span>Remember me for 30 days</span>
              </label>
            </div>

            <button type="submit" class="btn submit-btn" :disabled="loading || !isFormValid">
              <span v-if="loading" class="btn-loader"></span>
              <template v-else>
                {{ isLogin ? 'Sign in' : 'Create account' }}
                <span>→</span>
              </template>
            </button>
          </form>

          <!-- 2FA -->
          <form v-if="twoFA.active" @submit.prevent="verify2fa" class="login-form">
            <div class="form-group">
              <label class="form-label">Authentication code</label>
              <div class="input-wrapper" :class="{ 'input-focused': focusedField === 'code' }">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <input
                  v-model="twoFA.code"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="14"
                  placeholder="6-digit code or recovery code"
                  @focus="focusedField = 'code'"
                  @blur="focusedField = null"
                />
              </div>
              <span class="field-hint">Open your authenticator app, or enter a recovery code.</span>
            </div>
            <button type="submit" class="btn submit-btn" :disabled="loading || !twoFA.code">
              <span v-if="loading" class="btn-loader"></span>
              <span v-else>Verify &amp; sign in</span>
            </button>
            <button type="button" class="link-btn" @click="cancel2fa">← Back to sign in</button>
          </form>

          <!-- Divider -->
          <div v-if="!twoFA.active" class="divider"><span>or continue with</span></div>

          <!-- Social -->
          <div v-if="!twoFA.active" class="social-buttons">
            <button
              type="button"
              class="social-btn"
              :disabled="!socialProviders.includes('github')"
              :title="socialProviders.includes('github') ? 'Continue with GitHub' : 'GitHub sign-in not configured'"
              @click="socialLogin('github')"
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              <span>GitHub</span>
            </button>
            <button
              type="button"
              class="social-btn"
              :disabled="!socialProviders.includes('google')"
              :title="socialProviders.includes('google') ? 'Continue with Google' : 'Google sign-in not configured'"
              @click="socialLogin('google')"
            >
              <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              <span>Google</span>
            </button>
          </div>

          <!-- Toggle -->
          <p v-if="!twoFA.active" class="toggle-text">
            {{ isLogin ? "Don't have an account?" : 'Already have an account?' }}
            <button type="button" @click="toggleMode" class="toggle-link">{{ isLogin ? 'Sign up' : 'Sign in' }}</button>
          </p>

          <!-- Terms -->
          <p v-if="!isLogin && !twoFA.active" class="terms-text">
            By creating an account, you agree to our
            <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../services/api'
import AadmlMark from '../components/common/AadmlMark.vue'
// Pull in the AADML paper theme (scoped under .aadml-public — same as public pages).
import '../styles/aadml-public.css'

const router = useRouter()
const route = useRoute()

// State
const isLogin = ref(route.path !== '/signup' && route.query.mode !== 'signup')
const loading = ref(false)
const error = ref(null)
const success = ref(null)
const showPassword = ref(false)
const focusedField = ref(null)
const rememberMe = ref(false)
const validationErrors = ref({})
// Two-factor challenge: populated when login returns requires_2fa.
const twoFA = ref({ active: false, token: '', code: '' })
// Social providers that are actually configured on the backend (buttons enable only for these).
const socialProviders = ref([])

const formData = ref({
  username: '',
  password: ''
})

// Editorial perks shown in the left column.
const perks = [
  { mark: '⌁', tone: 'var(--blue-2)', title: '150+ built-in tools', desc: 'Plus any MCP server, REST/GraphQL API, or database you connect.' },
  { mark: '⚖', tone: 'var(--green-2)', title: 'Governed by default', desc: 'Budgets, approval gates, and immutable audit trails.' },
  { mark: '↯', tone: 'var(--amber-2)', title: 'Event-driven execution', desc: 'Signals, schedules, and webhooks wake the work.' },
]

// Computed
const passwordStrength = computed(() => {
  const password = formData.value.password
  if (!password) return 0

  let strength = 0
  if (password.length >= 8) strength += 25
  if (password.length >= 12) strength += 15
  if (/[a-z]/.test(password)) strength += 15
  if (/[A-Z]/.test(password)) strength += 15
  if (/[0-9]/.test(password)) strength += 15
  if (/[^a-zA-Z0-9]/.test(password)) strength += 15

  return Math.min(strength, 100)
})

const passwordStrengthClass = computed(() => {
  const strength = passwordStrength.value
  if (strength < 30) return 'weak'
  if (strength < 60) return 'medium'
  if (strength < 80) return 'good'
  return 'strong'
})

const passwordStrengthText = computed(() => {
  const strength = passwordStrength.value
  if (strength < 30) return 'Weak'
  if (strength < 60) return 'Medium'
  if (strength < 80) return 'Good'
  return 'Strong'
})

const isFormValid = computed(() => {
  const { username, password } = formData.value

  if (!username || !password) return false
  if (!isLogin.value && password.length < 8) return false
  if (Object.keys(validationErrors.value).length > 0) return false

  return true
})

// Methods
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

const handleBlur = (field) => {
  focusedField.value = null

  // Validate on blur
  if (field === 'username' && !isLogin.value) {
    if (!validateEmail(formData.value.username)) {
      validationErrors.value.username = 'Please enter a valid email address'
    } else {
      delete validationErrors.value.username
    }
  }

  if (field === 'password' && !isLogin.value) {
    if (formData.value.password.length < 8) {
      validationErrors.value.password = 'Password must be at least 8 characters'
    } else {
      delete validationErrors.value.password
    }
  }
}

const toggleMode = () => {
  isLogin.value = !isLogin.value
  error.value = null
  success.value = null
  validationErrors.value = {}
  formData.value = { username: '', password: '' }
  showPassword.value = false
}

const handleSubmit = async () => {
  // Clear previous messages
  error.value = null
  success.value = null
  validationErrors.value = {}

  // Validate before submit
  if (!isLogin.value) {
    if (!validateEmail(formData.value.username)) {
      validationErrors.value.username = 'Please enter a valid email address'
      return
    }
    if (formData.value.password.length < 8) {
      validationErrors.value.password = 'Password must be at least 8 characters'
      return
    }
  }

  try {
    loading.value = true

    const data = {
      username: formData.value.username,
      password: formData.value.password,
      email: formData.value.username
    }

    if (isLogin.value) {
      // Login
      const response = await api.login(data)

      // 2FA gate — switch to the code-entry step instead of completing login.
      if (response.data.requires_2fa) {
        twoFA.value = { active: true, token: response.data.ephemeral_token, code: '' }
        loading.value = false
        return
      }

      if (response.data.success) {
        success.value = 'Login successful! Redirecting...'
        localStorage.setItem('user', JSON.stringify(response.data.user))

        setTimeout(() => {
          router.push(route.query.next || '/dashboard')
        }, 800)
      }
    } else {
      // Register
      const response = await api.register(data)

      if (response.data.success) {
        success.value = 'Account created successfully! Redirecting...'
        localStorage.setItem('user', JSON.stringify(response.data.user))

        setTimeout(() => {
          router.push(route.query.next || '/dashboard')
        }, 800)
      }
    }
  } catch (err) {
    console.error('Auth error:', err)
    error.value = err.response?.data?.error || 'An error occurred. Please try again.'
  } finally {
    loading.value = false
  }
}

const verify2fa = async () => {
  error.value = null
  try {
    loading.value = true
    const response = await api.twofaVerify(twoFA.value.token, twoFA.value.code)
    if (response.data.success) {
      success.value = 'Login successful! Redirecting...'
      localStorage.setItem('user', JSON.stringify(response.data.user))
      setTimeout(() => router.push(route.query.next || '/dashboard'), 600)
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Invalid code. Please try again.'
  } finally {
    loading.value = false
  }
}

const cancel2fa = () => {
  twoFA.value = { active: false, token: '', code: '' }
  error.value = null
}

// Full-page redirect into the backend's OAuth flow (proxied via /api in dev).
const socialLogin = (provider) => {
  if (!socialProviders.value.includes(provider)) return
  window.location.href = `/api/auth/social/${provider}/start`
}

const SOCIAL_ERRORS = {
  not_configured: 'That sign-in method isn’t configured yet.',
  no_email: 'We couldn’t read a verified email from that account.',
  exchange_failed: 'Sign-in failed. Please try again.',
  bad_state: 'Your sign-in session expired. Please try again.',
  missing_code: 'Sign-in was cancelled.',
  account_disabled: 'This account is disabled.',
}

onMounted(async () => {
  // Surface any social-login error passed back as ?social_error=...
  const se = route.query.social_error
  if (se) error.value = SOCIAL_ERRORS[se] || 'Social sign-in failed. Please try again.'
  // Discover which provider buttons to enable.
  try {
    const { data } = await api.get('/auth/social/providers')
    socialProviders.value = data.providers || []
  } catch (e) {
    socialProviders.value = []
  }
})

// Clear validation errors when typing
watch(() => formData.value.username, () => {
  if (validationErrors.value.username) {
    delete validationErrors.value.username
  }
})

watch(() => formData.value.password, () => {
  if (validationErrors.value.password) {
    delete validationErrors.value.password
  }
})
</script>

<style scoped>
/* AADML paper-theme auth page. Tokens (--paper/--ink/…) come from the
   .aadml-public root class + imported aadml-public.css. */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--sans);
}

.bg-effects { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.ring { position: absolute; border-radius: 50%; }
.r1 { width: 640px; height: 640px; border: 1px solid rgba(28, 84, 217, 0.14); right: -260px; top: -280px; }
.r2 { width: 420px; height: 420px; border: 1px dashed rgba(216, 77, 55, 0.18); left: -180px; bottom: -200px; }

.login-container {
  width: 100%;
  max-width: 1120px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
  position: relative;
  z-index: 1;
}

/* ── Left branding ── */
.branding-section { display: none; }
@media (min-width: 1024px) { .branding-section { display: block; padding-right: 30px; } }

.brand { display: inline-flex; align-items: center; gap: 12px; font-size: 22px; font-weight: 900; letter-spacing: -.04em; color: var(--ink); text-decoration: none; margin-bottom: 40px; }
.brand-mark { width: 34px; height: 34px; border: 1.8px solid var(--ink); border-radius: 50%; position: relative; display: grid; place-items: center; }
.brand-mark::before, .brand-mark::after { content: ""; position: absolute; background: var(--ink); width: 16px; height: 1.5px; }
.brand-mark::before { transform: rotate(45deg); }
.brand-mark::after { transform: rotate(-45deg); }
.brand-mark i { width: 7px; height: 7px; border-radius: 50%; background: var(--red); display: block; }

.branding-title { font-family: var(--serif); font-weight: 500; font-size: clamp(42px, 4.6vw, 66px); line-height: .95; letter-spacing: -.05em; margin: 18px 0 22px; max-width: 12ch; }
.branding-title em { font-style: normal; color: var(--blue); }
.branding-subtitle { font-size: 17px; line-height: 1.7; color: var(--muted); max-width: 46ch; margin: 0 0 34px; }

.feature-list { display: flex; flex-direction: column; gap: 16px; }
.feature-item { display: flex; align-items: center; gap: 14px; }
.feature-mark { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 12px; background: var(--tone, var(--blue-2)); display: grid; place-items: center; font-size: 18px; color: var(--ink); }
.feature-item b { display: block; font-size: 14px; color: var(--ink); }
.feature-item span { font-size: 12.5px; color: var(--muted); }

.brand-foot { margin-top: 40px; font: 700 10px var(--mono); letter-spacing: .11em; text-transform: uppercase; color: var(--muted); }

/* ── Right form card ── */
.form-section { display: flex; justify-content: center; }
.form-card {
  width: 100%;
  max-width: 440px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  border-radius: 28px;
  padding: 38px;
  box-shadow: var(--shadow);
  position: relative;
}
.back-link { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); text-decoration: none; font-size: .85rem; font-weight: 650; margin-bottom: 22px; transition: color .15s; }
.back-link:hover { color: var(--ink); }
.back-link svg { width: 16px; height: 16px; }

.brand-mobile { margin-bottom: 20px; font-size: 18px; }
@media (min-width: 1024px) { .brand-mobile { display: none; } }

.form-header { margin-bottom: 26px; }
.form-title { font-family: var(--serif); font-weight: 500; font-size: 2rem; letter-spacing: -.03em; color: var(--ink); margin: 0; line-height: 1.05; }
.form-subtitle { margin-top: 8px; font-size: .92rem; color: var(--muted); }

/* Messages */
.message { display: flex; align-items: center; gap: 12px; padding: 13px 15px; border-radius: 14px; margin-bottom: 20px; font-size: .875rem; }
.message-error { background: var(--red-2); border: 1px solid #ecc9c2; color: var(--red); }
.message-success { background: var(--green-2); border: 1px solid #bfe0cd; color: var(--green); }
.message-icon { width: 20px; height: 20px; flex-shrink: 0; }
.message-close { margin-left: auto; padding: 4px; background: transparent; border: none; color: inherit; opacity: .7; cursor: pointer; }
.message-close:hover { opacity: 1; }
.message-close svg { width: 16px; height: 16px; }

/* Form */
.login-form { display: flex; flex-direction: column; gap: 18px; }
.form-group { display: flex; flex-direction: column; gap: 8px; }
.form-label { display: flex; justify-content: space-between; align-items: center; font: 800 10px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.forgot-link { font-size: 11px; font-weight: 700; color: var(--blue); text-decoration: none; text-transform: none; letter-spacing: normal; }
.forgot-link:hover { text-decoration: underline; }

.input-wrapper { position: relative; display: flex; align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 12px; transition: border-color .15s, box-shadow .15s; }
.input-wrapper.input-focused { border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-2); }
.input-wrapper.input-error { border-color: var(--red); }
.input-icon { position: absolute; left: 14px; width: 19px; height: 19px; color: var(--muted); pointer-events: none; transition: color .15s; }
.input-focused .input-icon { color: var(--blue); }
.input-wrapper input { width: 100%; padding: 13px 14px 13px 44px; font-size: .9375rem; font-family: var(--sans); color: var(--ink); background: transparent; border: none; outline: none; }
.input-wrapper input::placeholder { color: #9aa8a0; }
.password-toggle { position: absolute; right: 12px; padding: 6px; background: transparent; border: none; color: var(--muted); cursor: pointer; }
.password-toggle:hover { color: var(--ink); }
.password-toggle svg { width: 19px; height: 19px; }

.field-error { font-size: .8125rem; color: var(--red); }
.field-hint { font-size: .8125rem; color: var(--muted); }
.link-btn { align-self: center; margin-top: 4px; background: none; border: none; color: var(--muted); font-size: .8125rem; font-weight: 650; cursor: pointer; }
.link-btn:hover { color: var(--blue); }

/* Password strength */
.password-strength { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.strength-bar { flex: 1; height: 4px; background: var(--line); border-radius: 2px; overflow: hidden; }
.strength-fill { height: 100%; transition: width .3s ease, background .3s ease; }
.strength-fill.weak { background: var(--red); }
.strength-fill.medium { background: var(--amber); }
.strength-fill.good { background: var(--blue); }
.strength-fill.strong { background: var(--green); }
.strength-text { font-size: .72rem; font-weight: 700; min-width: 50px; }
.strength-text.weak { color: var(--red); }
.strength-text.medium { color: var(--amber); }
.strength-text.good { color: var(--blue); }
.strength-text.strong { color: var(--green); }

/* Checkbox */
.form-options { margin-top: 2px; }
.checkbox-label { display: flex; align-items: center; gap: 10px; font-size: .85rem; color: var(--muted); cursor: pointer; }
.checkbox-label input { display: none; }
.checkbox-custom { width: 18px; height: 18px; border: 1px solid var(--line); border-radius: 5px; background: #fff; position: relative; transition: all .15s; }
.checkbox-label input:checked + .checkbox-custom { background: var(--ink); border-color: var(--ink); }
.checkbox-label input:checked + .checkbox-custom::after { content: ''; position: absolute; left: 5px; top: 2px; width: 5px; height: 9px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }

/* Submit — reuses .btn from the theme; full width + loader */
.submit-btn { width: 100%; justify-content: center; padding: 13px 24px; margin-top: 6px; font-size: .95rem; }
.submit-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-loader { width: 19px; height: 19px; border: 2px solid rgba(255, 255, 255, .35); border-top-color: #fff; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Divider */
.divider { display: flex; align-items: center; gap: 16px; margin: 26px 0; color: var(--muted); font: 700 10px var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--line); }

/* Social */
.social-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.social-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; font-size: .875rem; font-weight: 700; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 12px; cursor: pointer; transition: border-color .15s, transform .15s; }
.social-btn:hover:not(:disabled) { border-color: var(--ink); transform: translateY(-1px); }
.social-btn:disabled { opacity: .5; cursor: not-allowed; }
.social-btn svg { width: 20px; height: 20px; }

/* Toggle + terms */
.toggle-text { text-align: center; margin-top: 24px; font-size: .875rem; color: var(--muted); }
.toggle-link { background: none; border: none; color: var(--blue); font-weight: 800; cursor: pointer; }
.toggle-link:hover { text-decoration: underline; }
.terms-text { text-align: center; margin-top: 18px; font-size: .8125rem; color: var(--muted); line-height: 1.5; }
.terms-text a { color: var(--ink); text-decoration: none; font-weight: 650; }
.terms-text a:hover { color: var(--blue); }

/* Transitions */
.message-enter-active, .message-leave-active { transition: all .3s ease; }
.message-enter-from, .message-leave-to { opacity: 0; transform: translateY(-10px); }

/* Responsive */
@media (max-width: 1023px) {
  .login-container { grid-template-columns: 1fr; max-width: 460px; }
  .form-card { padding: 32px 26px; }
}
@media (max-width: 480px) {
  .login-page { padding: 16px; }
  .form-card { padding: 28px 20px; border-radius: 22px; }
  .form-title { font-size: 1.7rem; }
  .social-buttons { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .btn-loader { animation-duration: 1.6s; } }
</style>
