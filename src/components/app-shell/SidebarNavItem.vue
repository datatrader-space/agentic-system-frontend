<template>
  <router-link
    :to="to"
    class="nav-item"
    :class="{ active: isActive, collapsed }"
    :title="collapsed ? label : ''"
    :aria-label="collapsed ? label : undefined"
    :aria-current="isActive ? 'page' : undefined"
  >
    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path
        v-for="(d, i) in icon"
        :key="i"
        :d="d"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span v-if="!collapsed" class="nav-label">{{ label }}</span>
    <span v-if="!collapsed && badge" class="nav-badge">{{ badge }}</span>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  to: { type: String, required: true },
  label: { type: String, required: true },
  icon: { type: Array, default: () => [] }, // array of SVG path `d` strings
  badge: { type: String, default: '' },
  exact: { type: Boolean, default: false },
  // Optional prefix used for active-state matching when it differs from `to`
  // (e.g. Settings links to /settings/general but is active across all tabs).
  match: { type: String, default: '' },
  collapsed: { type: Boolean, default: false },
})

const route = useRoute()
const isActive = computed(() => {
  if (props.match) return route.path.startsWith(props.match)
  return props.exact ? route.path === props.to : route.path.startsWith(props.to)
})
</script>

<style scoped>
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border-radius: 10px;
  color: #475569;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.nav-item:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.nav-item.active {
  background: #eef2ff;
  color: #4f46e5;
}
.nav-item.collapsed {
  justify-content: center;
  padding: 9px 0;
}
.nav-icon {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
  opacity: 0.85;
}
.nav-item.active .nav-icon {
  opacity: 1;
}
.nav-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-badge {
  padding: 1px 7px;
  font-size: 0.625rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 999px;
}
.nav-item:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: 2px;
}
</style>
