<template>
  <div class="settings" :class="{ 'settings--usage': isUsage }">
    <header v-if="!isUsage" class="settings-header">
      <div>
        <h1 class="settings-h1">Settings</h1>
        <p class="settings-sub">Manage providers, tools, workspaces, and platform preferences.</p>
      </div>

      <div class="settings-menu-wrap">
        <button class="settings-menu-button" type="button" @click="menuOpen = !menuOpen" aria-label="Open settings sections">
          <span />
          <span />
          <span />
          <strong>{{ activeLabel }}</strong>
        </button>
        <div v-if="menuOpen" class="settings-menu">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            :class="{ active: t.key === activeKey }"
            @click="go(t.key)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </header>

    <div v-else class="usage-menu-anchor">
      <div class="settings-menu-wrap">
        <button class="settings-menu-button icon-only" type="button" @click="menuOpen = !menuOpen" aria-label="Open settings sections">
          <span />
          <span />
          <span />
          <strong>{{ activeLabel }}</strong>
        </button>
        <div v-if="menuOpen" class="settings-menu usage-menu">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            :class="{ active: t.key === activeKey }"
            @click="go(t.key)"
          >
            {{ t.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="settings-grid" :class="{ wide: isUsage }">
      <!-- Active tab content -->
      <section class="settings-content" :class="{ wide: isUsage }">
        <component :is="activeComponent" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// New lightweight panels
import GeneralSettings from './GeneralSettings.vue'
import MemorySettings from './MemorySettings.vue'
import SecuritySettings from './SecuritySettings.vue'
import NotificationSettings from './NotificationSettings.vue'
import AdvancedSettings from './AdvancedSettings.vue'
// Reused existing pages (genuinely configuration/usage; Tools, MCP, and
// Workspaces are primary sidebar destinations now, so they live there — not here).
import LLMSettings from '../../views/LLMSettings.vue'
import UsagePage from '../../views/UsagePage.vue'
import SandboxesPage from '../../views/SandboxesPage.vue'
import Billing from '../../views/Billing.vue'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)

const tabs = [
  { key: 'general', label: 'General', component: GeneralSettings },
  { key: 'providers', label: 'AI Providers', component: LLMSettings },
  { key: 'memory', label: 'Memory', component: MemorySettings },
  { key: 'usage', label: 'Usage', component: UsagePage },
  { key: 'sandboxes', label: 'Sandboxes', component: SandboxesPage },
  { key: 'billing', label: 'Billing', component: Billing },
  { key: 'security', label: 'Security', component: SecuritySettings },
  { key: 'notifications', label: 'Notifications', component: NotificationSettings },
  { key: 'advanced', label: 'Advanced', component: AdvancedSettings },
]

const activeKey = computed(() => {
  const t = route.params.tab
  return tabs.some((x) => x.key === t) ? t : 'general'
})
const activeComponent = computed(
  () => tabs.find((x) => x.key === activeKey.value)?.component
)
const activeLabel = computed(
  () => tabs.find((x) => x.key === activeKey.value)?.label || 'Settings'
)
const isUsage = computed(() => activeKey.value === 'usage')

const go = (key) => {
  menuOpen.value = false
  router.push(`/dashboard/settings/${key}`)
}
</script>

<style scoped>
.settings {
  height: 100%;
  overflow-y: auto;
  padding: 24px 24px 48px;
}
.settings--usage {
  padding: 34px 28px 48px;
  background: #f8fbff;
}
.settings-header {
  max-width: 1100px;
  margin: 0 auto 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.settings-h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0; }
.settings-sub { font-size: 0.875rem; color: #64748b; margin: 4px 0 0; }
.usage-menu-anchor {
  position: sticky;
  top: 14px;
  z-index: 30;
  max-width: 1700px;
  margin: 0 auto;
  height: 0;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}
.settings-menu-wrap {
  position: relative;
  flex: 0 0 auto;
  pointer-events: auto;
}
.settings-menu-button {
  position: relative;
  height: 38px;
  min-width: 150px;
  padding: 0 13px 0 38px;
  border: 1px solid #d9e3f0;
  border-radius: 10px;
  background: #fff;
  color: #0f172a;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.03);
}
.settings-menu-button span {
  position: absolute;
  left: 14px;
  width: 14px;
  height: 2px;
  border-radius: 999px;
  background: #3156e9;
}
.settings-menu-button span:nth-of-type(1) { top: 13px; }
.settings-menu-button span:nth-of-type(2) { top: 18px; }
.settings-menu-button span:nth-of-type(3) { top: 23px; }
.settings-menu-button strong {
  font-size: 0.84rem;
  font-weight: 800;
}
.settings-menu-button.icon-only {
  min-width: 38px;
  width: 38px;
  height: 34px;
  padding: 0;
  border-radius: 9px;
}
.settings-menu-button.icon-only strong {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.settings-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  padding: 8px;
  border: 1px solid #dfe7f2;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.14);
}
.settings-menu button {
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #475569;
  cursor: pointer;
  padding: 10px 12px;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 650;
}
.settings-menu button:hover { background: #f1f5f9; color: #0f172a; }
.settings-menu button.active { background: #eef2ff; color: #3156e9; }

.settings-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: block;
}
.settings-grid.wide {
  max-width: 1320px;
  display: block;
}

.settings-content { min-width: 0; }
.settings-content.wide {
  overflow: visible;
}
.settings-content.wide :deep(.cost-page) {
  padding: 0;
  background: transparent;
}
.settings-content.wide :deep(.head-actions) {
  margin-right: 48px;
}

@media (max-width: 1200px) {
  .settings--usage { padding-inline: 20px; }
  .settings-grid.wide { max-width: 100%; }
  .settings-content.wide :deep(.head-actions) { margin-right: 0; }
}

@media (max-width: 768px) {
  .settings-header { flex-direction: column; }
  .settings-menu-wrap, .settings-menu-button { width: 100%; }
  .settings-menu { left: 0; right: auto; width: 100%; }
}
</style>
