<template>
  <div class="login-page">
    <!-- Background Effects -->
    <div class="bg-effects">
      <div class="bg-orb bg-orb-1"></div>
      <div class="bg-orb bg-orb-2"></div>
      <div class="bg-grid"></div>
    </div>

    <div class="login-container">
      <!-- Left Side - Branding -->
      <div class="branding-section">
        <div class="branding-content">
          <!-- Logo -->
          <router-link to="/" class="logo-link">
            <div class="logo-icon">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#login-gradient)" stroke-width="2.5"/>
                <path d="M10 16L14 20L22 12" stroke="url(#login-gradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="16" cy="8" r="2" fill="url(#login-gradient)"/>
                <circle cx="8" cy="16" r="2" fill="url(#login-gradient)"/>
                <circle cx="24" cy="16" r="2" fill="url(#login-gradient)"/>
                <circle cx="16" cy="24" r="2" fill="url(#login-gradient)"/>
                <defs>
                  <linearGradient id="login-gradient" x1="0" y1="0" x2="32" y2="32">
                    <stop stop-color="#6366f1"/>
                    <stop offset="0.5" stop-color="#8b5cf6"/>
                    <stop offset="1" stop-color="#d946ef"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div class="logo-text">
              <span class="logo-main">Agentic</span>
              <span class="logo-sub">System</span>
            </div>
          </router-link>

          <!-- Tagline -->
          <h1 class="branding-title">
            Build Faster with
            <span class="gradient-text">AI-Powered</span>
            Code Generation
          </h1>

          <p class="branding-subtitle">
            Transform your development workflow with intelligent agents that understand your codebase and accelerate delivery.
          </p>

          <!-- Features List -->
          <div class="features-list">
            <div class="feature-item">
              <div class="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <span>10x Faster Development</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <span>Enterprise Security</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                </svg>
              </div>
              <span>50+ Built-in Tools</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Side - Form -->
      <div class="form-section">
        <div class="form-card">
          <!-- Back Link -->
          <router-link to="/" class="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Home
          </router-link>

          <!-- Form Header -->
          <div class="form-header">
            <h2 class="form-title">{{ isLogin ? 'Welcome back' : 'Create account' }}</h2>
            <p class="form-subtitle">
              {{ isLogin ? 'Enter your credentials to access your account' : 'Start your journey with Agentic System' }}
            </p>
          </div>

          <!-- Error Message -->
          <Transition name="message">
            <div v-if="error" class="message message-error">
              <svg class="message-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span>{{ error }}</span>
              <button @click="error = null" class="message-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </Transition>

          <!-- Success Message -->
          <Transition name="message">
            <div v-if="success" class="message message-success">
              <svg class="message-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>{{ success }}</span>
            </div>
          </Transition>

          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="login-form">
            <!-- Email/Username Field -->
            <div class="form-group">
              <label class="form-label">
                {{ isLogin ? 'Email or Username' : 'Email Address' }}
              </label>
              <div class="input-wrapper" :class="{ 'input-focused': focusedField === 'username', 'input-error': validationErrors.username }">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  v-model="formData.username"
                  :type="isLogin ? 'text' : 'email'"
                  required
                  :placeholder="isLogin ? 'name@example.com' : 'Enter your email'"
                  @focus="focusedField = 'username'"
                  @blur="handleBlur('username')"
                  autocomplete="username"
                />
              </div>
              <span v-if="validationErrors.username" class="field-error">{{ validationErrors.username }}</span>
            </div>

            <!-- Password Field -->
            <div class="form-group">
              <label class="form-label">
                Password
                <span v-if="isLogin" class="forgot-link">Forgot password?</span>
              </label>
              <div class="input-wrapper" :class="{ 'input-focused': focusedField === 'password', 'input-error': validationErrors.password }">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
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
                  <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
              <span v-if="validationErrors.password" class="field-error">{{ validationErrors.password }}</span>

              <!-- Password Strength (only for registration) -->
              <div v-if="!isLogin && formData.password" class="password-strength">
                <div class="strength-bar">
                  <div class="strength-fill" :class="passwordStrengthClass" :style="{ width: passwordStrength + '%' }"></div>
                </div>
                <span class="strength-text" :class="passwordStrengthClass">{{ passwordStrengthText }}</span>
              </div>
            </div>

            <!-- Remember Me (Login only) -->
            <div v-if="isLogin" class="form-options">
              <label class="checkbox-label">
                <input type="checkbox" v-model="rememberMe" />
                <span class="checkbox-custom"></span>
                <span>Remember me for 30 days</span>
              </label>
            </div>

            <!-- Submit Button -->
            <button type="submit" class="submit-btn" :disabled="loading || !isFormValid">
              <span v-if="loading" class="btn-loader"></span>
              <span v-else>{{ isLogin ? 'Sign In' : 'Create Account' }}</span>
              <svg v-if="!loading" class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </form>

          <!-- Divider -->
          <div class="divider">
            <span>or continue with</span>
          </div>

          <!-- Social Login -->
          <div class="social-buttons">
            <button type="button" class="social-btn" disabled title="Coming soon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>GitHub</span>
            </button>
            <button type="button" class="social-btn" disabled title="Coming soon">
              <svg viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Google</span>
            </button>
          </div>

          <!-- Toggle Mode -->
          <p class="toggle-text">
            {{ isLogin ? "Don't have an account?" : 'Already have an account?' }}
            <button type="button" @click="toggleMode" class="toggle-link">
              {{ isLogin ? 'Sign up' : 'Sign in' }}
            </button>
          </p>

          <!-- Terms -->
          <p v-if="!isLogin" class="terms-text">
            By creating an account, you agree to our
            <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()

// State
const isLogin = ref(true)
const loading = ref(false)
const error = ref(null)
const success = ref(null)
const showPassword = ref(false)
const focusedField = ref(null)
const rememberMe = ref(false)
const validationErrors = ref({})

const formData = ref({
  username: '',
  password: ''
})

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

      if (response.data.success) {
        success.value = 'Login successful! Redirecting...'
        localStorage.setItem('user', JSON.stringify(response.data.user))

        setTimeout(() => {
          router.push('/dashboard')
        }, 800)
      }
    } else {
      // Register
      const response = await api.register(data)

      if (response.data.success) {
        success.value = 'Account created successfully! Redirecting...'
        localStorage.setItem('user', JSON.stringify(response.data.user))

        setTimeout(() => {
          router.push('/dashboard')
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
/* ===== Variables ===== */
.login-page {
  /* Using global theme variables from style.css */
  --radius: 12px;
  --transition: 200ms ease;
}

/* ===== Page Layout ===== */
.login-page {
  min-height: 100vh;
  background: var(--bg-body);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

/* Background Effects */
.bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
}

.bg-orb-1 {
  width: 600px;
  height: 600px;
  background: rgba(139, 92, 246, 0.15);
  top: -200px;
  right: -100px;
}

.bg-orb-2 {
  width: 500px;
  height: 500px;
  background: rgba(236, 72, 153, 0.1);
  bottom: -200px;
  left: -100px;
}

.bg-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* Container */
.login-container {
  width: 100%;
  max-width: 1100px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
  position: relative;
  z-index: 1;
}

/* ===== Branding Section ===== */
.branding-section {
  display: none;
}

@media (min-width: 1024px) {
  .branding-section {
    display: block;
  }
}

.branding-content {
  padding-right: 40px;
}

.logo-link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  margin-bottom: 48px;
}

.logo-icon {
  width: 44px;
  height: 44px;
}

.logo-icon svg {
  width: 100%;
  height: 100%;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.logo-main {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo-sub {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.branding-title {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-primary);
  margin-bottom: 20px;
}

.gradient-text {
  display: block;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.branding-subtitle {
  font-size: 1.0625rem;
  line-height: 1.7;
  color: var(--text-muted);
  margin-bottom: 40px;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--text-secondary);
  font-size: 0.9375rem;
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primary-light);
  border-radius: 10px;
  color: var(--primary);
}

.feature-icon svg {
  width: 20px;
  height: 20px;
}

/* ===== Form Section ===== */
.form-section {
  display: flex;
  justify-content: center;
}

.form-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card-solid);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 40px;
  position: relative;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 24px;
  transition: color var(--transition);
}

.back-link:hover {
  color: var(--text-primary);
}

.back-link svg {
  width: 16px;
  height: 16px;
}

.form-header {
  text-align: center;
  margin-bottom: 32px;
}

.form-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.form-subtitle {
  font-size: 0.9375rem;
  color: var(--text-muted);
}

/* Messages */
.message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius);
  margin-bottom: 24px;
  font-size: 0.875rem;
}

