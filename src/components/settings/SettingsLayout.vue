<template>
  <div class="settings">
    <header class="settings-header">
      <h1 class="settings-h1">Settings</h1>
      <p class="settings-sub">Manage providers, tools, workspaces, and platform preferences.</p>
    </header>

    <div class="settings-grid">
      <!-- Tab nav (vertical on desktop, horizontal scroll on mobile) -->
      <nav class="settings-nav">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="settings-tab"
          :class="{ active: t.key === activeKey }"
          @click="go(t.key)"
        >
          {{ t.label }}
        </button>
      </nav>

      <!-- Active tab content -->
      <section class="settings-content">
        <component :is="activeComponent" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// New lightweight panels
import GeneralSettings from './GeneralSettings.vue'
import AgentRulesSettings from './AgentRulesSettings.vue'
import SecuritySettings from './SecuritySettings.vue'
import AdvancedSettings from './AdvancedSettings.vue'
// Reused existing pages (genuinely configuration/usage; Tools, MCP, and
// Workspaces are primary sidebar destinations now, so they live there — not here).
import LLMSettings from '../../views/LLMSettings.vue'
import LLMDashboard from '../../views/LLMDashboard.vue'

const route = useRoute()
const router = useRouter()

const tabs = [
  { key: 'general', label: 'General', component: GeneralSettings },
  { key: 'providers', label: 'AI Providers', component: LLMSettings },
  { key: 'agent', label: 'Agent Rules', component: AgentRulesSettings },
  { key: 'usage', label: 'Usage', component: LLMDashboard },
  { key: 'security', label: 'Security', component: SecuritySettings },
  { key: 'advanced', label: 'Advanced', component: AdvancedSettings },
]

const activeKey = computed(() => {
  const t = route.params.tab
  return tabs.some((x) => x.key === t) ? t : 'general'
})
const activeComponent = computed(
  () => tabs.find((x) => x.key === activeKey.value)?.component
)

const go = (key) => router.push(`/dashboard/settings/${key}`)
</script>

<style scoped>
.settings {
  height: 100%;
  overflow-y: auto;
  padding: 24px 24px 48px;
}
.settings-header { max-width: 1100px; margin: 0 auto 20px; }
.settings-h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin: 0; }
.settings-sub { font-size: 0.875rem; color: #64748b; margin: 4px 0 0; }

.settings-grid {
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 24px;
  align-items: start;
}

.settings-nav {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.settings-tab {
  text-align: left;
  padding: 9px 13px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
  background: transparent;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.settings-tab:hover { background: #f1f5f9; color: #0f172a; }
.settings-tab.active { background: #eef2ff; color: #4f46e5; }

.settings-content { min-width: 0; }

/* Mobile: horizontal scroll tab bar */
@media (max-width: 768px) {
  .settings-grid { grid-template-columns: 1fr; gap: 14px; }
  .settings-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    gap: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid #eef1f5;
  }
  .settings-tab { flex-shrink: 0; }
}
</style>
