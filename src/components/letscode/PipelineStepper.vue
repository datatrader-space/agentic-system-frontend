<template>
  <!-- The project's preparation pipeline (Clone → Index → Ready) with its live log. Shown in the editor area
       until the project is ready. A failed step carries the backend's error_message and a Retry button. -->
  <section class="ps" aria-labelledby="ps-title">
    <div class="ps-card">
      <h2 id="ps-title" class="ps-title">{{ title }}</h2>
      <p class="ps-sub">{{ subtitle }}</p>

      <ol class="ps-steps">
        <li v-for="(s, i) in steps" :key="s.key" class="ps-step" :class="'is-' + s.state" :aria-current="s.state === 'current' ? 'step' : undefined">
          <span v-if="i > 0" class="ps-rail" :class="{ filled: s.state !== 'pending' }" aria-hidden="true"></span>
          <span class="ps-node" aria-hidden="true">
            <Icon v-if="s.state === 'done'" icon="lucide:check" />
            <Icon v-else-if="s.state === 'failed'" icon="lucide:x" />
            <span v-else class="ps-node-core"></span>
          </span>
          <span class="ps-text">
            <span class="ps-label">{{ s.label }}</span>
            <span class="ps-state">{{ stateWord(s) }}</span>
            <span class="ps-detail">{{ s.detail }}</span>
          </span>
        </li>
      </ol>

      <div v-if="failed" class="ps-fail" role="alert">
        <Icon icon="lucide:circle-alert" class="ps-fail-ic" />
        <div class="ps-fail-body">
          <p class="ps-fail-h">{{ failedLabel }} failed</p>
          <p class="ps-fail-msg">{{ project.error_message || 'The step stopped without a reason. Retry to run it again.' }}</p>
        </div>
        <button type="button" class="ps-retry" :disabled="retrying" @click="$emit('retry')">
          <Icon :icon="retrying ? 'lucide:loader-2' : 'lucide:rotate-cw'" :class="{ spin: retrying }" />
          {{ retrying ? 'Retrying' : 'Retry' }}
        </button>
      </div>

      <div class="ps-log">
        <div class="ps-log-h">Log</div>
        <pre ref="logEl" class="ps-log-body vm-scroll" tabindex="0" aria-label="Pipeline log"><template v-if="log.length"><span v-for="(l, i) in log" :key="i" class="ps-ln">{{ l }}</span></template><span v-else class="ps-ln ps-ln-empty">Waiting for the first log line.</span></pre>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { pipelineSteps } from './projectStatus'

const props = defineProps({
  project: { type: Object, required: true },
  log: { type: Array, default: () => [] },
  retrying: { type: Boolean, default: false },
})
defineEmits(['retry'])

const steps = computed(() => pipelineSteps(props.project))
const failedStepObj = computed(() => steps.value.find((s) => s.state === 'failed') || null)
const failed = computed(() => !!failedStepObj.value)
const failedLabel = computed(() => failedStepObj.value?.label || 'A step')
const current = computed(() => steps.value.find((s) => s.state === 'current') || null)

const title = computed(() => {
  if (failed.value) return `${props.project.name || 'This project'} could not be prepared`
  if (props.project.phase === 'switching') return `Switching to ${props.project.branch || 'the branch'}`
  return `Preparing ${props.project.name || 'your project'}`
})
const subtitle = computed(() => {
  if (failed.value) return 'Read the reason below, then retry the step.'
  return 'The editor and the coding agent open when every step is done.'
})

function stateWord(s) {
  if (s.state === 'done') return 'Done'
  if (s.state === 'failed') return 'Failed'
  if (s.state === 'current') return s.key === 'clone' && props.project.phase === 'queued' ? 'Queued' : 'In progress'
  return 'Not started'
}

const logEl = ref(null)
watch(() => props.log.length, () => nextTick(() => {
  const el = logEl.value
  if (el) el.scrollTop = el.scrollHeight
}))

defineExpose({ current })
</script>

<style scoped>
.ps { height: 100%; overflow-y: auto; display: flex; align-items: flex-start; justify-content: center; padding: 48px 24px; background: var(--vm-bg); color: var(--vm-ink); font-family: var(--vm-font-sans); }
.ps-card { width: 100%; max-width: 680px; }
.ps-title { font: 700 22px/1.25 var(--vm-font-display); letter-spacing: -.01em; color: var(--vm-ink); margin: 0; overflow-wrap: anywhere; }
.ps-sub { margin: 6px 0 0; font-size: 14px; line-height: 1.5; color: var(--vm-ink-soft); }

