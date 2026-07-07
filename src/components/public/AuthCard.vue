<template>
  <div class="aadml-public auth-wrap">
    <div class="auth-bg" aria-hidden="true">
      <span class="ring r1"></span><span class="ring r2"></span>
    </div>
    <div class="auth-card">
      <router-link to="/" class="back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to home
      </router-link>

      <router-link to="/" class="brand">
        <AadmlMark :size="30" />AADML
      </router-link>

      <h1 class="title">{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>

      <slot />
    </div>
  </div>
</template>

<script setup>
// Pull in the AADML paper theme (scoped under .aadml-public).
import '../../styles/aadml-public.css'
import AadmlMark from '../common/AadmlMark.vue'

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
  overflow: hidden;
  color: var(--ink);
  font-family: var(--sans);
}
.auth-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.ring { position: absolute; border-radius: 50%; }
.r1 { width: 560px; height: 560px; border: 1px solid rgba(28, 84, 217, 0.14); right: -220px; top: -240px; }
.r2 { width: 360px; height: 360px; border: 1px dashed rgba(216, 77, 55, 0.18); left: -150px; bottom: -170px; }

.auth-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  background: var(--paper-2);
  border: 1px solid var(--line);
  border-radius: 28px;
  padding: 34px;
  box-shadow: var(--shadow);
}
.back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: .82rem; font-weight: 650; color: var(--muted);
  text-decoration: none; margin-bottom: 18px;
}
.back:hover { color: var(--ink); }

.brand { display: inline-flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 900; letter-spacing: -.04em; color: var(--ink); text-decoration: none; margin-bottom: 20px; }
.brand-mark { width: 32px; height: 32px; border: 1.8px solid var(--ink); border-radius: 50%; position: relative; display: grid; place-items: center; }
.brand-mark::before, .brand-mark::after { content: ""; position: absolute; background: var(--ink); width: 15px; height: 1.5px; }
.brand-mark::before { transform: rotate(45deg); }
.brand-mark::after { transform: rotate(-45deg); }
.brand-mark i { width: 6px; height: 6px; border-radius: 50%; background: var(--red); display: block; }

.title { font-family: var(--serif); font-weight: 500; font-size: 1.8rem; letter-spacing: -.03em; color: var(--ink); line-height: 1.05; margin: 0; }
.subtitle { margin-top: 8px; font-size: .92rem; color: var(--muted); }
</style>
