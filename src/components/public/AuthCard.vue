<template>
  <div class="auth-wrap">
    <div class="auth-mesh" aria-hidden="true">
      <span class="ab b1"></span><span class="ab b2"></span>
    </div>
    <div class="auth-card vm-glass-strong">
      <router-link to="/" class="back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to home
      </router-link>

      <div class="brand">
        <span class="brand-logo">
          <svg viewBox="0 0 32 32" fill="none">
            <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#ac-g)" stroke-width="2.5" />
            <path d="M10 16L14 20L22 12" stroke="url(#ac-g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <defs><linearGradient id="ac-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#2563EB" /><stop offset="1" stop-color="#14B8A6" /></linearGradient></defs>
          </svg>
        </span>
        <span class="font-display text-lg font-extrabold text-ink">AADML</span>
      </div>

      <h1 class="title">{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>

      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({ title: { type: String, required: true }, subtitle: { type: String, default: '' } })
</script>

<style scoped>
.auth-wrap {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--vm-bg);
  overflow: hidden;
}
.auth-mesh { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.ab { position: absolute; border-radius: 50%; filter: blur(80px); opacity: .5; mix-blend-mode: multiply; }
.b1 { width: 40vw; height: 40vw; left: -8vw; top: -10vw; background: radial-gradient(circle, #C7DBFF, transparent 70%); animation: vmDrift1 26s var(--vm-ease2) infinite; }
.b2 { width: 36vw; height: 36vw; right: -6vw; bottom: -10vw; background: radial-gradient(circle, #CDEFE9, transparent 70%); animation: vmDrift3 30s var(--vm-ease2) infinite; }

.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  border: 1px solid var(--vm-border);
  border-radius: 22px;
  padding: 32px;
  box-shadow: var(--vm-shadow-l);
}
.back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: .8rem; font-weight: 500; color: var(--vm-ink-faint);
  text-decoration: none; margin-bottom: 18px;
}
.back:hover { color: var(--vm-ink); }
.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
.brand-logo { display: inline-flex; width: 32px; height: 32px; }
.brand-logo svg { width: 100%; height: 100%; }
.title { font-family: var(--vm-font-display); font-size: 1.55rem; font-weight: 800; color: var(--vm-ink); }
.subtitle { margin-top: 6px; font-size: .92rem; color: var(--vm-ink-soft); }
@media (prefers-reduced-motion: reduce) { .ab { animation: none; } }
</style>