.message-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.message-success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #6ee7b7;
}

.message-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.message-close {
  margin-left: auto;
  padding: 4px;
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  transition: opacity var(--transition);
}

.message-close:hover {
  opacity: 1;
}

.message-close svg {
  width: 16px;
  height: 16px;
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.forgot-link {
  font-size: 0.8125rem;
  color: var(--primary);
  cursor: pointer;
  transition: color var(--transition);
}

.forgot-link:hover {
  color: #a78bfa;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all var(--transition);
}

.input-wrapper.input-focused {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.input-wrapper.input-error {
  border-color: var(--danger);
}

.input-icon {
  position: absolute;
  left: 14px;
  width: 20px;
  height: 20px;
  color: var(--text-muted);
  pointer-events: none;
  transition: color var(--transition);
}

.input-focused .input-icon {
  color: var(--primary);
}

.input-wrapper input {
  width: 100%;
  padding: 14px 14px 14px 46px;
  font-size: 0.9375rem;
  color: var(--text-primary);
  background: transparent;
  border: none;
  outline: none;
}

.input-wrapper input::placeholder {
  color: var(--text-muted);
}

.password-toggle {
  position: absolute;
  right: 12px;
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--transition);
}

.password-toggle:hover {
  color: var(--text-secondary);
}

.password-toggle svg {
  width: 20px;
  height: 20px;
}

.field-error {
  font-size: 0.8125rem;
  color: var(--danger);
}

/* Password Strength */
.password-strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.strength-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  transition: width 0.3s ease, background 0.3s ease;
}

