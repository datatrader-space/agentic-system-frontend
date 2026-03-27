/**
 * useMeta composable — sets document title and meta tags per page.
 * 
 * Usage in any .vue component:
 *   import { useMeta } from '@/composables/useMeta'
 *   useMeta({ title: 'Features — AADML', description: 'Discover...' })
 */
import { onMounted, onUnmounted, watch, ref } from 'vue'

const defaultTitle = 'AADML — AI Agent Platform'
const defaultDescription = 'Build, deploy, and manage AI agents with tools, schedules, and learning capabilities.'

export function useMeta(options = {}) {
    const setMeta = () => {
        // Title
        document.title = options.title || defaultTitle

        // Description
        setTag('meta', 'name', 'description', options.description || defaultDescription)

        // OG tags
        setTag('meta', 'property', 'og:title', options.title || defaultTitle)
        setTag('meta', 'property', 'og:description', options.description || defaultDescription)
        if (options.ogImage) {
            setTag('meta', 'property', 'og:image', options.ogImage)
        }
        setTag('meta', 'property', 'og:type', options.ogType || 'website')
        setTag('meta', 'property', 'og:url', window.location.href)

        // Twitter
        setTag('meta', 'name', 'twitter:card', 'summary_large_image')
        setTag('meta', 'name', 'twitter:title', options.title || defaultTitle)
        setTag('meta', 'name', 'twitter:description', options.description || defaultDescription)
        if (options.ogImage) {
            setTag('meta', 'name', 'twitter:image', options.ogImage)
        }

        // Canonical
        let canonical = document.querySelector('link[rel="canonical"]')
        if (!canonical) {
            canonical = document.createElement('link')
            canonical.setAttribute('rel', 'canonical')
            document.head.appendChild(canonical)
        }
        canonical.setAttribute('href', options.canonical || window.location.href)
    }

    onMounted(setMeta)

    // Cleanup on unmount — restore defaults
    onUnmounted(() => {
        document.title = defaultTitle
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
