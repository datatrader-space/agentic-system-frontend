<template>
  <!-- Video mode inside the composer (prototype screen 1). Three tasks, reference slots with roles, a settings
       row that only offers what the chosen model can do, and one primary action that never spends money:
       "Get estimate" (or "Plan the story"). The render starts only from the estimate card's Generate. -->
  <section class="vcp" aria-label="Video mode" data-test="video-composer-panel">
    <div v-if="showTasks" class="vcp-tasks" role="radiogroup" aria-label="What would you like to create?">
      <button v-for="t in visibleTasks" :key="t.value" type="button" role="radio" class="vcp-task"
              :class="{ on: video.task === t.value }" :aria-checked="video.task === t.value ? 'true' : 'false'"
              :data-test="'video-task-' + t.value" @click="video.setTask(t.value)">
        <span class="vcp-task-ic" aria-hidden="true" v-html="t.icon"></span>
        <span class="vcp-task-text"><span class="vcp-task-title">{{ t.label }}</span>
          <span class="vcp-task-desc">{{ t.desc }}</span></span>
      </button>
    </div>

    <!-- Reference slots: each upload becomes a chip with a ROLE the server receives with it. -->
    <input ref="fileEl" type="file" class="vcp-file" :accept="pickAccept" @change="onPick" />
    <div v-if="slots.length" class="vcp-slots">
      <button v-for="s in slots" :key="s.role" type="button" class="vcp-slot" :data-test="'video-slot-' + s.role"
              :title="s.hint" @click="pick(s)">
        <span class="vcp-slot-ic" aria-hidden="true" v-html="s.icon"></span>
        <span>{{ s.label }}</span>
      </button>
    </div>
    <ul v-if="video.refs.length" class="vcp-chips" aria-label="Files used for this video">
      <li v-for="r in video.refs" :key="r.key" class="vcp-chip">
        <video v-if="r.isVideo && r.url" :src="r.url" class="vcp-thumb" muted preload="metadata" aria-hidden="true"></video>
        <img v-else-if="r.url" :src="r.url" class="vcp-thumb" alt="" />
        <span class="vcp-chip-name" :title="r.name">{{ r.name }}</span>
        <label class="vcp-sr" :for="'role-' + r.key">Role of {{ r.name }}</label>
        <select :id="'role-' + r.key" class="vcp-role" :value="r.role" @change="video.setRefRole(r.key, $event.target.value)">
          <option v-for="o in visibleRoles" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <button type="button" class="vcp-chip-x" :aria-label="'Remove ' + r.name" @click="video.removeRef(r.key)">×</button>
      </li>
    </ul>

    <!-- Settings row: values come from the chosen route's declared outputs; nothing else is offered. -->
    <div class="vcp-settings">
      <label class="vcp-field">
        <span class="vcp-label">Video model</span>
        <select data-test="video-route" :value="video.routeId" @change="video.pickRoute($event.target.value)">
          <option value="">Auto{{ autoName ? ` (${autoName})` : '' }}</option>
          <option v-for="r in video.routes" :key="r.route_id" :value="r.route_id" :disabled="r.state !== 'active'">
            {{ r.name }} · via {{ r.via }}{{ r.state !== 'active' ? ' (unavailable)' : '' }}
          </option>
        </select>
      </label>
      <label class="vcp-field" v-if="o.aspectRatios.length">
        <span class="vcp-label">Shape</span>
        <select v-model="video.settings.aspect_ratio">
          <option v-for="a in o.aspectRatios" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
      <label v-if="video.task === 'story'" class="vcp-field">
        <span class="vcp-label">Final length</span>
        <select v-model.number="video.targetSeconds">
          <option v-for="s in [8, 12, 15, 20, 30, 45, 60]" :key="s" :value="s">{{ s }} s</option>
        </select>
      </label>
      <label v-else-if="o.durations.length" class="vcp-field">
        <span class="vcp-label">Clip length</span>
        <select v-model.number="video.settings.duration">
          <option v-for="d in o.durations" :key="d" :value="d">{{ d }} s</option>
        </select>
      </label>
      <label v-if="o.resolutions.length" class="vcp-field">
        <span class="vcp-label">Resolution</span>
        <select v-model="video.settings.resolution">
          <option value="">Model default</option>
          <option v-for="r in o.resolutions" :key="r" :value="r">{{ r }}</option>
        </select>
      </label>
      <label class="vcp-check" :class="{ off: !o.audio }" :title="o.audio ? 'Generate sound with the video' : 'This model renders silent video'">
        <input type="checkbox" v-model="video.settings.sound" :disabled="!o.audio" />
        <span>Sound</span>
      </label>
      <button type="button" class="vcp-primary" data-test="video-estimate" :disabled="primaryDisabled"
              @click="onPrimary">
        {{ video.busy ? 'Working…' : (video.task === 'story' ? 'Plan the story' : 'Get estimate') }}
        <span aria-hidden="true">›</span>
      </button>
    </div>
    <p class="vcp-hint">{{ hint }}</p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { useChatStore } from '../../stores/useChatStore'

