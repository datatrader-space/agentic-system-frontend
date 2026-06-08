<template>
  <!-- Top segmented switcher: Agent Library ↔ Configure Agent (in-place, no full redirect).
       Mirrors the approved redesign-v2-preview.html pill. -->
  <div class="vm-switch">
    <button
      class="seg"
      :class="{ on: isLibrary }"
      @click="goLibrary"
    >
      <Icon icon="lucide:layout-grid" class="i" />
      Agent Library
    </button>
    <button
      class="seg"
      :class="{ on: isConfigure }"
      @click="goConfigure"
    >
      <Icon icon="lucide:settings-2" class="i" />
      {{ configureLabel }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'

const route = useRoute()
const router = useRouter()

// "Configure Agent" covers the builder for an existing agent and the new-agent form.
const isConfigure = computed(() =>
  route.name === 'dashboard-agent-configure' || route.name === 'dashboard-agent-new'
)
const isLibrary = computed(() => route.name === 'dashboard-agents' && !isConfigure.value)

// Label reflects whether we're creating or editing.
const configureLabel = computed(() =>
  route.name === 'dashboard-agent-new' ? 'New Agent' : 'Configure Agent'
)

const goLibrary = () => {
  if (route.path !== '/dashboard/agents') router.push('/dashboard/agents')
}

const goConfigure = () => {
  // Already configuring an agent → stay. Otherwise start a new one.
  if (isConfigure.value) return
  router.push('/dashboard/agents/new')
}
</script>

<style scoped>
.vm-switch {
  display: inline-flex;
  gap: 4px;
  padding: 5px;
  border-radius: 999px;
  background: var(--vm-glass-strong);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--vm-line);
  box-shadow: var(--vm-shadow-m);
  font-family: var(--vm-font-sans);
}
.seg {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  color: var(--vm-ink-soft);
  white-space: nowrap;
  transition: color .2s var(--vm-ease2), background .2s, box-shadow .2s, transform .2s var(--vm-ease);
}
.seg:hover { color: var(--vm-ink); }
.seg.on {
  background: var(--vm-g-brand);
  color: #fff;
  box-shadow: var(--vm-glow-v);
}
.seg .i { width: 15px; height: 15px; }
</style>
