<template>
  <!-- Public marketing shell. Owns its own scroll (global body has overflow:hidden,
       same pattern as AppShell). Self-contained Vibrant Light Mesh backdrop so the
       z-index never fights the app canvas. Light theme only. -->
  <div class="public-shell vm-scroll" ref="scrollEl">
    <!-- Animated mesh backdrop (fixed to viewport, behind content) -->
    <div class="pl-mesh" aria-hidden="true">
      <span class="pl-blob b1"></span>
      <span class="pl-blob b2"></span>
      <span class="pl-blob b3"></span>
      <span class="pl-blob b4"></span>
    </div>

    <!-- ── Header ───────────────────────────────────────────── -->
    <header class="pl-header" :class="{ scrolled: isScrolled }">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <!-- Brand -->
        <router-link to="/" class="flex items-center gap-2.5" @click="closeMobile">
          <span class="pl-logo">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#pl-g)" stroke-width="2.5" />
              <path d="M10 16L14 20L22 12" stroke="url(#pl-g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="16" cy="8" r="2" fill="url(#pl-g)" />
              <circle cx="8" cy="16" r="2" fill="url(#pl-g)" />
              <circle cx="24" cy="16" r="2" fill="url(#pl-g)" />
              <circle cx="16" cy="24" r="2" fill="url(#pl-g)" />
              <defs>
                <linearGradient id="pl-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#2563EB" /><stop offset="1" stop-color="#14B8A6" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span class="font-display text-lg font-extrabold tracking-tight text-ink">AADML</span>
        </router-link>

        <!-- Desktop nav -->
        <nav class="hidden items-center gap-1 md:flex">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="pl-nav-link"
            :class="{ active: isActive(link) }"
          >{{ link.label }}</router-link>
        </nav>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          <router-link to="/login" class="pl-btn-ghost hidden sm:inline-flex">Sign in</router-link>
          <router-link to="/login" class="pl-btn-primary hidden sm:inline-flex">
            Get started
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </router-link>
          <button class="pl-burger md:hidden" aria-label="Open menu" @click="mobileOpen = true">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>

    <!-- ── Mobile drawer ────────────────────────────────────── -->
    <Transition name="pl-fade">
      <div v-if="mobileOpen" class="pl-overlay md:hidden" @click.self="closeMobile">
        <nav class="pl-drawer">
          <div class="mb-6 flex items-center justify-between">
            <span class="font-display text-lg font-extrabold text-ink">AADML</span>
            <button class="pl-burger" aria-label="Close menu" @click="closeMobile">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-6 w-6 text-ink">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="pl-drawer-link"
            :class="{ active: isActive(link) }"
            @click="closeMobile"
          >{{ link.label }}</router-link>
          <div class="mt-6 flex flex-col gap-3">
            <router-link to="/login" class="pl-btn-ghost justify-center" @click="closeMobile">Sign in</router-link>
            <router-link to="/login" class="pl-btn-primary justify-center" @click="closeMobile">Get started</router-link>
          </div>
        </nav>
      </div>
    </Transition>

    <!-- ── Page content ─────────────────────────────────────── -->
    <main class="pl-main">
      <slot />
    </main>

    <!-- ── Footer ───────────────────────────────────────────── -->
    <footer class="pl-footer">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div class="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div class="flex items-center gap-2.5">
              <span class="pl-logo pl-logo-sm">
                <svg viewBox="0 0 32 32" fill="none">
                  <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#pl-gf)" stroke-width="2.5" />
                  <path d="M10 16L14 20L22 12" stroke="url(#pl-gf)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                  <defs>
                    <linearGradient id="pl-gf" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stop-color="#2563EB" /><stop offset="1" stop-color="#14B8A6" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              <span class="font-display text-base font-extrabold text-ink">AADML</span>
            </div>
            <p class="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              The agentic OS for coding and knowledge work — code-aware, context-aware, and cost-aware automation. Self-hostable and built for teams.
            </p>
          </div>
          <div v-for="col in footerCols" :key="col.title">
            <h4 class="text-xs font-semibold uppercase tracking-wider text-ink-faint">{{ col.title }}</h4>
            <ul class="mt-4 space-y-2.5">
              <li v-for="l in col.links" :key="l.label">
                <router-link v-if="l.to" :to="l.to" class="pl-foot-link">{{ l.label }}</router-link>
                <a v-else :href="l.href || '#'" class="pl-foot-link">{{ l.label }}</a>
              </li>
            </ul>
          </div>
        </div>
        <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 text-sm text-ink-faint sm:flex-row">
          <span>© {{ year }} AADML. All rights reserved.</span>
          <div class="flex gap-5">
            <router-link to="/docs" class="pl-foot-link">Docs</router-link>
            <router-link to="/pricing" class="pl-foot-link">Pricing</router-link>
            <router-link to="/contact" class="pl-foot-link">Contact</router-link>
          </div>
        </div>
      </div>
    </footer>

    <CookieConsent />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import CookieConsent from './CookieConsent.vue'

const route = useRoute()
const scrollEl = ref(null)
const isScrolled = ref(false)
const mobileOpen = ref(false)
const year = new Date().getFullYear()

const navLinks = [
  { to: '/', label: 'Home', exact: true },
  { to: '/features', label: 'Features' },
  { to: '/docs', label: 'Docs' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/blog', label: 'Blog' },
]

const footerCols = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Docs', to: '/docs' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Blog', to: '/blog' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Create account', to: '/login' },
      { label: 'API reference', to: '/docs/api-reference' },
    ],
  },
]