/* ── Steps ── */
.ps-steps { list-style: none; margin: 32px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; }
.ps-step { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding-right: 16px; min-width: 0; }
.ps-rail { position: absolute; top: 15px; right: calc(100% + 4px); width: calc(100% - 40px); height: 2px; border-radius: 2px; background: var(--vm-line-2); }
.ps-rail.filled { background: var(--vm-green); }
.ps-node { position: relative; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto; border: 2px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink-faint); }
.ps-node :deep(svg) { width: 16px; height: 16px; }
.ps-node-core { width: 8px; height: 8px; border-radius: 50%; background: var(--vm-line-2); }
.ps-step.is-done .ps-node { border-color: var(--vm-green); background: color-mix(in srgb, var(--vm-green) 14%, var(--vm-surface)); color: color-mix(in srgb, var(--vm-green) 70%, var(--vm-ink)); }
.ps-step.is-failed .ps-node { border-color: var(--vm-danger); background: color-mix(in srgb, var(--vm-danger) 12%, var(--vm-surface)); color: var(--vm-danger); }
.ps-step.is-current .ps-node { border-color: color-mix(in srgb, var(--vm-violet) 30%, transparent); }
.ps-step.is-current .ps-node-core { background: var(--vm-violet); }
/* The one moving thing on the page: a slow arc around the step in progress. */
.ps-step.is-current .ps-node::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid transparent; border-top-color: var(--vm-violet); animation: ps-turn 1.4s linear infinite; }
@keyframes ps-turn { to { transform: rotate(360deg); } }

.ps-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ps-label { font: 700 15px/1.3 var(--vm-font-sans); color: var(--vm-ink); }
.ps-state { font: 600 12.5px/1.3 var(--vm-font-sans); color: var(--vm-ink-faint); }
.ps-step.is-current .ps-state { color: var(--vm-violet-d); }
.ps-step.is-done .ps-state { color: color-mix(in srgb, var(--vm-green) 62%, var(--vm-ink)); }
.ps-step.is-failed .ps-state { color: var(--vm-danger); }
.ps-detail { margin-top: 4px; font-size: 13px; line-height: 1.45; color: var(--vm-ink-soft); }
.ps-step.is-pending .ps-detail { color: var(--vm-ink-faint); }

/* ── Failure ── */
.ps-fail { margin-top: 28px; display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: var(--vm-r); border: 1px solid color-mix(in srgb, var(--vm-danger) 35%, transparent); background: color-mix(in srgb, var(--vm-danger) 8%, var(--vm-surface)); }
.ps-fail-ic { width: 18px; height: 18px; flex: 0 0 auto; margin-top: 1px; color: var(--vm-danger); }
.ps-fail-body { flex: 1; min-width: 0; }
.ps-fail-h { margin: 0; font: 700 14px/1.35 var(--vm-font-sans); color: var(--vm-ink); }
.ps-fail-msg { margin: 4px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--vm-ink-soft); overflow-wrap: anywhere; }
.ps-retry { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 14px; border-radius: var(--vm-r); border: 1px solid var(--vm-line-2); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); cursor: pointer; transition: border-color .15s, background-color .15s; }
.ps-retry:hover:not(:disabled) { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.ps-retry:disabled { opacity: .6; cursor: not-allowed; }
.ps-retry :deep(svg) { width: 15px; height: 15px; }

/* ── Live log ── */
.ps-log { margin-top: 28px; border: 1px solid var(--vm-line); border-radius: var(--vm-r); background: var(--vm-surface); overflow: hidden; }
.ps-log-h { padding: 9px 14px; font: 600 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); border-bottom: 1px solid var(--vm-line); }
.ps-log-body { margin: 0; max-height: 260px; min-height: 96px; overflow: auto; padding: 10px 14px; font: 12.5px/1.65 var(--vm-font-mono); color: var(--vm-ink-soft); white-space: pre-wrap; word-break: break-word; }
.ps-ln { display: block; }
.ps-ln-empty { color: var(--vm-ink-faint); }
.spin { animation: ps-turn 1s linear infinite; }

@media (max-width: 600px) {
  .ps { padding: 28px 16px; }
  .ps-steps { grid-template-columns: 1fr; gap: 18px; }
  .ps-step { flex-direction: row; padding-right: 0; }
  .ps-rail { display: none; }
  .ps-fail { flex-wrap: wrap; }
  .ps-retry { min-height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .ps-step.is-current .ps-node::after, .spin { animation: none; }
}
</style>
