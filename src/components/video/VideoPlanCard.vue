<template>
  <!-- A storyboard plan (ADM-1146): every scene with its length, price and state, the total, and ONE Generate for all
       of them. Nothing is spent until Generate; Stop starts no more scenes (those being made finish and are kept).
       What the person may do is the server's call (plan.allowed_actions). ADM-1170: the backend had no screen. -->
  <article class="vpc" :class="'is-' + plan.state" :data-test="'video-plan-' + plan.state" :aria-labelledby="titleId">
    <header class="vpc-head">
      <span :id="titleId" class="vpc-title">Storyboard: {{ plan.scenes.length }} scene{{ plan.scenes.length === 1 ? '' : 's' }}</span>
      <span class="vpc-state" :class="stateClass">{{ stateLabel }}</span>
    </header>

    <p class="vpc-total" data-test="video-plan-total">{{ totalLine }}</p>

    <ol class="vpc-scenes">
      <li v-for="s in plan.scenes" :key="s.scene_id" class="vpc-scene" :data-test="'video-plan-scene-' + (s.state || 'none')">
        <MediaThumb v-if="s.output" class="vpc-thumb" :item="{ ...s.output, media_type: 'video' }" :src="s.output.url || ''" alt="" />
        <span v-else class="vpc-num" aria-hidden="true">{{ s.order + 1 }}</span>
        <span class="vpc-what">
          <strong>{{ s.title || `Scene ${s.order + 1}` }}</strong>
          <small>{{ seconds(s.planned_ms) }}<template v-if="s.estimate_usd"> · about {{ usd(s.estimate_usd) }}</template><template v-if="s.continues_previous"> · continues the scene before</template></small>
        </span>
        <span class="vpc-scene-state" :class="sceneClass(s)">{{ sceneLabel(s) }}</span>
      </li>
    </ol>

    <p v-if="plan.state === 'waiting'" class="vpc-note">You pay what each scene costs, never more than the most shown. A failed scene costs nothing. Nothing is spent until you press Generate.</p>

    <div v-if="allows('start') || allows('decline') || allows('stop')" class="vpc-actions">
      <button v-if="allows('start')" type="button" class="vpc-btn primary" data-test="video-plan-start" :disabled="pending" @click="act('start')">Generate all {{ plan.scenes.length }} scenes</button>
      <button v-if="allows('decline')" type="button" class="vpc-btn" data-test="video-plan-decline" :disabled="pending" @click="act('decline')">Decline</button>
      <button v-if="allows('stop')" type="button" class="vpc-btn" data-test="video-plan-stop" :disabled="pending" @click="act('stop')">Stop after these scenes</button>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { usd } from '../../utils/studioPrice'
import MediaThumb from '../common/MediaThumb.vue'

const props = defineProps({ plan: { type: Object, required: true } })
const video = useVideoStore()
const pending = ref(false)
const titleId = `video-plan-${useId()}`

const allows = action => (props.plan.allowed_actions || []).includes(action)
const made = computed(() => props.plan.scenes.filter(s => s.state === 'ready').length)
const stateLabel = computed(() => ({
  waiting: 'Waiting for you', approved: `Making ${made.value} of ${props.plan.scenes.length}`, done: 'Finished',
  declined: 'Declined', void: 'Out of date',
})[props.plan.state] || props.plan.state)
const stateClass = computed(() => ({ done: 'ok', declined: 'muted', void: 'muted' })[props.plan.state] || '')
const totalLine = computed(() => {
  const p = props.plan
  if (p.state === 'done') return p.actual_cost_usd != null ? `Cost ${usd(p.actual_cost_usd)}.` : 'Every scene has finished.'
  if (p.state === 'declined') return 'Declined: nothing was spent.'
  if (p.state === 'void') return 'The storyboard changed after this estimate. Ask the agent for a new one.'
  const most = Number(p.max_usd), est = Number(p.estimate_usd)
  return most > est ? `About ${usd(est)} in all, at most ${usd(most)}.` : `About ${usd(est)} in all.`
})
const seconds = ms => `${Math.round(Number(ms || 0) / 100) / 10} s`
function sceneLabel(s) {
  if (s.held) return 'On hold'
  return ({ awaiting_authorization: 'Waiting', ready: 'Made', failed: 'Failed', cancelled: 'Stopped' })[s.state]
    || (s.state ? (s.phase || 'Making') : 'Waiting')
}
const sceneClass = s => ({ ready: 'ok', failed: 'bad', cancelled: 'muted' })[s.state] || ''

async function act(action) {
  if (pending.value || !allows(action)) return
  pending.value = true
  try { await video.planAction(props.plan, action) } finally { pending.value = false }
}
</script>

<style scoped>
.vpc { display: grid; gap: 10px; min-width: 0; max-width: 560px; padding: 12px 14px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 8px;
  background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); overflow-wrap: anywhere; }
.vpc.is-waiting { border-color: var(--vm-violet, #6366f1); }
.vpc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.vpc-title { font-weight: 600; font-size: 13.5px; }
.vpc-state { margin-left: auto; padding: 3px 8px; border-radius: 4px; background: var(--vm-surface-2, #f1f5f9); font-size: 11.5px; font-weight: 600; }
.vpc-state.ok, .vpc-scene-state.ok { color: var(--vs-ok-ink, #166534); }
.vpc-state.muted, .vpc-scene-state.muted { color: var(--vm-ink-soft, #64748b); }
.vpc-total { margin: 0; font-size: 13px; font-weight: 600; }
.vpc-note { margin: 0; font-size: 12.5px; color: var(--vm-ink-soft, #64748b); }
.vpc-scenes { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.vpc-scene { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 44px; }
.vpc-thumb, .vpc-num { width: 40px; height: 40px; border-radius: 6px; overflow: hidden; }
.vpc-num { display: grid; place-items: center; background: var(--vm-surface-2, #f1f5f9); color: var(--vm-ink-soft, #64748b); font-size: 12px; font-weight: 600; }
.vpc-what { display: grid; gap: 2px; min-width: 0; font-size: 12.5px; }
.vpc-what strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vpc-what small { color: var(--vm-ink-soft, #64748b); font-size: 11.5px; }
.vpc-scene-state { font-size: 11.5px; font-weight: 600; color: var(--vm-ink-soft, #64748b); }
.vpc-scene-state.bad { color: var(--vs-bad-ink, #991b1b); }
.vpc-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.vpc-btn { min-height: 44px; padding: 0 14px; border: 1px solid var(--vm-line, #e5e7eb); border-radius: 6px; background: transparent; color: inherit;
  font: inherit; font-size: 13px; cursor: pointer; transition: background-color .15s, opacity .15s; }
.vpc-btn.primary { border-color: transparent; background: var(--vm-violet-d, #4f46e5); color: #fff; font-weight: 600; }
.vpc-btn:disabled { opacity: .55; cursor: not-allowed; }
.vpc-btn:focus-visible { outline: 2px solid var(--vm-violet-d, #4f46e5); outline-offset: 2px; }
@media (max-width: 480px) { .vpc-actions .vpc-btn { flex: 1 1 100%; } }
</style>