.strength-fill.weak { background: var(--danger); }
.strength-fill.medium { background: var(--warning); }
.strength-fill.good { background: var(--info); }
.strength-fill.strong { background: var(--success); }

.strength-text {
  font-size: 0.75rem;
  font-weight: 500;
  min-width: 50px;
}

.strength-text.weak { color: var(--danger); }
.strength-text.medium { color: var(--warning); }
.strength-text.good { color: var(--info); }
.strength-text.strong { color: var(--success); }

/* Checkbox */
.form-options {
  margin-top: 4px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  color: var(--text-muted);
  cursor: pointer;
}

.checkbox-label input {
  display: none;
}

.checkbox-custom {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-surface);
  position: relative;
  transition: all var(--transition);
}

.checkbox-label input:checked + .checkbox-custom {
  background: var(--primary);
  border-color: var(--primary);
}

.checkbox-label input:checked + .checkbox-custom::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* Submit Button */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 24px;
  margin-top: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-inverse);
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
  box-shadow: 0 4px 20px var(--primary-glow);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 30px var(--primary-glow);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-loader {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-arrow {
  width: 18px;
  height: 18px;
  transition: transform var(--transition);
}

.submit-btn:hover:not(:disabled) .btn-arrow {
  transform: translateX(4px);
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 28px 0;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* Social Buttons */
.social-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--transition);
}

.social-btn:hover:not(:disabled) {
  background: var(--bg-elevated);
  border-color: var(--border-strong);
}

.social-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.social-btn svg {
  width: 20px;
  height: 20px;
}

/* Toggle Text */
.toggle-text {
  text-align: center;
  margin-top: 24px;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.toggle-link {
  background: none;
  border: none;
  color: var(--primary);
  font-weight: 600;
  cursor: pointer;
  transition: color var(--transition);
}

.toggle-link:hover {
  color: var(--primary-light);
}

/* Terms */
.terms-text {
  text-align: center;
  margin-top: 20px;
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.terms-text a {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition);
}

.terms-text a:hover {
  color: var(--primary);
}

/* ===== Transitions ===== */
.message-enter-active,
.message-leave-active {
  transition: all 0.3s ease;
}

.message-enter-from,
.message-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ===== Responsive ===== */
@media (max-width: 1023px) {
  .login-container {
    grid-template-columns: 1fr;
    max-width: 420px;
  }

  .form-card {
    padding: 32px 24px;
  }
}

@media (max-width: 480px) {
  .login-page {
    padding: 16px;
  }

  .form-card {
    padding: 28px 20px;
    border-radius: 20px;
  }

  .form-title {
    font-size: 1.5rem;
  }

  .social-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
