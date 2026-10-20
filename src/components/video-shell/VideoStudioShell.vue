<template>
  <!-- Video Studio's own dashboard inside the AADML app (owner, 2026-10-19): its own side navigation, like the
       admin dashboard. Below 1024px the navigation is a drawer: the menu button opens it; picking a page, tapping
       outside or Escape closes it. -->
  <div class="vs-shell" @keydown.esc="menuOpen = false">
    <div v-if="menuOpen" class="vs-backdrop" aria-hidden="true" @click="menuOpen = false"></div>
    <aside id="vs-sidebar" class="vs-sidebar" :class="{ open: menuOpen }" aria-label="Video Studio" data-test="video-studio-nav">
      <router-link to="/video-studio" class="vs-brand">
        <svg class="vs-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
             stroke-linejoin="round" aria-hidden="true"><path d="M3 8V5h3M18 5h3v3M21 16v3h-3M6 19H3v-3" /><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" /></svg>
        <span>Video Studio</span>
      </router-link>
      <nav class="vs-nav" aria-label="Video Studio pages">
        <router-link v-for="item in nav" :key="item.to" :to="item.to" class="vs-nav-item" :class="{ active: isActive(item) }"
                     :aria-current="isActive(item) ? 'page' : undefined" :data-test="'vs-nav-' + item.key">
          <svg viewBox="0 0 24 24" class="vs-nav-ico" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true"><path v-for="(d, i) in item.icon" :key="i" :d="d" /></svg>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="vs-foot">
        <router-link :to="backTo" class="vs-back" data-test="vs-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          <span>Back to AADML</span>
        </router-link>
        <p v-if="email" class="vs-user" :title="email">{{ email }}</p>
      </div>
    </aside>

    <main class="vs-main">
      <div class="vs-topbar">
        <button type="button" class="vs-menu-btn" aria-controls="vs-sidebar" :aria-expanded="String(menuOpen)" aria-label="Open Video Studio menu"
                @click="menuOpen = !menuOpen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </div>
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../../services/api'
import { useChatStore } from '../../stores/useChatStore'

const route = useRoute()
const chat = useChatStore()
const user = ref(null)
const menuOpen = ref(false)
watch(() => route.fullPath, () => { menuOpen.value = false })

const nav = [
  { key: 'create', to: '/video-studio', exact: true, label: 'Create', icon: ['M3 6h12v12H3z', 'M15 10l6-3v10l-6-3'] },
  { key: 'projects', to: '/video-studio/projects', label: 'Projects', icon: ['M3 7h7l2 2h9v10H3z'] },
  { key: 'library', to: '/video-studio/library', label: 'Library', icon: ['M4 4h16v16H4z', 'M4 15l5-5 4 4 3-3 4 4', 'M15.5 8.5h.01'] },
  { key: 'ingredients', to: '/video-studio/ingredients', label: 'Ingredients', icon: ['M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', 'M4 21a8 8 0 0 1 16 0'] },
]
function isActive(item) {
  return item.exact ? route.path === item.to || route.path === item.to + '/' : route.path.startsWith(item.to)
}
const email = computed(() => (user.value && (user.value.email || user.value.username)) || '')
// Back to the chat this video belongs to, else a new chat.
const backTo = computed(() => (chat.conversationId ? `/dashboard/chat/${chat.conversationId}` : '/dashboard/chat/new'))

onMounted(async () => {
  // The grading-suite palette goes on <body> so what the Studio opens over itself (bottom sheets, the Library
  // drawer, approval dialogs, notifications) takes it too.
  document.body.classList.add('vs-theme')
  try { user.value = (await api.checkAuth()).data?.user || null } catch { /* the page still works */ }
})
onBeforeUnmount(() => document.body.classList.remove('vs-theme'))
</script>

<style>
/* Video Studio palette: a colour-grading suite. Footage is judged against a neutral grey surround with no hue, so
   the chrome is neutral greys; AADML blue is the one accent (the main action, the current page, focus). Same token
   names as style.css, so every component built on them re-skins. --vs-* are the few the Studio adds. */