const props = defineProps({
  draft: { type: String, default: '' },
  showTasks: { type: Boolean, default: true },
})
const emit = defineEmits(['done'])
const video = useVideoStore()
const chat = useChatStore()

const ICON = {
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 10l4-2v8l-4-2"/></svg>',
  story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5L20 18M8.5 15.5L20 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  frame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5L5 20"/></svg>',
  style: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 10l4-2v8l-4-2"/></svg>',
}
const tasks = [
  { value: 'quick', label: 'Quick clip', desc: 'One shot from text or images', icon: ICON.clip },
  { value: 'story', label: 'Story video', desc: 'Plan scenes, then build a complete video', icon: ICON.story },
  { value: 'edit', label: 'Edit footage', desc: 'Add a video and describe the changes', icon: ICON.edit },
]
const roleOptions = [
  { value: 'subject', label: 'Subject' }, { value: 'style', label: 'Style' },
  { value: 'first_frame', label: 'Start frame' }, { value: 'last_frame', label: 'End frame' },
  { value: 'motion', label: 'Motion' }, { value: 'audio', label: 'Audio' }, { value: 'edit_source', label: 'Edit source' },
]

const o = computed(() => video.options)
const can = computed(() => video.can)
const autoName = computed(() => {
  const r = video.routes.find((x) => String(x.route_id) === String(video.defaultRouteId))
  return r ? r.name : ''
})
// Only what the chosen model offers is shown (owner, 2026-10-16): no reference slot for a model that takes
// no references, no Edit footage for a model that cannot edit video, no end frame without start+end support.
const visibleTasks = computed(() => tasks.filter((t) => t.value !== 'edit' || can.value.edit))
const slots = computed(() => {
  const refSlot = { role: 'subject', label: 'Add references', icon: ICON.plus, accept: 'image/*,video/*,audio/*',
                    hint: 'A product, a character or a place to keep' }
  if (video.task === 'edit') {
    return [{ role: 'edit_source', label: 'Video to edit', icon: ICON.video, accept: 'video/*', hint: 'The footage to change' },
            ...(can.value.references ? [{ ...refSlot, accept: 'image/*,video/*', hint: 'Images to guide the change' }] : [])]
  }
  return [
    ...(can.value.references ? [refSlot] : []),
    ...(can.value.startFrame ? [{ role: 'first_frame', label: 'Start frame', icon: ICON.frame, accept: 'image/*',
                                  hint: 'The first frame of the clip' }] : []),
    ...(can.value.endFrame ? [{ role: 'last_frame', label: 'End frame', icon: ICON.frame, accept: 'image/*',
                                hint: 'The last frame of the clip' }] : []),
    ...(can.value.references ? [{ role: 'style', label: 'Style or subject', icon: ICON.style, accept: 'image/*,video/*',
                                  hint: 'A look to follow' }] : []),
  ]
})
// A chip's role can only be one the model takes.
const visibleRoles = computed(() => roleOptions.filter((r) => ({
  subject: can.value.references, style: can.value.references, motion: can.value.references,
  audio: can.value.references, first_frame: can.value.startFrame, last_frame: can.value.endFrame,
  edit_source: video.task === 'edit',
}[r.value])))
// Switching to a model that cannot do the chosen task or a reference's role drops back to what it can do.
watch(can, (c) => {
  if (video.task === 'edit' && !c.edit) video.setTask('quick')
  const allowed = new Set(visibleRoles.value.map((r) => r.value))
  const dropped = video.refs.filter((r) => !allowed.has(r.role))
  if (dropped.length) dropped.forEach((r) => video.removeRef(r.key))
})
const fileEl = ref(null)
const pending = ref(null)
const pickAccept = computed(() => (pending.value && pending.value.accept) || 'image/*,video/*,audio/*')
function pick(slot) {
  pending.value = slot
  setTimeout(() => fileEl.value && fileEl.value.click(), 0)
}
function onPick(e) {
  const files = Array.from((e.target && e.target.files) || [])
  for (const f of files) video.addRef(f, (pending.value && pending.value.role) || 'subject')
  if (e.target) e.target.value = ''
}