function isActive(link) {
  if (link.exact) return route.path === link.to
  return route.path === link.to || route.path.startsWith(link.to + '/')
}

function closeMobile() {
  mobileOpen.value = false
}

function onScroll() {
  isScrolled.value = (scrollEl.value?.scrollTop || 0) > 8
}

onMounted(() => scrollEl.value?.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => scrollEl.value?.removeEventListener('scroll', onScroll))
</script>

<style scoped>
.public-shell {
  position: relative;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--vm-bg);
  color: var(--vm-ink);
  font-family: var(--vm-font-sans);
  scroll-behavior: smooth;
}

/* ── Mesh backdrop ── */
.pl-mesh {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.pl-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.45;
  mix-blend-mode: multiply;
  will-change: transform;
}
.b1 { width: 46vw; height: 46vw; left: -8vw; top: -12vw; background: radial-gradient(circle, #C7DBFF, transparent 70%); animation: vmDrift1 26s var(--vm-ease2) infinite; }
.b2 { width: 40vw; height: 40vw; right: -6vw; top: -6vw; background: radial-gradient(circle, #CDEFE9, transparent 70%); animation: vmDrift2 30s var(--vm-ease2) infinite; }
.b3 { width: 42vw; height: 42vw; left: 16vw; top: 60vh; background: radial-gradient(circle, #DBE4F0, transparent 70%); animation: vmDrift3 32s var(--vm-ease2) infinite; }
.b4 { width: 34vw; height: 34vw; right: 6vw; top: 80vh; background: radial-gradient(circle, #E0ECFF, transparent 70%); animation: vmDrift4 28s var(--vm-ease2) infinite; }

/* ── Header ── */
.pl-header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid transparent;
  transition: background .25s var(--vm-ease2), border-color .25s var(--vm-ease2), box-shadow .25s var(--vm-ease2);
}
.pl-header.scrolled {
  background: var(--vm-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom-color: var(--vm-border);
  box-shadow: var(--vm-shadow-s);
}
.pl-logo { display: inline-flex; width: 32px; height: 32px; }
.pl-logo svg { width: 100%; height: 100%; }
.pl-logo-sm { width: 28px; height: 28px; }

.pl-nav-link {
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--vm-ink-soft);
  text-decoration: none;
  transition: color .15s, background .15s;
}
.pl-nav-link:hover { color: var(--vm-ink); background: var(--vm-surface-soft); }
.pl-nav-link.active { color: var(--vm-primary); background: var(--vm-primary-soft); }

.pl-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 11px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--vm-ink-soft);
  text-decoration: none;
  transition: color .15s, background .15s;
}
.pl-btn-ghost:hover { color: var(--vm-ink); background: var(--vm-surface-soft); }

.pl-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 11px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  background: var(--vm-g-brand);
  box-shadow: var(--vm-glow-p);
  transition: transform .18s var(--vm-ease), box-shadow .18s;
}
.pl-btn-primary:hover { transform: translateY(-1px); box-shadow: var(--vm-glow-v); }

/* ── Burger ── */
.pl-burger {
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 10px;
  border: 1px solid var(--vm-border);
  border-radius: 11px;
  background: var(--vm-surface);
  cursor: pointer;
}
.pl-burger span { display: block; height: 2px; width: 18px; background: var(--vm-ink); border-radius: 2px; }

/* ── Mobile drawer ── */
.pl-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(15, 23, 42, .35);
  backdrop-filter: blur(4px);
}
.pl-drawer {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 100%;
  max-width: 320px;
  padding: 20px;
  background: var(--vm-surface);
  box-shadow: -10px 0 40px rgba(15, 23, 42, .15);
  display: flex;
  flex-direction: column;
}
.pl-drawer-link {
  padding: 14px 12px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 500;
  color: var(--vm-ink-soft);
  text-decoration: none;
}
.pl-drawer-link:hover, .pl-drawer-link.active { color: var(--vm-primary); background: var(--vm-primary-soft); }

/* ── Main / footer ── */
.pl-main { position: relative; z-index: 1; }
.pl-footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--vm-border);
  background: var(--vm-glass);
  backdrop-filter: blur(10px);
}
.pl-foot-link { font-size: 0.875rem; color: var(--vm-ink-soft); text-decoration: none; transition: color .15s; }
.pl-foot-link:hover { color: var(--vm-primary); }

.pl-fade-enter-active, .pl-fade-leave-active { transition: opacity .2s var(--vm-ease2); }
.pl-fade-enter-from, .pl-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .pl-blob { animation: none; }
  .public-shell { scroll-behavior: auto; }
}
</style>
