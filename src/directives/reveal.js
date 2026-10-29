// v-reveal — scroll-reveal directive (Vibrant Light Mesh power-up #3).
// Adds `.vm-reveal` immediately and toggles `.vm-revealed` when the element
// scrolls into view. Styling lives in style.css. Honors reduced-motion there.
//
// Usage:  <div v-reveal>…</div>   or   <div v-reveal="{ delay: 120 }">…</div>
// Register globally in main.js:  app.directive('reveal', reveal)

const io = typeof IntersectionObserver !== 'undefined'
  ? new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const el = e.target
          const delay = Number(el.dataset.revealDelay || 0)
          if (delay) el.style.transitionDelay = `${delay}ms`
          el.classList.add('vm-revealed')
          obs.unobserve(el)
        }
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' })
  : null

// True while the app takes over a prerendered page (main.js). Those elements were painted visible by the page's
// HTML; hiding the ones on screen to fade them in again would blank what the visitor is already reading.
let keepOnScreen = false

/** Run `mount` with elements that are on screen left shown; the ones below the fold still reveal on scroll. */
export function keepOnScreenShown(mount) {
  keepOnScreen = true
  try {
    return mount()
  } finally {
    keepOnScreen = false
  }
}

function onScreen(el) {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

export default {
  mounted(el, binding) {
    if (keepOnScreen && onScreen(el)) return
    el.classList.add('vm-reveal')
    if (binding.value && binding.value.delay) el.dataset.revealDelay = binding.value.delay
    if (io) io.observe(el)
    else el.classList.add('vm-revealed') // no IO support → just show
  },
  unmounted(el) {
    if (io) io.unobserve(el)
  },
}
