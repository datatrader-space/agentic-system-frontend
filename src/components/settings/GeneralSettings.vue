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
        <label>Name</label>
        <div class="name-row">
          <input v-model="name" maxlength="150" placeholder="First and last name" @keydown.enter="saveName" />
          <button class="save-btn" :disabled="saving || !name.trim() || name.trim() === (currentUser?.full_name || '')" @click="saveName">
            {{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
        <span class="field-hint">Others see your name instead of your e-mail address.</span>
        <span v-if="saved" class="field-ok">Saved.</span>
        <span v-if="nameError" class="field-err">{{ nameError }}</span>
      </div>
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

    <div class="card">
      <h3 class="card-title">Model training</h3>
      <p class="card-sub">Whether your data may be used to train AI models.</p>
      <label class="row toggle">
        <div>
          <div class="row-label">Use my data for model training</div>
          <div class="row-hint">When this is on, AADML may use your conversations and the data you send to train AI models. It is off until you turn it on, and you can turn it off at any time.</div>
        </div>
        <input type="checkbox" class="switch" :checked="trainingUse.allowed" :disabled="trainingBusy || !trainingUse.loaded" @change="setTrainingUse($event.target.checked)" />
      </label>
      <label v-for="org in trainingUse.organizations" :key="org.id" class="row toggle">
        <div>
          <div class="row-label">Allow it in {{ org.name }}</div>
          <div class="row-hint">You own this organisation. Turned off, nobody's data in it is used for training, whatever their own setting says.</div>
        </div>
        <input type="checkbox" class="switch" :checked="org.allowed" :disabled="trainingBusy" @change="setOrganizationTrainingUse(org, $event.target.checked)" />
      </label>
      <span v-if="trainingError" class="field-err">{{ trainingError }}</span>
    </div>

    <div class="card">
      <h3 class="card-title">Help &amp; onboarding</h3>
      <p class="card-sub">New here, or want a refresher? Replay the guided product tour.</p>
      <div class="row">
        <div>
          <div class="row-label">Product tour</div>
          <div class="row-hint">Walks through setup: connect an AI provider, create an agent, then chat.</div>
        </div>
        <button class="tour-btn" @click="replayTour">Replay tour</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject, ref, watch } from 'vue'
import api from '../../services/api'
import { useRouter } from 'vue-router'
import { useTheme } from '../../composables/useTheme'
import { useOnboarding } from '../../composables/useOnboarding'

const currentUser = inject('currentUser', ref(null))
const closeSettings = inject('closeSettings', () => {})

// The person's own name: shown instead of their e-mail address across AADML (2026-10-14).
const name = ref(currentUser.value?.full_name || '')
const saving = ref(false)
const saved = ref(false)
const nameError = ref('')
watch(() => currentUser.value?.full_name, (value) => { if (!saving.value) name.value = value || '' })
const saveName = async () => {
  const wanted = name.value.trim()
  if (!wanted || saving.value) return
  saving.value = true
  saved.value = false
  nameError.value = ''
  try {
    const response = await api.updateMyName(wanted)
    const user = response.data.user
    if (currentUser.value) currentUser.value = { ...currentUser.value, ...user }
    try {
      const stored = JSON.parse(localStorage.getItem('user') || 'null')
      if (stored) localStorage.setItem('user', JSON.stringify({ ...stored, ...user }))
    } catch (e) { /* the page still has the new name */ }
    name.value = user.full_name || wanted
    saved.value = true
  } catch (err) {
    nameError.value = err?.response?.data?.error || 'Your name could not be saved. Try again.'
  }
  saving.value = false
}
// setTheme applies + persists the choice; isDark drives the active highlight.
const { isDark, setTheme } = useTheme()

// "Use my data for model training" (LLM-POC 42): off until the person turns it on. An organisation's Owner also sees
// the switch for everyone in it; turned off there, it wins over a person's own setting.
const trainingUse = ref({ loaded: false, allowed: false, organizations: [] })
const trainingBusy = ref(false)
const trainingError = ref('')
const showTrainingUse = (data) => { trainingUse.value = { loaded: true, allowed: !!data.allowed, organizations: data.organizations || [] } }
api.getTrainingUse().then(({ data }) => showTrainingUse(data)).catch(() => { trainingError.value = 'Your model training setting could not be read.' })
const changeTrainingUse = async (call) => {
  trainingBusy.value = true
  trainingError.value = ''
  try {
    showTrainingUse((await call()).data)
  } catch (err) {
    trainingError.value = err?.response?.data?.error || 'The setting could not be saved. Try again.'
  }
  trainingBusy.value = false
}
const setTrainingUse = (allowed) => changeTrainingUse(() => api.setTrainingUse(allowed))
const setOrganizationTrainingUse = (org, allowed) => changeTrainingUse(() => api.setOrganizationTrainingUse(org.id, allowed))

// Replay the guided tour (resets the completed flag + relaunches). The tour overlay is
// mounted in AppShell, so it picks up immediately while staying on the dashboard.
const router = useRouter()
const onboarding = useOnboarding()
const replayTour = () => {
  closeSettings()
  onboarding.resetTour()
  router.push('/dashboard/chat/new')
}
</script>

<style scoped>
.panel { display: flex; flex-direction: column; gap: 16px; }
.card { background: var(--vm-surface, #fff); border: 1px solid var(--vm-line, #e7eaf0); border-radius: 14px; padding: 20px; }
.card-title { font-size: 1rem; font-weight: 600; color: var(--vm-ink, #0f172a); margin: 0 0 2px; }
.card-sub { font-size: 0.8125rem; color: var(--vm-ink-faint, #94a3b8); margin: 0 0 16px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.row-label { font-size: 0.875rem; font-weight: 500; color: var(--vm-ink-soft, #334155); }
.row-hint { font-size: 0.75rem; color: var(--vm-ink-faint, #94a3b8); margin-top: 2px; }
.seg { display: inline-flex; padding: 3px; background: var(--vm-surface-soft, #f1f5f9); border-radius: 9px; }
.seg-btn { padding: 6px 14px; font-size: 0.8125rem; font-weight: 500; color: var(--vm-ink-faint, #64748b); background: transparent; border: none; border-radius: 7px; cursor: pointer; transition: .15s; }
.seg-btn.active { background: var(--vm-surface, #fff); color: var(--vm-primary, #4f46e5); box-shadow: var(--vm-shadow-s, 0 1px 3px rgba(0,0,0,0.08)); }
.tour-btn {
  flex-shrink: 0; padding: 9px 16px; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  color: #fff; background: var(--vm-g-cool, linear-gradient(90deg,#0ea5e9,#7c3aed));
  border: none; border-radius: 10px; box-shadow: var(--vm-glow-v, 0 6px 16px rgba(124,58,237,.28));
  transition: transform .15s var(--vm-ease, ease);
}
.tour-btn:hover { transform: translateY(-1px); }
.field { display: flex; flex-direction: column; gap: 5px; margin-top: 12px; }
.field label { font-size: 0.8125rem; font-weight: 500; color: var(--vm-ink-soft, #475569); }
.field input { padding: 9px 12px; font-size: 0.875rem; color: var(--vm-ink, #0f172a); background: var(--vm-surface-soft, #f8fafc); border: 1px solid var(--vm-line, #e2e8f0); border-radius: 9px; }
.field input[readonly] { color: var(--vm-ink-faint, #64748b); cursor: default; }
.name-row { display: flex; gap: 8px; }
.name-row input { flex: 1; min-width: 0; }
.save-btn { padding: 9px 16px; font-size: 0.8125rem; font-weight: 600; color: #fff; background: var(--vm-primary, #4f46e5); border: none; border-radius: 9px; cursor: pointer; }
.save-btn:disabled { opacity: .5; cursor: default; }
.field-hint { font-size: 0.75rem; color: var(--vm-ink-faint, #94a3b8); }
.field-ok { font-size: 0.75rem; color: #067647; }
.field-err { font-size: 0.75rem; color: #d92d20; }
.row.toggle { cursor: pointer; gap: 16px; margin-top: 12px; }
.row.toggle .row-hint { max-width: 560px; }
.switch { width: 38px; height: 22px; flex-shrink: 0; accent-color: var(--vm-primary, #4f46e5); cursor: pointer; }
</style>