body.vs-theme {
  color-scheme: dark;
  --vm-bg: #1E1F22;
  --vm-surface: #25262A;
  --vm-surface-soft: #2E2F34;
  --vm-surface-2: #2E2F34;
  --vm-border: #3A3B41;
  --vm-line: #3A3B41;
  --vm-line-2: #34353A;
  --vm-ink: #EDEDEF;
  --vm-ink-soft: #B3B4BA;
  --vm-ink-faint: #8E8F96;
  --vm-violet: #3B82F6;
  --vm-violet-d: #2563EB;
  --vm-violet-soft: rgba(59, 130, 246, .16);
  --vm-primary: #3B82F6;
  --vm-primary-d: #2563EB;
  --vm-primary-soft: rgba(59, 130, 246, .16);
  --vm-glass: rgba(37, 38, 42, .86);
  --vm-glass-strong: rgba(37, 38, 42, .96);
  --vm-shadow-s: 0 1px 2px rgba(0, 0, 0, .4);
  --vm-shadow-m: 0 10px 30px rgba(0, 0, 0, .45);
  --vm-shadow-l: 0 24px 60px rgba(0, 0, 0, .55);
  --vs-accent-ink: #8DB4FF;
  --vs-ok-bg: rgba(60, 203, 127, .14);
  --vs-ok-ink: #7FE0A8;
  --vs-warn-bg: rgba(242, 179, 65, .12);
  --vs-warn-line: rgba(242, 179, 65, .45);
  --vs-warn-ink: #F5C76A;
  --vs-bad-bg: rgba(255, 110, 110, .12);
  --vs-bad-ink: #FF9C9C;
  --vs-scrim: rgba(0, 0, 0, .6);
  background: var(--vm-bg);
}
</style>

<style scoped>
.vs-shell { display: flex; height: 100vh; height: 100dvh; overflow: hidden; background: var(--vm-bg); color: var(--vm-ink); font-family: var(--vm-font-sans); }
.vs-sidebar { width: 216px; flex-shrink: 0; display: flex; flex-direction: column; box-sizing: border-box; height: 100%; overflow-y: auto;
  padding: 14px 10px 12px; background: var(--vm-bg); border-right: 1px solid var(--vm-line-2); }
.vs-brand { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 10px; margin-bottom: 14px; border-radius: 6px;
  color: var(--vm-ink); font-size: 15px; font-weight: 600; letter-spacing: -.01em; text-decoration: none; }
.vs-mark { width: 22px; height: 22px; color: var(--vs-accent-ink); flex-shrink: 0; }
.vs-nav { display: flex; flex-direction: column; gap: 2px; }
.vs-nav-item { position: relative; display: flex; align-items: center; gap: 11px; min-height: 40px; padding: 0 10px; border-radius: 6px;
  color: var(--vm-ink-soft); font-size: 13.5px; font-weight: 500; text-decoration: none; transition: background-color .15s, color .15s; }
.vs-nav-item:hover { background: var(--vm-surface); color: var(--vm-ink); }
.vs-nav-item.active { background: var(--vm-surface); color: var(--vm-ink); }
.vs-nav-item.active::before { content: ''; position: absolute; left: -10px; top: 9px; bottom: 9px; width: 2px; border-radius: 0 2px 2px 0; background: var(--vm-violet); }
.vs-nav-item.active .vs-nav-ico { color: var(--vs-accent-ink); }
.vs-nav-ico { width: 18px; height: 18px; flex-shrink: 0; }
.vs-foot { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--vm-line-2); }
.vs-back { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 10px; border-radius: 6px; color: var(--vm-ink-soft);
  font-size: 13px; font-weight: 500; text-decoration: none; }
.vs-back:hover { background: var(--vm-surface); color: var(--vm-ink); }
.vs-back svg { width: 16px; height: 16px; flex-shrink: 0; }
.vs-user { margin: 2px 10px 0; font-size: 12px; color: var(--vm-ink-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vs-brand:focus-visible, .vs-nav-item:focus-visible, .vs-back:focus-visible, .vs-menu-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.vs-main { flex: 1; min-width: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.vs-topbar { display: none; }
@media (max-width: 1023px) {
  .vs-sidebar { position: fixed; inset: 0 auto 0 0; z-index: 60; width: min(280px, 86vw); transform: translateX(-100%); transition: transform .2s ease;
    box-shadow: var(--vm-shadow-l); }
  .vs-sidebar.open { transform: translateX(0); }
  .vs-backdrop { position: fixed; inset: 0; z-index: 55; background: var(--vs-scrim); }
  /* One bar on a phone: the menu button sits in the top-left of each page's own bar (pages pad by --vs-bar-inset). */
  .vs-main { position: relative; display: flex; flex-direction: column; --vs-bar-inset: 48px; }
  .vs-topbar { position: absolute; top: 6px; left: 4px; z-index: 41; display: block; }
  .vs-menu-btn { display: grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 6px; background: transparent; color: var(--vm-ink); cursor: pointer; }
  .vs-menu-btn svg { width: 20px; height: 20px; }
}
@media (prefers-reduced-motion: reduce) { .vs-sidebar, .vs-nav-item { transition: none; } }
</style>
