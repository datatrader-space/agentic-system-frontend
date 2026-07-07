import { ref, onUnmounted } from 'vue'

/**
 * Sequential node-highlight animation for the workflow-canvas / builder mockups
 * on the public marketing pages. Ported from the `runWorkflow` / `runBuilder`
 * handlers in `.../uploads/site.js` and `site.js`, reworked as reactive Vue state
 * so pages bind `:class="{ running: runningIndex === i }"` instead of touching the DOM.
 *
 * @param {number} count - number of nodes in the flow.
 * @param {object} [opts]
 * @param {number} [opts.step=700] - ms between node steps.
 * @param {string} [opts.idle='Run workflow']
 * @param {string} [opts.busy='Running…']
 * @param {string} [opts.done='Run complete ✓']
 */
export function useNodeRunner(count, opts = {}) {
  const { step = 700, idle = 'Run workflow', busy = 'Running…', done = 'Run complete ✓' } = opts
  const runningIndex = ref(-1)
  const running = ref(false)
  const label = ref(idle)
  const timers = []

  function clear() {
    timers.forEach((t) => clearTimeout(t))
    timers.length = 0
  }

  function run() {
    if (running.value) return
    running.value = true
    label.value = busy
    runningIndex.value = -1
    for (let i = 0; i < count; i++) {
      timers.push(
        setTimeout(() => {
          runningIndex.value = i
          if (i === count - 1) {
            timers.push(
              setTimeout(() => {
                runningIndex.value = -1
                label.value = done
                timers.push(
                  setTimeout(() => {
                    label.value = idle
                    running.value = false
                  }, 1600)
                )
              }, step)
            )
          }
        }, i * step)
      )
    }
  }

  onUnmounted(clear)

  return { runningIndex, running, label, run }
}
