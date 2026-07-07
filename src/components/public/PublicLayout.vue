<template>
  <!-- Public marketing shell — AADML Editorial ("paper") theme.
       The entire new theme lives in src/styles/aadml-public.css, scoped under the
       `.aadml-public` root class applied here, so it never leaks into the dashboard.
       This container owns its own scroll (global body has overflow:hidden). -->
  <div class="public-shell aadml-public" ref="scrollEl">
    <!-- ── Announcement bar ─────────────────────────────────────────── -->
    <div class="top-note">
      <div class="shell">
        A common operating layer for intelligent systems.
        <span>From one workflow to an entire institution.</span>
      </div>
    </div>

    <!-- ── Header ───────────────────────────────────────────────────── -->
    <header>
      <div class="shell nav">
        <router-link to="/" class="brand" @click="closeMobile">
          <AadmlMark :size="34" />AADML
        </router-link>

        <nav class="nav-links">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            :class="{ 'page-nav-active': isActive(link) }"
          >{{ link.label }}</router-link>

          <!-- Company dropdown (hover / focus-within) -->
          <div class="pl-dd">
            <button type="button" class="pl-dd-trigger" :class="{ 'page-nav-active': companyActive }" aria-haspopup="true">
              Company
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="pl-dd-caret"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="pl-dd-menu">
              <router-link
                v-for="c in companyLinks"
                :key="c.to"
                :to="c.to"
                class="pl-dd-item"
                :class="{ active: isActive(c) }"
              >
                <b>{{ c.label }}</b>
                <span>{{ c.desc }}</span>
              </router-link>
            </div>
          </div>
        </nav>

        <div class="nav-actions">
          <router-link to="/login" class="text-link">Sign in</router-link>
          <router-link to="/login" class="btn">Get started <span>↗</span></router-link>
          <button class="pl-burger" aria-label="Open menu" @click="mobileOpen = true">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>

    <!-- ── Mobile drawer ────────────────────────────────────────────── -->
    <Transition name="pl-fade">
      <div v-if="mobileOpen" class="pl-overlay" @click.self="closeMobile">
        <nav class="pl-drawer">
          <div class="pl-drawer-head">
            <span class="brand"><AadmlMark :size="30" />AADML</span>
            <button class="pl-burger" aria-label="Close menu" @click="closeMobile">✕</button>
          </div>
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="pl-drawer-link"
            :class="{ active: isActive(link) }"
            @click="closeMobile"
          >{{ link.label }}</router-link>

          <div class="pl-drawer-label">Company</div>
          <router-link
            v-for="c in companyLinks"
            :key="c.to"
            :to="c.to"
            class="pl-drawer-link"
            :class="{ active: isActive(c) }"
            @click="closeMobile"
          >{{ c.label }}</router-link>

          <div class="pl-drawer-actions">
            <router-link to="/login" class="btn secondary" @click="closeMobile">Sign in</router-link>
            <router-link to="/login" class="btn" @click="closeMobile">Get started</router-link>
          </div>
        </nav>
      </div>
    </Transition>

    <!-- ── Page content ─────────────────────────────────────────────── -->
    <main id="top">
      <div class="shell pl-crumbs">
        <AppBreadcrumbs contained />
      </div>
      <slot />
    </main>

    <!-- ── Footer ───────────────────────────────────────────────────── -->
    <footer>
      <div class="shell">
        <div class="footer-grid">
          <div class="footer-brand">
            <router-link to="/" class="brand"><AadmlMark :size="30" />AADML</router-link>
            <p>
              The governed execution layer for intelligent systems across software,
              science, public institutions, infrastructure, and the physical world.
            </p>
          </div>
          <div v-for="col in footerCols" :key="col.title">
            <h4>{{ col.title }}</h4>
            <template v-for="l in col.links" :key="l.label">
              <router-link v-if="l.to" :to="l.to">{{ l.label }}</router-link>
              <a v-else :href="l.href || '#'">{{ l.label }}</a>
            </template>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© {{ year }} AADML · A North Rays platform</span>
          <span>Built for consequential work</span>
        </div>
      </div>
    </footer>

    <CookieConsent />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import CookieConsent from './CookieConsent.vue'
import AppBreadcrumbs from '../common/AppBreadcrumbs.vue'
import AadmlMark from '../common/AadmlMark.vue'
// Load the class-scoped AADML public theme once (safe globally — every rule is
// prefixed with .aadml-public so it can't touch the dashboard or Tailwind).
import '../../styles/aadml-public.css'
import '../../styles/aadml-public-pages.css'

