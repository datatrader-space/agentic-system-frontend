/**
 * useBreadcrumbs — reactive, hierarchy-based (location) breadcrumb engine.
 *
 * The trail is derived from the logical parent chain declared in
 * src/config/breadcrumbs.js (NOT from browsing history and NOT from the flat
 * router nesting). Ancestors link back to their level; the current page is
 * plain text.
 *
 *   Bar component:   const { crumbs } = useBreadcrumbs()
 *   Dynamic page:    setBreadcrumbLabel(() => agent.value?.name)   // trailing label
 *   Backend trail:   setBreadcrumbTrail(() => content.value?.breadcrumbs)  // full override
 *
 * Reactive-source convention mirrors useMeta.js: a source may be a plain value,
 * a ref, or a getter function — it is re-read reactively.
 */
import { ref, computed, unref, watchEffect, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import config from '@/config/breadcrumbs'

// One page is mounted per shell at a time, so a single module-level override
// ref suffices. Shape: { type: 'label' | 'trail', path, source, token }.
const override = ref(null)

function resolve(v) {
  const r = unref(v)
  return typeof r === 'function' ? r() : r
}

/** Build the crumb array for the current route. Returns [] to render nothing. */
export function useBreadcrumbs() {
  const route = useRoute()
  const router = useRouter()

  const crumbs = computed(() => {
    const ov = override.value

    // Full-trail override (e.g. HelpArticle's backend-provided breadcrumbs).
    if (ov && ov.type === 'trail' && ov.path === route.path) {
      const trail = resolve(ov.source)
      if (!Array.isArray(trail) || trail.length === 0) return []
      const items = trail.filter((c) => c && c.label)
      return items.map((c, i) => ({
        label: c.label,
        to: i < items.length - 1 ? (c.to || c.url || null) : null,
        current: i === items.length - 1,
      }))
    }

    // Config-driven parent chain.
    const name = route.name
    if (!name || !config[name]) return []

    const chain = []
    const seen = new Set()
    let cur = name
    while (cur && config[cur] && !seen.has(cur)) {
      seen.add(cur)
      chain.push({ name: cur, ...config[cur] })
      cur = config[cur].parent
    }
    chain.reverse()
    if (chain.length <= 1) return [] // Home-only / root pages: no bar.

    return chain.map((entry, i) => {
      const isLast = i === chain.length - 1
      let label = entry.label
      if (isLast && ov && ov.type === 'label' && ov.path === route.path) {
        const dynamic = resolve(ov.source)
        if (dynamic) label = dynamic
      }
      let to = null
      if (!isLast) {
        try {
          to = router.resolve({ name: entry.name }).href
        } catch {
          to = null
        }
      }
      return { label, to, current: isLast }
    })
  })

  return { crumbs }
}

/** Override the trailing (current) crumb's label with a real entity name. */
export function setBreadcrumbLabel(source) {
  const route = useRoute()
  const token = Symbol('bc-label')
  watchEffect(() => {
    override.value = { type: 'label', path: route.path, source, token }
  })
  onUnmounted(() => {
    if (override.value && override.value.token === token) override.value = null
  })
}

/** Override the entire trail with an explicit array of { label, to?|url? }. */
export function setBreadcrumbTrail(source) {
  const route = useRoute()
  const token = Symbol('bc-trail')
  watchEffect(() => {
    override.value = { type: 'trail', path: route.path, source, token }
  })
  onUnmounted(() => {
    if (override.value && override.value.token === token) override.value = null
  })
}
