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
import { inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '../../composables/useTheme'
import { useOnboarding } from '../../composables/useOnboarding'

const currentUser = inject('currentUser', ref(null))
// setTheme applies + persists the choice; isDark drives the active highlight.
const { isDark, setTheme } = useTheme()

// Replay the guided tour (resets the completed flag + relaunches). The tour overlay is
// mounted in AppShell, so it picks up immediately while staying on the dashboard.
const router = useRouter()
const onboarding = useOnboarding()
const replayTour = () => {
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
</style>
