<template>
  <component
    :is="external ? 'a' : 'router-link'"
    v-bind="external ? { href: to } : { to }"
    class="nav-item"
    :class="{ active: isActive, collapsed, child }"

    :title="collapsed ? label : ''"
    :aria-label="collapsed ? label : undefined"
    :aria-current="isActive ? 'page' : undefined"
    :aria-expanded="expandable ? open : undefined"
    @click="onClick"
  >
    <component v-if="iconComponent" :is="iconComponent" class="nav-icon" :size="18" :stroke-width="1.7" aria-hidden="true" />
    <svg v-else class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  to: { type: String, required: true },
  label: { type: String, required: true },
  iconComponent: { type: [Object, Function], default: null },
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
  // A page this app does not render (its own index.html, e.g. Training Data): a plain link, so the
  // browser loads it instead of the router looking for a matching route.
  external: { type: Boolean, default: false },
  // Index for staggered slide-in (Vibrant Light Mesh motion). Purely cosmetic.
  index: { type: Number, default: 0 },
})

const emit = defineEmits(['toggle'])

const route = useRoute()
const isActive = computed(() => {
  if (props.external) return false
  if (props.match) return route.path.startsWith(props.match)
  return props.exact ? route.path === props.to : route.path.startsWith(props.to)
})

const onClick = () => {
  if (props.expandable) emit('toggle')
}
</script>

<style scoped>
.nav-item{position:relative;display:flex;align-items:center;gap:12px;min-height:39px;box-sizing:border-box;padding:9px 12px;border:1px solid transparent;border-radius:8px;background:transparent;color:#536177;text-decoration:none;font-family:var(--font-sans);font-size:13px;line-height:20px;font-weight:450;white-space:nowrap;cursor:pointer;transition:background .15s,color .15s,border-color .15s}.nav-item:hover{background:#edf1f7;color:#1f3048}.nav-item.active{background:#eaf1ff;border-color:#dce7fe;color:#205bd5;font-weight:550}.nav-item.active::before{content:"";position:absolute;left:-1px;top:11px;bottom:11px;width:3px;border-radius:0 3px 3px 0;background:#2563eb}.nav-icon{width:18px;height:18px;flex-shrink:0;color:#748299;stroke-width:1.7}.nav-item:hover .nav-icon{color:#4d6384}.nav-item.active .nav-icon{color:#2563eb}.nav-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.nav-badge{margin-left:auto;padding:1px 6px;border-radius:5px;background:#e5ecf7;color:#52698a;font-size:10px;line-height:16px;font-weight:500}.nav-chevron{width:14px;height:14px;flex-shrink:0;color:#8c98aa;transition:transform .15s}.nav-chevron.open{transform:rotate(90deg)}.nav-item.collapsed{justify-content:center;min-height:40px;padding:10px 0}.nav-item.child:not(.collapsed){margin-left:22px;min-height:33px;padding:6px 9px;gap:9px;font-size:12px}.nav-item.child:not(.collapsed) .nav-icon{width:15px;height:15px}.nav-item:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
@media(prefers-reduced-motion:reduce){.nav-item,.nav-chevron{transition:none}}
</style>