const route = useRoute()
const scrollEl = ref(null)
const mobileOpen = ref(false)
const year = new Date().getFullYear()

const navLinks = [
  { to: '/', label: 'Home', exact: true },
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/docs', label: 'Docs' },
  { to: '/how-it-works', label: 'How it works' },
]

// Grouped under the "Company" nav dropdown.
const companyLinks = [
  { to: '/about', label: 'About', desc: 'Who we are' },
  { to: '/mission', label: 'Mission', desc: 'What we’re building toward' },
  { to: '/blog', label: 'Blog', desc: 'Field notes on governed execution' },
  { to: '/contact', label: 'Contact', desc: 'Talk to the team' },
]
const companyActive = computed(() => companyLinks.some((c) => isActive(c)))

const footerCols = [
  {
    title: 'Platform',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'How it works', to: '/how-it-works' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Docs', to: '/docs' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Mission', to: '/mission' },
      { label: 'Blog', to: '/blog' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'API & SDKs', to: '/docs/api-reference' },
      { label: 'Quickstart', to: '/docs' },
      { label: 'Connectors & tools', to: '/features' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Create account', to: '/login' },
      { label: 'Contact sales', to: '/contact' },
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

onMounted(() => {
  // Close the drawer on route change (guards against stuck overlay).
  document.documentElement.classList.add('aadml-public-active')
})
onUnmounted(() => {
  document.documentElement.classList.remove('aadml-public-active')
})
</script>

<style scoped>
/* Scroll container — the theme's body rule is applied to .aadml-public, we add the
   viewport-height scroll behaviour here (mirrors the old public-shell). */
.public-shell {
  position: relative;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
}

.pl-crumbs {
  padding-top: 18px;
}

/* Burger — the static design just hid nav on mobile; we keep a real drawer. */
.pl-burger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper-2);
  cursor: pointer;
  flex-direction: column;
  gap: 4px;
  color: var(--ink);
  font-size: 15px;
}
.pl-burger span {
  display: block;
  height: 2px;
  width: 18px;
  background: var(--ink);
  border-radius: 2px;
}

/* ── Company dropdown (desktop) ── */
.pl-dd { position: relative; }
.pl-dd-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  padding: 0;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 650;
  color: #4f5c55;
  cursor: pointer;
}
.pl-dd-trigger:hover { color: var(--ink); }
.pl-dd-caret { width: 14px; height: 14px; transition: transform .18s ease; }
.pl-dd:hover .pl-dd-caret,
.pl-dd:focus-within .pl-dd-caret { transform: rotate(180deg); }

.pl-dd-menu {
  position: absolute;
  top: calc(100% + 14px);
  right: 0;
  min-width: 250px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--paper-2);
  box-shadow: var(--shadow);
  opacity: 0;
  visibility: hidden;
  transform: translateY(6px);
  transition: opacity .18s ease, transform .18s ease, visibility .18s;
  z-index: 60;
}
/* Bridge the gap so the menu doesn't close when moving the cursor onto it. */
.pl-dd::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  height: 16px;
}
.pl-dd:hover .pl-dd-menu,
.pl-dd:focus-within .pl-dd-menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.pl-dd-item {
  display: block;
  padding: 10px 12px;
  border-radius: 11px;
  text-decoration: none;
  transition: background .15s;
}
.pl-dd-item:hover { background: var(--green-2); }
.pl-dd-item.active { background: var(--green-2); }
.pl-dd-item b { display: block; font-size: 14px; font-weight: 750; color: var(--ink); }
.pl-dd-item span { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); }

/* ── Drawer group label ── */
.pl-drawer-label {
  margin: 14px 12px 4px;
  font: 800 10px var(--mono);
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted);
}

.pl-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(20, 34, 29, 0.4);
  backdrop-filter: blur(4px);
}
.pl-drawer {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 100%;
  max-width: 330px;
  padding: 22px;
  background: var(--paper-2);
  box-shadow: -12px 0 44px rgba(20, 34, 29, 0.18);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pl-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.pl-drawer-link {
  padding: 14px 12px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 650;
  color: var(--muted);
  text-decoration: none;
}
.pl-drawer-link:hover,
.pl-drawer-link.active {
  color: var(--ink);
  background: var(--green-2);
}
.pl-drawer-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.pl-fade-enter-active,
.pl-fade-leave-active {
  transition: opacity 0.2s ease;
}
.pl-fade-enter-from,
.pl-fade-leave-to {
  opacity: 0;
}

@media (max-width: 1100px) {
  .pl-burger {
    display: inline-flex;
  }
}
</style>
