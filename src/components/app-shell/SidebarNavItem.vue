<template>
  <router-link
    :to="to"
    class="nav-item"
    :class="{ active: isActive, collapsed, child }"
    :style="{ animationDelay: (index * 45) + 'ms' }"
    :title="collapsed ? label : ''"
    :aria-label="collapsed ? label : undefined"
    :aria-current="isActive ? 'page' : undefined"
    :aria-expanded="expandable ? open : undefined"
    @click="onClick"
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
    <svg v-if="!collapsed && expandable" class="nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true" :class="{ open }">
      <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
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
  child: { type: Boolean, default: false },
  expandable: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  // Index for staggered slide-in (Vibrant Light Mesh motion). Purely cosmetic.
  index: { type: Number, default: 0 },
})

const emit = defineEmits(['toggle'])

const route = useRoute()
const isActive = computed(() => {
  if (props.match) return route.path.startsWith(props.match)
  return props.exact ? route.path === props.to : route.path.startsWith(props.to)
})

const onClick = () => {
  if (props.expandable) emit('toggle')
}
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
  filter: drop-shadow(0 2px 6px rgba(21, 94, 239, .4));
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
.nav-chevron {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: #94a3b8;
  transition: transform 0.16s ease, color 0.16s ease;
}
.nav-chevron.open {
  transform: rotate(90deg);
  color: #2563eb;
}
.nav-item:focus-visible {
  outline: 2px solid var(--vm-sky);
  outline-offset: 2px;
}

/* Screen 25 nav row treatment */
.nav-item {
  min-height: 38px;
  padding: 9px 11px;
  border-radius: 9px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
  opacity: 1;
  transform: none;
  animation: none;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}
.nav-item:hover {
  background: #f3f7fd;
  color: #1e293b;
  transform: none;
}
.nav-item.active {
  background: #ffffff;
  color: #2563eb;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06), inset 0 0 0 1px #edf2f9;
}
.nav-item.active::before {
  left: -12px;
  width: 3px;
  height: 24px;
  border-radius: 0 4px 4px 0;
  background: #2563eb;
}
.nav-icon {
  width: 18px;
  height: 18px;
  opacity: 0.74;
  stroke-width: 2.1;
}
.nav-item.active .nav-icon {
  opacity: 1;
  stroke: #2563eb;
  filter: none;
}
.nav-item.collapsed {
  padding: 9px 0;
}
.nav-item.child:not(.collapsed) {
  min-height: 34px;
  margin-left: 22px;
  padding: 7px 10px;
  gap: 9px;
  border-radius: 8px;
  color: #64748b;
  font-size: 12.5px;
  font-weight: 700;
}
.nav-item.child:not(.collapsed)::before {
  content: "";
  position: absolute;
  left: -11px;
  top: 0;
  bottom: 0;
  width: 1px;
  border-radius: 999px;
  background: #dbe5f0;
}
.nav-item.child:not(.collapsed).active {
  color: #2563eb;
  background: #f8fbff;
  box-shadow: inset 0 0 0 1px #e3edff;
}
.nav-item.child:not(.collapsed).active::before {
  left: -11px;
  width: 2px;
  height: 22px;
  top: 50%;
  bottom: auto;
  transform: translateY(-50%);
  background: #2563eb;
}
.nav-item.child:not(.collapsed) .nav-icon {
  width: 15px;
  height: 15px;
  opacity: 0.62;
}
.nav-item.child.collapsed {
  margin-left: 0;
}
</style>
