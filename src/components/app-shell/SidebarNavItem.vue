<template>
  <router-link
    :to="to"
    class="nav-item"
    :class="{ active: isActive, collapsed }"
    :style="{ animationDelay: (index * 45) + 'ms' }"
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
  // Index for staggered slide-in (Vibrant Light Mesh motion). Purely cosmetic.
  index: { type: Number, default: 0 },
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
  padding: 10px 12px;
  border-radius: 13px;
  color: var(--vm-ink-soft);
  text-decoration: none;
  font-family: var(--vm-font-sans);
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  position: relative;
  cursor: pointer;
  opacity: 0;
  transform: translateX(-12px);
  animation: vmNavIn .5s var(--vm-ease2) forwards;
  transition: background .2s var(--vm-ease2), color .2s var(--vm-ease2), transform .2s var(--vm-ease2), box-shadow .2s var(--vm-ease2);
}
.nav-item:hover {
  background: var(--vm-glass-strong);
  color: var(--vm-ink);
  transform: translateX(2px);
}
.nav-item.active {
  background: var(--vm-surface);
  color: var(--vm-violet-d);
  box-shadow: var(--vm-shadow-s);
}
.nav-item.active::before {
  content: "";
  position: absolute;
  left: -2px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  border-radius: 0 4px 4px 0;
  background: var(--vm-g-brand);
}
.nav-item.collapsed {
  justify-content: center;
  padding: 10px 0;
}
.nav-icon {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
  opacity: .7;
  transition: opacity .2s var(--vm-ease), filter .2s var(--vm-ease), stroke .2s;
}
.nav-item.active .nav-icon {
  opacity: 1;
  stroke: var(--vm-violet);
  filter: drop-shadow(0 2px 6px rgba(124, 58, 237, .5));
}
.nav-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-badge {
  margin-left: auto;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: var(--vm-g-warm);
  border-radius: 999px;
}
.nav-item:focus-visible {
  outline: 2px solid var(--vm-sky);
  outline-offset: 2px;
}
</style>
