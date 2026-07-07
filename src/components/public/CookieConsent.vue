<template>
  <Transition name="cc-fade">
    <div v-if="visible" class="cc" role="dialog" aria-label="Cookie consent">
      <div class="cc-body">
        <p class="cc-text">
          We use first-party cookies to understand site traffic and improve AADML. No third-party trackers.
          <router-link to="/docs/privacy" class="cc-link">Learn more</router-link>.
        </p>
        <div class="cc-actions">
          <button class="cc-btn ghost" @click="decline">Decline</button>
          <button class="cc-btn primary" @click="accept">Accept</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref } from 'vue'
import { consentState, setConsent, trackPageview } from '../../composables/useAnalytics'

const visible = ref(consentState() === null)

function accept() {
  setConsent(true)
  visible.value = false
  // Capture the current pageview now that consent is granted.
  trackPageview()
}
function decline() {
  setConsent(false)
  visible.value = false
}
</script>

<style scoped>
/* Renders inside PublicLayout's .aadml-public root, so the paper tokens apply. */
.cc {
  position: fixed;
  left: 16px; right: 16px; bottom: 16px;
  z-index: 80;
  max-width: 580px;
  margin: 0 auto;
  border: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 20px;
  box-shadow: var(--shadow);
  padding: 16px 18px;
}
.cc-body { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.cc-text { flex: 1; min-width: 220px; font-size: .85rem; color: var(--muted); margin: 0; line-height: 1.55; }
.cc-link { color: var(--blue); text-decoration: none; font-weight: 700; }
.cc-link:hover { text-decoration: underline; }
.cc-actions { display: flex; gap: 8px; }
.cc-btn {
  padding: 10px 18px; border-radius: 999px; font-size: .85rem; font-weight: 800; cursor: pointer;
  border: 1px solid var(--line); background: #fff; color: var(--ink); transition: transform .18s ease, box-shadow .18s ease, border-color .15s;
}
.cc-btn.ghost:hover { border-color: var(--ink); transform: translateY(-1px); }
.cc-btn.primary { color: #fff; background: var(--ink); border-color: var(--ink); }
.cc-btn.primary:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.cc-fade-enter-active, .cc-fade-leave-active { transition: opacity .25s, transform .25s; }
.cc-fade-enter-from, .cc-fade-leave-to { opacity: 0; transform: translateY(12px); }
</style>
