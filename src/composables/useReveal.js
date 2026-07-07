import { onMounted, onUnmounted, nextTick } from 'vue'

/**
 * Scroll-reveal for the AADML public marketing pages.
 *
 * Ported from `public markeeting static pages design/uploads/site.js`. Any element
 * inside the given root that carries `.reveal` or `[data-reveal]` fades/slides in
 * when it enters the viewport. Includes the original failsafe timers so content is
 * never left permanently hidden if IntersectionObserver / scroll events don't fire.
 *
 * @param {import('vue').Ref<HTMLElement|null>} rootRef - container to scan (the page root).
 */
export function useReveal(rootRef) {
  let io = null
  let scrollHandler = null
  const timers = []

  function collect() {
    const root = rootRef?.value || document
    // `.reveal` / `[data-reveal]` animate the element itself; `.stagger` containers
    // leave themselves untouched and cascade their direct children in via CSS.
    const els = [...root.querySelectorAll('[data-reveal], .reveal, .stagger')]
    els.forEach((el) => {
      if (!el.classList.contains('stagger')) el.classList.add('reveal')
    })
    return els
  }

  onMounted(async () => {
    // Respect reduced motion — reveal everything immediately.
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    await nextTick()
    const els = collect()

    if (reduce) {
      els.forEach((el) => el.classList.add('visible'))
      return
    }

    const showInView = () => {
      const h = window.innerHeight || document.documentElement.clientHeight
      for (const el of els) {
        if (el.classList.contains('visible')) continue
        const r = el.getBoundingClientRect()
        if (r.top < h * 0.92 && r.bottom > 0) el.classList.add('visible')
      }
    }

    showInView()
    scrollHandler = showInView
    window.addEventListener('scroll', scrollHandler, { passive: true })
    window.addEventListener('resize', scrollHandler, { passive: true })

    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('visible')
              io.unobserve(e.target)
            }
          }),
        { threshold: 0, rootMargin: '0px 0px -8% 0px' }
      )
      els.forEach((el) => {
        if (!el.classList.contains('visible')) io.observe(el)
      })
    }

    // Failsafes: never leave content hidden.
    timers.push(setTimeout(showInView, 1200))
    timers.push(setTimeout(() => els.forEach((el) => el.classList.add('visible')), 2600))
  })

  onUnmounted(() => {
    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler)
      window.removeEventListener('resize', scrollHandler)
    }
    if (io) io.disconnect()
    timers.forEach((t) => clearTimeout(t))
  })
}
