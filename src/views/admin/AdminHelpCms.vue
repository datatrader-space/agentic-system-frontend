<template>
  <div class="cms">
    <div class="cms-tabbar">
      <nav class="cms-tabs" aria-label="Help Center management">
        <button v-for="t in tabs" :key="t.key" :class="{ active: active === t.key }" @click="setTab(t.key)">
          <Icon :icon="t.icon" /> {{ t.label }}
        </button>
      </nav>
    </div>
    <div class="cms-panel">
      <component :is="current" :key="active" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'

const AdminHelpContent = defineAsyncComponent(() => import('./AdminHelpContent.vue'))
const AdminGuidedTours = defineAsyncComponent(() => import('./AdminGuidedTours.vue'))
const AdminApiReference = defineAsyncComponent(() => import('./AdminApiReference.vue'))

const tabs = [
  { key: 'content', label: 'Content', icon: 'lucide:file-text', comp: AdminHelpContent },
  { key: 'tours', label: 'Guided Tours', icon: 'lucide:route', comp: AdminGuidedTours },
  { key: 'api', label: 'API Reference', icon: 'lucide:code', comp: AdminApiReference },
]
const KEYS = tabs.map(t => t.key)

const route = useRoute()
const router = useRouter()
const active = ref(KEYS.includes(route.query.tab) ? route.query.tab : 'content')
const current = computed(() => tabs.find(t => t.key === active.value)?.comp)

function setTab(k) {
  active.value = k
  router.replace({ query: { ...route.query, tab: k } })
}
// Deep-link / back-forward support.
watch(() => route.query.tab, (v) => { if (v && KEYS.includes(v) && v !== active.value) active.value = v })
</script>

<style scoped>
.cms { display: flex; flex-direction: column; min-height: 100%; }
.cms-tabbar { padding: 20px 32px 0; border-bottom: 1px solid #eef2f7; background: #fff; position: sticky; top: 0; z-index: 5; }
.cms-tabs { display: flex; gap: 4px; }
.cms-tabs button {
  display: inline-flex; align-items: center; gap: 8px;
  border: 0; border-bottom: 2px solid transparent; background: transparent;
  padding: 10px 16px 12px; margin-bottom: -1px;
  color: #64748b; font-size: 13.5px; font-weight: 750; cursor: pointer;
}
.cms-tabs button:hover { color: #334155; }
.cms-tabs button.active { color: #4f46e5; border-bottom-color: #4f46e5; }
.cms-tabs button svg { width: 16px; height: 16px; }
.cms-panel { flex: 1; min-height: 0; }
@media (max-width: 680px) { .cms-tabbar { padding: 16px 16px 0; overflow-x: auto; } .cms-tabs { min-width: max-content; } }
</style>