// The agent writes the video prompt from what the person typed, so a request needs their words.
const primaryDisabled = computed(() => video.busy || !props.draft.trim())
const hint = computed(() => {
  if (!video.routes.length) return 'No video model is available yet. Assign one on the agent’s Video generation card.'
  if (video.task === 'story') return 'Planning is free: the assistant writes the scenes, then you render them one by one.'
  return 'An estimate never spends anything. The render starts only when you press Generate on the estimate.'
})

async function onPrimary() {
  const text = props.draft
  if (video.task === 'story') {
    const ok = await video.planStory({ prompt: text, chat })
    if (ok) emit('done')
    return
  }
  // The request goes to the agent, which writes the video prompt and prepares the estimate.
  const sent = await video.request({ prompt: text, chat })
  if (sent) emit('done')
}

watch(() => chat.selectedAgentId, (id) => { if (id) video.loadCapabilities(id) }, { immediate: true })
</script>

<style scoped>
.vcp { display: grid; gap: 10px; padding: 10px 12px 4px; border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.vcp-tasks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.vcp-task { display: flex; gap: 10px; align-items: flex-start; text-align: left; min-height: 56px; padding: 10px 12px;
  border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 12px; background: var(--vm-surface, #fff); cursor: pointer; }
.vcp-task:hover { border-color: var(--vm-violet, #6366f1); }
.vcp-task.on { border-color: var(--vm-violet-d, #4f46e5); box-shadow: 0 0 0 2px var(--vm-violet-soft, #eef2ff); }
.vcp-task:focus-visible, .vcp-slot:focus-visible, .vcp-primary:focus-visible { outline: 2px solid var(--vm-violet-d, #4f46e5); outline-offset: 2px; }
.vcp-task-ic { width: 22px; height: 22px; flex: 0 0 22px; color: var(--vm-violet-d, #4f46e5); }
.vcp-task-ic :deep(svg) { width: 22px; height: 22px; }
.vcp-task-text { display: grid; gap: 2px; min-width: 0; }
.vcp-task-title { font-weight: 700; font-size: 13.5px; color: var(--vm-ink, #0f172a); }
.vcp-task-desc { font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.vcp-file { display: none; }
.vcp-slots { display: flex; flex-wrap: wrap; gap: 8px; }
.vcp-slot { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px dashed var(--vm-line, #cbd5e1);
  border-radius: 10px; background: var(--vm-surface-2, #f8fafc); color: var(--vm-ink, #0f172a); font-size: 13px; cursor: pointer; }
.vcp-slot:disabled { opacity: .5; cursor: not-allowed; }
.vcp-slot-ic { width: 18px; height: 18px; color: var(--vm-ink-soft, #64748b); }
.vcp-slot-ic :deep(svg) { width: 18px; height: 18px; }
.vcp-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.vcp-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 10px; background: var(--vm-surface, #fff); }
.vcp-thumb { width: 34px; height: 34px; object-fit: cover; border-radius: 6px; }
.vcp-chip-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }
.vcp-role { font-size: 12px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 6px; padding: 3px 4px; }
.vcp-chip-x { border: none; background: transparent; font-size: 16px; width: 28px; height: 28px; cursor: pointer; color: var(--vm-ink-soft, #64748b); }
.vcp-settings { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; }
.vcp-field { display: grid; gap: 3px; font-size: 12px; }
.vcp-label { color: var(--vm-ink-soft, #64748b); font-weight: 600; }
.vcp-field select { min-height: 36px; border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 9px; padding: 0 8px; background: var(--vm-surface, #fff); max-width: 260px; }
.vcp-check { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-size: 13px; }
.vcp-check.off { opacity: .55; }
.vcp-primary { margin-left: auto; min-height: 44px; padding: 0 18px; border: none; border-radius: 11px; background: var(--vm-violet-d, #4f46e5);
  color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
.vcp-primary:disabled { opacity: .5; cursor: not-allowed; }
.vcp-hint { margin: 0; font-size: 12px; color: var(--vm-ink-soft, #64748b); }
.vcp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (max-width: 640px) {
  .vcp-tasks { grid-template-columns: 1fr; }
  .vcp-primary { width: 100%; justify-content: center; margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .vcp * { transition: none !important; } }
</style>
