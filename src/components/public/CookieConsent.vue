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
.cc {
  position: fixed;
  left: 16px; right: 16px; bottom: 16px;
  z-index: 80;
  max-width: 560px;
  margin: 0 auto;
  border: 1px solid var(--vm-border);
  background: var(--vm-glass-strong);
  backdrop-filter: blur(16px);
  border-radius: 16px;
  box-shadow: var(--vm-shadow-l);
  padding: 16px 18px;
}
.cc-body { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.cc-text { flex: 1; min-width: 220px; font-size: .85rem; color: var(--vm-ink-soft); margin: 0; line-height: 1.5; }
.cc-link { color: var(--vm-primary); text-decoration: none; font-weight: 600; }
.cc-actions { display: flex; gap: 8px; }
.cc-btn { padding: 9px 18px; border-radius: 10px; font-size: .85rem; font-weight: 600; cursor: pointer; border: 1px solid var(--vm-border); background: #fff; color: var(--vm-ink); }
.cc-btn.primary { color: #fff; background: var(--vm-g-brand); border: none; box-shadow: var(--vm-glow-p); }
.cc-fade-enter-active, .cc-fade-leave-active { transition: opacity .25s, transform .25s; }
.cc-fade-enter-from, .cc-fade-leave-to { opacity: 0; transform: translateY(12px); }
</style>
