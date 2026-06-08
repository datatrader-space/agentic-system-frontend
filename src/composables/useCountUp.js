import { ref, watch, onMounted } from 'vue'

/**
 * useCountUp — animate a number from 0 → target with an ease-out curve.
 * Vibrant Light Mesh power-up #5 (live data flourishes).
 *
 * Respects prefers-reduced-motion (snaps straight to the target).
 *
 * @param {import('vue').Ref<number>|number} target  value to count to (reactive or static)
 * @param {object} [opts]
 * @param {number} [opts.duration=1100]  ms
 * @param {number} [opts.decimals=0]
 * @returns {{ value: import('vue').Ref<number>, display: import('vue').Ref<string> }}
 */
export function useCountUp(target, opts = {}) {
  const { duration = 1100, decimals = 0 } = opts
  const value = ref(0)
  const display = ref('0')
  const to = () => (typeof target === 'object' && 'value' in target ? Number(target.value) || 0 : Number(target) || 0)

  const reduced = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let raf = 0
  function run() {
    const end = to()
    if (reduced) { value.value = end; display.value = format(end); return }
    cancelAnimationFrame(raf)
    const start = 0
    let t0 = null
    const tick = (ts) => {
      if (t0 == null) t0 = ts
      const p = Math.min((ts - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      value.value = start + (end - start) * eased
      display.value = format(value.value)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }
  function format(n) {
    return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  onMounted(run)
  if (typeof target === 'object' && 'value' in target) watch(target, run)

  return { value, display }
}
