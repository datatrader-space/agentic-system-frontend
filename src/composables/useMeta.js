/**
 * useMeta composable — sets document title, meta tags, and optional JSON-LD per page.
 *
 * Reactive: option values may be plain strings, refs, computeds, or getter fns.
 * The tags re-apply whenever a reactive source changes (so computed titles on
 * data-driven pages like Docs/BlogPost update once content loads).
 *
 * Usage:
 *   useMeta({ title: 'Features — AADML', description: 'Discover...' })
 *   useMeta({ title: computed(() => page.value?.title), jsonLd: () => ({...}) })
 */
import { onMounted, onUnmounted, watchEffect, unref } from 'vue'

const defaultTitle = 'AADML — AI Agent Platform'
const defaultDescription = 'Build, deploy, and manage AI agents with tools, schedules, and learning capabilities.'

function resolve(v) {
  const r = unref(v)
  return typeof r === 'function' ? r() : r
}

export function useMeta(options = {}) {
  const apply = () => {
    const title = resolve(options.title) || defaultTitle
    const description = resolve(options.description) || defaultDescription
    const ogImage = resolve(options.ogImage) || resolve(options.image)
    const ogType = resolve(options.ogType) || 'website'
    const canonical = resolve(options.canonical) || window.location.href

    document.title = title

    setTag('meta', 'name', 'description', description)
    setTag('meta', 'property', 'og:title', title)
    setTag('meta', 'property', 'og:description', description)
    setTag('meta', 'property', 'og:type', ogType)
    setTag('meta', 'property', 'og:url', window.location.href)
    setTag('meta', 'name', 'twitter:card', 'summary_large_image')
    setTag('meta', 'name', 'twitter:title', title)
    setTag('meta', 'name', 'twitter:description', description)
    if (ogImage) {
      setTag('meta', 'property', 'og:image', ogImage)
      setTag('meta', 'name', 'twitter:image', ogImage)
    }

    let link = document.querySelector('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'canonical')
      document.head.appendChild(link)
    }
    link.setAttribute('href', canonical)

    // Structured data (JSON-LD) for SEO / rich results
    const jsonLd = resolve(options.jsonLd)
    let script = document.getElementById('page-jsonld')
    if (jsonLd) {
      if (!script) {
        script = document.createElement('script')
        script.id = 'page-jsonld'
        script.type = 'application/ld+json'
        document.head.appendChild(script)
      }
      script.textContent = JSON.stringify(jsonLd)
    } else if (script) {
      script.remove()
    }
  }

  // watchEffect tracks any reactive sources read inside resolve() and re-applies.
  onMounted(() => watchEffect(apply))

  onUnmounted(() => {
    document.title = defaultTitle
    const script = document.getElementById('page-jsonld')
    if (script) script.remove()
  })
}

function setTag(tagName, attrName, attrValue, content) {
  let el = document.querySelector(`${tagName}[${attrName}="${attrValue}"]`)
  if (!el) {
    el = document.createElement(tagName)
    el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}
