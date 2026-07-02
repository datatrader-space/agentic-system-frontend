<template>
  <!-- Hierarchy-based (location) breadcrumb trail. Rendered once per layout,
       just below the header. Emits Schema.org BreadcrumbList microdata for SEO. -->
  <nav
    v-if="crumbs.length > 1"
    class="app-breadcrumbs"
    :class="{ 'is-contained': contained }"
    aria-label="Breadcrumb"
  >
    <ol class="bc-list" itemscope itemtype="https://schema.org/BreadcrumbList">
      <li
        v-for="(c, i) in crumbs"
        :key="i"
        class="bc-item"
        itemprop="itemListElement"
        itemscope
        itemtype="https://schema.org/ListItem"
      >
        <RouterLink v-if="c.to && !c.current" :to="c.to" class="bc-link" itemprop="item">
          <span itemprop="name">{{ c.label }}</span>
        </RouterLink>
        <span v-else class="bc-current" itemprop="name" aria-current="page">{{ c.label }}</span>
        <meta itemprop="position" :content="String(i + 1)" />
        <Icon v-if="i < crumbs.length - 1" icon="lucide:chevron-right" class="bc-sep" aria-hidden="true" />
      </li>
    </ol>
  </nav>
</template>

<script setup>
import { Icon } from '@iconify/vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'

// `contained` = true when a parent already supplies horizontal padding
// (e.g. PublicLayout's max-w container), so we drop our own side padding.
defineProps({
  contained: { type: Boolean, default: false },
})

const { crumbs } = useBreadcrumbs()
</script>

<style scoped>
.app-breadcrumbs {
  padding: 14px clamp(16px, 3vw, 32px) 2px;
}
.app-breadcrumbs.is-contained {
  padding-left: 0;
  padding-right: 0;
}
.bc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}
.bc-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px; /* comfortable tap target on mobile */
}
.bc-link {
  color: #2563eb;
  text-decoration: none;
  font-weight: 700;
  padding: 2px 2px;
  border-radius: 4px;
}
.bc-link:hover { text-decoration: underline; }
.bc-current { color: #64748b; }
.bc-sep {
  width: 13px;
  height: 13px;
  color: #cbd5e1;
  flex-shrink: 0;
}
</style>
