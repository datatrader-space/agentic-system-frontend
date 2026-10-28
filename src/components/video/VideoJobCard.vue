<template>
  <!-- One video job (plan section 4.3): the estimate with Generate / Decline, then honest phase labels while it
       renders (never an invented percentage), then the result or the reason it failed. -->
  <article class="vjc" :class="'is-' + job.state" :data-test="'video-job-' + job.state">
    <header class="vjc-head">
      <span class="vjc-op">{{ opLabel }}</span>
      <span class="vjc-model" v-if="job.model_name || job.model">{{ job.model_name || job.model }}</span>
      <span class="vjc-state" :class="stateClass">{{ stateLabel }}</span>
    </header>

    <p v-if="job.effective_config && job.effective_config.prompt" class="vjc-prompt">“{{ job.effective_config.prompt }}”</p>
    <p class="vjc-config">{{ configLine }}</p>

    <!-- Estimate -->
    <template v-if="job.state === 'awaiting_authorization'">
      <div v-if="adjustments.length" class="vjc-adj" role="group" aria-label="Changes the model needs">
        <p class="vjc-adj-title">This model needs a few changes:</p>
        <ul>
          <li v-for="a in adjustments" :key="a.field">
            <strong>{{ fieldLabel(a.field) }}</strong>: {{ a.requested }} → {{ a.proposed }}
            <span class="vjc-why">({{ a.reason }})</span>
          </li>
        </ul>
      </div>
      <p class="vjc-price" v-if="job.quote">
        <template v-if="job.quote.pricing_status === 'unknown'">The provider publishes no price for this request; ${{ money(job.quote.max_usd) }} is held and the actual cost is charged.</template>
        <template v-else-if="['estimated','range'].includes(job.quote.pricing_status)">About ${{ money(job.quote.estimate_usd) }}, at most ${{ money(job.quote.max_usd) }} (the provider's reported cost is charged).</template>
        <template v-else>${{ money(job.quote.estimate_usd) }}</template>
      </p>
      <!-- An estimate holds for a short time so the price stays current; the server refuses an expired one,
           so the card says so instead of offering a Generate that can only fail. -->
      <template v-if="expired">
        <p class="vjc-warn" data-test="video-estimate-expired">This estimate has expired. Get a new one to see the current price.</p>
        <div class="vjc-actions">
          <button type="button" class="vjc-btn primary" data-test="video-reestimate" @click="reestimate">Get a new estimate</button>
        </div>
      </template>
      <div v-else class="vjc-actions">
        <button type="button" class="vjc-btn primary" data-test="video-generate" :disabled="pending" @click="go">
          {{ adjustments.length ? 'Accept changes and generate' : 'Generate' }}
        </button>
        <button type="button" class="vjc-btn" :disabled="pending" @click="decline">Decline</button>
      </div>
    </template>

    <!-- In flight -->
    <template v-else-if="!terminal">
      <p class="vjc-phase">{{ job.phase || 'Working' }}<span v-if="elapsed"> · {{ elapsed }}</span></p>
      <p v-if="job.state === 'submission_uncertain'" class="vjc-warn">
        We could not confirm the provider received this request, so it was NOT sent again. It will be checked;
        starting a new attempt may be charged twice.
      </p>
      <p v-if="job.state === 'provider_status_unknown'" class="vjc-warn">
        The provider is not answering about this render right now. It is still tracked; nothing is lost.
      </p>
      <div class="vjc-actions" v-if="paid">
        <button type="button" class="vjc-btn" @click="video.stopWaiting(job)">Stop waiting</button>
      </div>
    </template>

    <!-- Done -->
    <template v-else-if="job.state === 'ready' && job.output">
      <video v-if="isVideo" class="vjc-video" :src="job.output.url" :poster="thumbnailFor({ ...job.output, media_type: 'video' }) || undefined"
             controls preload="none" playsinline></video>
      <audio v-else-if="job.modality === 'audio'" :src="job.output.url" controls preload="metadata" />
      <MediaThumb v-else-if="!job.modality || job.modality === 'image'" class="vjc-video" :item="{ ...job.output, media_type: 'image' }" :src="job.output.url" :alt="job.operation === 'frame' ? 'Saved frame' : (job.effective_config && job.effective_config.prompt) || 'The result'" />
      <a v-else :href="job.output.url" target="_blank" rel="noopener noreferrer">Open {{ job.modality }} result</a>
      <div class="vjc-actions">
        <button v-if="isVideo" type="button" class="vjc-btn primary" @click="openPanel">{{ inStudio ? 'View result' : 'Open in Video Studio' }}</button>
        <span v-if="job.actual_cost_usd" class="vjc-cost">Cost ${{ money(job.actual_cost_usd) }}</span>
      </div>
    </template>
    <template v-else-if="job.state === 'failed'">
      <p class="vjc-err" role="alert">{{ (job.error && job.error.message) || 'The job failed.' }}</p>
      <div class="vjc-actions"><button type="button" class="vjc-btn" @click="video.dismiss(job.job_id)">Dismiss</button></div>
    </template>
    <template v-else>
      <div class="vjc-actions"><button type="button" class="vjc-btn" @click="video.dismiss(job.job_id)">Dismiss</button></div>
    </template>
  </article>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import MediaThumb from '../common/MediaThumb.vue'
import { thumbnailFor } from '../../utils/mediaThumb'
import { useRouter } from 'vue-router'
import { useVideoStore } from '../../stores/useVideoStore'

const props = defineProps({ job: { type: Object, required: true }, inStudio: { type: Boolean, default: false } })
const emit = defineEmits(['open'])
const video = useVideoStore()
const router = useRouter()
const pending = ref(false)

const OPS = { generate: 'New clip', change: 'Video change', extend: 'Continue clip', trim: 'Trim', split: 'Split',
              join: 'Join', retime: 'Speed', crop: 'Reframe', overlay: 'Overlay', caption: 'Captions',
              audio: 'Sound', frame: 'Save frame', export: 'Export',
              // Media jobs (media_ops.OPERATIONS) share this card.
              speech: 'Speech', sound: 'Sound effect', sfx: 'Sound effect', music: 'Music', voice_change: 'Voice change',
              transcribe: 'Transcript', image: 'Image', edit_image: 'Image edit', upscale: 'Upscale', lipsync: 'Lip-sync',
              motion: 'Motion transfer', avatar: 'Talking avatar', train: 'Identity training' }
// An operation this list does not name yet is titled by what the job makes, never as a video by default.
const KINDS = { video: 'Video', image: 'Image', audio: 'Audio', text: 'Transcript', training: 'Identity training' }
const STATES = { awaiting_authorization: 'Estimate', queued: 'Queued', submitting: 'Sending', running: 'Rendering',
                 ingesting: 'Saving', ready: 'Ready', failed: 'Failed', cancelled: 'Cancelled',
                 submission_uncertain: 'Checking', provider_status_unknown: 'Checking' }
const opLabel = computed(() => OPS[props.job.operation] || KINDS[props.job.modality] || 'Video')
const stateLabel = computed(() => STATES[props.job.state] || props.job.state)
const terminal = computed(() => ['ready', 'failed', 'cancelled'].includes(props.job.state))
const paid = computed(() => ['generate', 'change', 'extend'].includes(props.job.operation))
const isVideo = computed(() => props.job.modality ? props.job.modality === 'video' : props.job.operation !== 'frame')
const stateClass = computed(() => ({ ok: props.job.state === 'ready', bad: props.job.state === 'failed',
                                     wait: props.job.state === 'awaiting_authorization' }))
const adjustments = computed(() => (props.job.quote && props.job.quote.adjustments) || [])
const configLine = computed(() => {
  const c = props.job.effective_config || {}
  const bits = []
  if (c.duration) bits.push(`${c.duration} s`)
  if (c.aspect_ratio) bits.push(c.aspect_ratio)
  if (c.size) bits.push(c.size)
  if (c.resolution) bits.push(c.resolution)
  if (c.audio) bits.push('with sound')
  if (c.fallback === 'new_adjacent_shot') bits.push('continues as a new shot from the last frame')
  const refs = (props.job.references || []).length
  if (refs) bits.push(`${refs} reference${refs > 1 ? 's' : ''}`)
  return bits.join(' · ')
})
function fieldLabel(f) {
  return { duration: 'Length', resolution: 'Resolution', aspect_ratio: 'Shape', sound: 'Sound',
           continuation: 'Continue' }[f] || f
}
// Cents, with a third digit only when it says something: $0.039, but $0.09, not "$0.090" (live 2026-10-28).
function money(v) {
  const n = Number(v || 0)
  return n >= 0.1 ? n.toFixed(2) : n.toFixed(3).replace(/0$/, '')
}
async function go() {
  if (pending.value) return
  pending.value = true
  try { await video.start(props.job, true) } finally { pending.value = false }
}
async function decline() {
  if (pending.value) return
  pending.value = true
  try { await video.decline(props.job) } finally { pending.value = false }
}
function openPanel() {
  if (props.inStudio) {
    video.previewAttachmentId = props.job.output?.attachment_id || null
    video.panelTab = 'preview'
    emit('open')
    return
  }
  router.push({ path: '/video-studio', query: { conversation: props.job.conversation_id || undefined } })
}

const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))
const expired = computed(() => {
  const at = props.job.quote && props.job.quote.expires_at
  return props.job.state === 'awaiting_authorization' && !!at && Date.parse(at) <= now.value
})
// End the stale estimate and hand its description back to the composer, where Get estimate asks again
// with the settings the person already chose.
async function reestimate() {
  const prompt = (props.job.effective_config && props.job.effective_config.prompt) || ''
  await video.decline(props.job)
  if (prompt) window.dispatchEvent(new CustomEvent('video-compose', { detail: { text: prompt } }))
}
const elapsed = computed(() => {
  if (!props.job.created_at || terminal.value) return ''
  const s = Math.max(0, Math.round((now.value - Date.parse(props.job.created_at)) / 1000))
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`
})
</script>

<style scoped>
.vjc { border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px; padding: 12px 14px; background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a);
  display: grid; gap: 8px; max-width: 560px; min-width: 0;
  /* A provider's message can carry a long URL with no spaces; it wraps inside the card instead of widening the agent
     column (owner, 2026-10-20). */
  overflow-wrap: anywhere; }
.vjc.is-awaiting_authorization { border-color: var(--vm-violet, #6366f1); }
.vjc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.vjc-op { font-weight: 600; font-size: 13.5px; }
.vjc-model { font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.vjc-state { margin-left: auto; font-size: 11.5px; font-weight: 600; padding: 3px 8px; border-radius: 4px; background: var(--vm-surface-2, #f1f5f9); }
.vjc-state.ok { background: var(--vs-ok-bg, #dcfce7); color: var(--vs-ok-ink, #166534); }
.vjc-state.bad { background: var(--vs-bad-bg, #fee2e2); color: var(--vs-bad-ink, #991b1b); }
.vjc-state.wait { background: var(--vm-violet-soft, #eef2ff); color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5)); }
.vjc-prompt { margin: 0; font-size: 13px; color: var(--vm-ink, #0f172a); }
.vjc-config, .vjc-phase, .vjc-cost { margin: 0; font-size: 12.5px; color: var(--vm-ink-soft, #64748b); }
.vjc-price { margin: 0; font-size: 13px; font-weight: 600; }
.vjc-adj { background: var(--vs-warn-bg, #fffbeb); border: 1px solid var(--vs-warn-line, #fde68a); border-radius: 6px; padding: 8px 10px; font-size: 12.5px; }
.vjc-adj-title { margin: 0 0 4px; font-weight: 600; }
.vjc-adj ul { margin: 0; padding-left: 18px; }
.vjc-why { color: var(--vm-ink-soft, #64748b); }
.vjc-warn { margin: 0; font-size: 12.5px; color: var(--vs-warn-ink, #92400e); }
.vjc-err { margin: 0; font-size: 13px; color: var(--vs-bad-ink, #991b1b); }
.vjc-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.vjc-btn { min-height: 44px; padding: 0 14px; border-radius: 6px; border: 1px solid var(--vm-line, #e5e7eb); background: transparent;
  color: var(--vm-ink, #0f172a); font: inherit; font-weight: 500; font-size: 13px; cursor: pointer; }
.vjc-btn.primary { font-weight: 600; }
.vjc-btn.primary { background: var(--vm-violet-d, #4f46e5); color: #fff; border-color: transparent; }
.vjc-btn:disabled { opacity: .55; cursor: not-allowed; }
.vjc-btn:focus-visible { outline: 2px solid var(--vm-violet-d, #4f46e5); outline-offset: 2px; }
.vjc-video { width: 100%; max-height: 320px; border-radius: 4px; background: #000; }
</style>
