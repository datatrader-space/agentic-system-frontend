<template>
  <!-- The Video Studio composer (owner's prototype, 2026-10-19). variant 'create': the three tasks as cards, then one
       box with the files added, the prompt, a "+" for media, every setting as a choice, and the main action.
       variant 'chat': the same box at the foot of the agent column, with the host's Send beside "Get estimate".
       Nothing here spends money: "Get estimate" (or "Plan the story") prices it; the render starts only from the
       estimate card's Generate. The Image / Video switch (D14) turns the same box into an image request: the image
       model, shape and how many; "Create image" sends it and the images are made straight away. -->
  <section class="vcp" :class="['vcp-' + variant, 'is-' + video.kind]" :aria-label="video.kind === 'image' ? 'Describe your image' : 'Describe your video'"
           data-test="video-composer-panel">
    <div class="vcp-kind" role="radiogroup" aria-label="What to make" data-test="studio-kind">
      <button v-for="k in kinds" :key="k.value" type="button" role="radio" class="vcp-kind-opt" :class="{ on: video.kind === k.value }"
              :aria-checked="video.kind === k.value ? 'true' : 'false'" :tabindex="video.kind === k.value ? 0 : -1"
              :disabled="k.value === 'image' && !imageAvailable" :title="k.value === 'image' && !imageAvailable ? 'No image model is set up yet' : undefined"
              :data-test="'studio-kind-' + k.value" @keydown="navigateKind" @click="video.setKind(k.value)">
        <span class="vcp-kind-ic" aria-hidden="true" v-html="k.icon"></span>{{ k.label }}
      </button>
    </div>
    <div v-if="variant === 'create' && showTasks && video.kind === 'video'" class="vcp-cards" :style="{ '--task-count': visibleTasks.length }" role="radiogroup"
         aria-label="What would you like to create?">
      <button v-for="t in visibleTasks" :key="t.value" type="button" role="radio" class="vcp-card"
              :class="{ on: video.task === t.value }" :aria-checked="video.task === t.value ? 'true' : 'false'"
              :tabindex="video.task === t.value ? 0 : -1" :data-test="'video-task-' + t.value"
              @keydown="navigateTask($event, t.value)" @click="chooseTask(t.value)">
        <span class="vcp-card-art" aria-hidden="true" v-html="t.art"></span>
        <span class="vcp-card-text"><span class="vcp-card-title">{{ t.label }}</span><span class="vcp-card-desc">{{ t.desc }}</span></span>
        <span v-if="video.task === t.value" class="vcp-card-check" aria-hidden="true" v-html="ICON.check"></span>
      </button>
    </div>
    <!-- The host's starting ideas (create), above the note and the box. -->
    <slot name="above" />
    <p v-if="variant === 'create'" class="vcp-hint" data-test="video-add-note"><span>{{ addNote }}</span> {{ hint }}</p>
    <p v-else-if="blocked" class="vcp-hint is-alert" role="status" data-test="video-add-note">{{ hint }}</p>

    <!-- One box, like a chat input: the files added, the prompt (the host's slot), then a bar with the "+" (always
         there, owner 2026-10-19), the settings and the actions. Each file gets the best role the chosen model takes;
         a file it cannot use is flagged with a model that can, never dropped (plan D3). -->
    <div class="vcp-box" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave.self="dragging = false" @drop.prevent="onDrop">
      <ul v-if="video.refs.length" class="vcp-chips" aria-label="Files used for this video">
        <li v-for="r in video.refs" :key="r.key" class="vcp-chip" :class="{ bad: problemOf(r) }" :data-test="problemOf(r) ? 'video-ref-unusable' : 'video-ref'">
          <video v-if="r.isVideo && r.url" :src="r.url" class="vcp-thumb" muted preload="metadata" aria-hidden="true"></video>
          <img v-else-if="r.url" :src="r.url" class="vcp-thumb" alt="" />
          <span v-else class="vcp-thumb vcp-thumb-sound" aria-hidden="true"></span>
          <span class="vcp-chip-name" :title="r.name">{{ r.name }}</span>
          <VideoChoice class="vcp-role" :model-value="r.role" :options="rolesFor(r)" :label="'Use ' + r.name + ' as'"
                       test-id="video-ref-role" @update:model-value="(v) => video.setRefRole(r.key, v)" />
          <button type="button" class="vcp-chip-x" :aria-label="'Remove ' + r.name" @click="video.removeRef(r.key)">
            <span aria-hidden="true" v-html="ICON.x"></span></button>
          <span v-if="problemOf(r)" class="vcp-chip-why">{{ currentName }} {{ problemOf(r) }}.
            <button v-if="video.alternativeFor(r)" type="button" class="vcp-chip-fix" data-test="video-ref-switch"
                    @click="useAlternative(r)">Use {{ video.alternativeFor(r).name }}</button>
            <template v-else> Remove it to continue.</template>
          </span>
        </li>
      </ul>

      <slot />

      <!-- A model switch that would change something waits for the user (never applied silently). -->
      <div v-if="video.pendingSwitch" class="vcp-switch" role="alertdialog" aria-labelledby="vcp-switch-title" data-test="video-switch-plan">
        <p id="vcp-switch-title" class="vcp-switch-title">Switching to {{ video.pendingSwitch.name }} changes:</p>
        <ul class="vcp-switch-list">
          <li v-for="c in video.pendingSwitch.changes" :key="c.field">{{ c.label }}: {{ c.from }} to {{ c.toLabel }} <span>({{ c.reason }})</span></li>
          <li v-if="video.pendingSwitch.task">Task: {{ video.pendingSwitch.task.from }} to Quick clip <span>({{ video.pendingSwitch.task.reason }})</span></li>
          <li v-for="r in video.pendingSwitch.unusable" :key="r.key">{{ r.name }} would not be used <span>({{ r.reason }})</span></li>
        </ul>
        <div class="vcp-switch-actions">
          <button type="button" class="vcp-primary" data-test="video-switch-apply" @click="video.applySwitch()">Switch and apply</button>
          <button type="button" class="vcp-secondary" data-test="video-switch-keep" @click="video.keepCurrentModel()">Keep {{ currentName }}</button>
        </div>
      </div>

      <div class="vcp-bar">
        <div ref="addEl" class="vcp-add" @keydown.esc="addOpen = false">
          <button type="button" class="vcp-plus" data-test="video-add-media" aria-haspopup="menu" :aria-expanded="addOpen ? 'true' : 'false'"
                  :aria-label="addLabel" :title="addLabel" @click="addOpen = !addOpen">
            <span aria-hidden="true" v-html="ICON.plus"></span>
          </button>
          <div v-if="addOpen" class="vcp-add-menu" role="menu" aria-label="Add media">
            <button type="button" role="menuitem" class="vcp-add-item" data-test="video-add-upload" @click="upload">
              <span class="vcp-add-ic" aria-hidden="true" v-html="ICON.upload"></span>
              <span class="vcp-add-text"><span>Upload from this device</span><small>{{ video.kind === 'image' ? 'Images to keep or follow' : 'Images, videos or sounds' }}</small></span>
            </button>
            <button type="button" role="menuitem" class="vcp-add-item" data-test="video-add-library" @click="fromLibrary">
              <span class="vcp-add-ic" aria-hidden="true" v-html="ICON.library"></span>
              <span class="vcp-add-text"><span>Choose from the Library</span><small>Anything you uploaded or made, and your ingredients</small></span>
            </button>
          </div>
          <input ref="fileEl" type="file" class="vcp-file" :accept="video.kind === 'image' ? 'image/*' : 'image/*,video/*,audio/*'" multiple @change="onPick" />
        </div>

        <!-- Every setting the chosen model offers, as a choice (owner, 2026-10-19). Below 1024px they open in a
             bottom sheet (plan 4.4). Values come from the model's declared outputs; nothing else is offered. -->
        <div ref="settingsWrap" class="vcp-pills-wrap" @keydown.esc="showSettings = false">
          <!-- In the agent column the choices fold behind one summary chip that opens a settings panel above the box
               (owner, 2026-10-20: compact); the create screen shows them all in the row. -->
          <button v-if="variant === 'chat'" type="button" class="vcp-pill vcp-settings-toggle" data-test="video-settings-toggle"
                  aria-haspopup="dialog" :aria-expanded="showSettings ? 'true' : 'false'" @click="showSettings = !showSettings">
            <span class="vcp-pill-ic" aria-hidden="true" v-html="ICON.sliders"></span>
            <span class="vcp-toggle-text">{{ settingsLine }}</span>
            <span class="vcp-chev" aria-hidden="true" v-html="ICON.chev"></span>
          </button>
          <BottomSheet :label="settingsTitle" :summary="settingsSummary" test-id="video-settings-sheet" v-slot="{ sheet }">
            <div v-show="sheet || variant !== 'chat' || showSettings" class="vcp-pills"
                 :class="{ 'in-sheet': sheet || variant === 'chat', 'is-pop': variant === 'chat' && !sheet }"
                 role="group" :aria-label="settingsTitle" data-test="video-settings-panel">
              <div v-if="variant === 'chat' && !sheet" class="vcp-pop-head">
                <span class="vcp-pop-title">{{ settingsTitle }}</span>
                <button type="button" class="vcp-pop-done" data-test="video-settings-done" @click="showSettings = false">Done</button>
              </div>
              <!-- Image mode: the image model, then only the shapes it makes, then how many (D14). -->
              <template v-if="video.kind === 'image'">
                <VideoModelPicker kind="image" :in-sheet="sheet || variant === 'chat'" />
                <VideoChoice v-model="video.image.aspect_ratio" :options="imageShapeOptions" label="Shape" :icon="ICON.shape"
                             :in-sheet="sheet || variant === 'chat'" test-id="image-aspect" />
                <VideoChoice v-model="video.image.n" :options="countOptions" label="How many" :icon="ICON.stack" layout="grid"
                             :in-sheet="sheet || variant === 'chat'" test-id="image-count" />
              </template>
              <template v-else>
                <VideoModelPicker :in-sheet="sheet || variant === 'chat'" />
                <!-- Only what the chosen model offers; switching model changes the choices (owner, 2026-10-20). -->
                <VideoChoice v-if="shapeOptions.length" v-model="video.settings.aspect_ratio" :options="shapeOptions" label="Shape"
                             :icon="ICON.shape" :in-sheet="sheet || variant === 'chat'" test-id="video-aspect" />
                <VideoChoice v-if="video.task === 'story'" v-model="video.targetSeconds" :options="storyLengthOptions" label="Final length"
                             :icon="ICON.clock" layout="grid" :in-sheet="sheet || variant === 'chat'" test-id="video-length" />
                <VideoChoice v-else-if="lengthOptions.length" v-model="video.settings.duration" :options="lengthOptions" label="Clip length"
                             :icon="ICON.clock" layout="grid" :in-sheet="sheet || variant === 'chat'" test-id="video-length" />
                <VideoChoice v-if="resolutionOptions.length" v-model="video.settings.resolution" :options="resolutionOptions" label="Resolution"
                             :icon="ICON.screen" :in-sheet="sheet || variant === 'chat'" test-id="video-resolution" />
                <button type="button" class="vcp-pill vcp-pill-toggle" data-test="video-sound" :disabled="!o.audio"
                        :aria-pressed="o.audio && video.settings.sound ? 'true' : 'false'"
                        :title="o.audio ? 'Generate sound with the video' : 'This model makes silent video'"
                        @click="video.settings.sound = !video.settings.sound">
                  <span class="vcp-pill-ic" aria-hidden="true" v-html="o.audio && video.settings.sound ? ICON.sound : ICON.mute"></span>
                  <span>{{ !o.audio ? 'Silent' : video.settings.sound ? 'Sound on' : 'Sound off' }}</span>
                </button>
              </template>
            </div>
          </BottomSheet>
        </div>

        <div class="vcp-go">
          <!-- The host's own actions (in the agent column: Send or Stop, the main action, at the right end). -->
          <button type="button" class="vcp-primary" :class="{ quiet: variant === 'chat' }" :data-test="video.kind === 'image' ? 'image-create' : 'video-estimate'"
                  :disabled="primaryDisabled" @click="onPrimary">{{ primaryLabel }}</button>
          <slot name="actions" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useVideoStore } from '../../stores/useVideoStore'
import { useChatStore } from '../../stores/useChatStore'
import BottomSheet from './BottomSheet.vue'
import VideoModelPicker from './VideoModelPicker.vue'
import VideoChoice from './VideoChoice.vue'
import { TASK_ART } from './videoArt'

const props = defineProps({
  draft: { type: String, default: '' },
  showTasks: { type: Boolean, default: true },
  ensureProject: { type: Boolean, default: false },
  // 'create': the first screen (task cards, large box). 'chat': the box at the foot of the agent column.
  variant: { type: String, default: 'create' },
})
const emit = defineEmits(['done'])
const video = useVideoStore()
const chat = useChatStore()

const S = (d, w = '1.8') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const ICON = {
  clip: S('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>', '2'),
  upload: S('<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>'),
  library: S('<path d="M4 4h16v16H4z"/><path d="M4 15l5-5 4 4 3-3 4 4"/>'),
  x: S('<path d="M6 6l12 12M18 6L6 18"/>', '2'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>', '2.4'),
  chev: S('<path d="M7 10l5 5 5-5"/>', '2'),
  shape: S('<rect x="3" y="6" width="18" height="12" rx="1.5"/>'),
  clock: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  screen: S('<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20"/>'),
  sound: S('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  mute: S('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16 10l4 4M20 10l-4 4"/>'),
  sliders: S('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  image: S('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M3 17l5-5 4 4 3-3 6 6"/>'),
  stack: S('<rect x="7" y="7" width="13" height="13" rx="1.5"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>'),
}
// Image or Video: the first choice, above everything else in the box (owner, 2026-10-20).
const kinds = [{ value: 'image', label: 'Image', icon: ICON.image }, { value: 'video', label: 'Video', icon: ICON.clip }]
// Image mode needs an image model on the agent and at least one the person may use.
const imageAvailable = computed(() => !!(chat.currentAgent && chat.currentAgent.image_model) && video.image.models.length > 0)
function navigateKind(event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  event.preventDefault()
  const next = video.kind === 'image' ? 'video' : 'image'
  if (next === 'image' && !imageAvailable.value) return
  video.setKind(next)
  event.currentTarget.parentElement.querySelector(`[data-test="studio-kind-${next}"]`)?.focus()
}
const tasks = [
  { value: 'quick', label: 'Quick clip', desc: 'One shot from words or images', art: TASK_ART.quick },
  { value: 'story', label: 'Story video', desc: 'Plan scenes, then build the whole video', art: TASK_ART.story },
  { value: 'edit', label: 'Edit footage', desc: 'Add a video and describe the change', art: TASK_ART.edit },
]
// What a file is used as, in the words the Library uses.
const roleOptions = [
  { value: 'subject', label: 'Product, character or place' }, { value: 'style', label: 'Style' },
  { value: 'first_frame', label: 'Opening shot' }, { value: 'last_frame', label: 'Closing shot' },
  { value: 'motion', label: 'Motion' }, { value: 'audio', label: 'Sound' }, { value: 'edit_source', label: 'Video to edit' },
]
// An image request keeps a file's subject, or follows its look.
const imageRoleOptions = [{ value: 'subject', label: 'Keep this' }, { value: 'style', label: 'Follow its look' }]

const o = computed(() => video.options)
// The settings' choices, from the chosen model's declared outputs only.
const SHAPE_NAMES = { '16:9': 'Landscape', '9:16': 'Vertical', '1:1': 'Square', '4:3': 'Classic', '3:4': 'Portrait',
                      '21:9': 'Cinema wide', '4:5': 'Portrait', '2:3': 'Portrait', '3:2': 'Landscape', '5:4': 'Landscape',
                      '4:7': 'Tall portrait', '7:4': 'Wide landscape' }
function frameGlyph(ar) {
  const m = /^(\d+):(\d+)$/.exec(String(ar))
  const w = m ? Number(m[1]) : 16
  const h = m ? Number(m[2]) : 9
  const k = Math.min(20 / w, 16 / h)
  const W = w * k
  const H = h * k
  return `<svg viewBox="0 0 22 18"><rect x="${(22 - W) / 2}" y="${(18 - H) / 2}" width="${W}" height="${H}" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`
}
const RES_ORDER = ['480p', '540p', '720p', '768p', '1080p', '2K', '4K']
const RES_NAMES = { '480p': 'Draft quality', '540p': 'Draft quality', '720p': 'HD', '768p': 'HD', '1080p': 'Full HD', '2K': 'Sharper than Full HD', '4K': 'Ultra HD' }
const shapeOptions = computed(() => o.value.aspectRatios.map((a) => ({ value: a, label: a, hint: SHAPE_NAMES[a] || '', glyph: frameGlyph(a) })))
const lengthOptions = computed(() => o.value.durations.map((d) => ({ value: d, label: `${d} s` })))
const storyLengthOptions = [8, 12, 15, 20, 30, 45, 60].map((n) => ({ value: n, label: `${n} s` }))
const imageShapeOptions = computed(() => video.imageShapes.map((a) => ({ value: a, label: a, hint: SHAPE_NAMES[a] || '', glyph: frameGlyph(a) })))
const countOptions = [1, 2, 3, 4].map((n) => ({ value: n, label: n === 1 ? '1 image' : `${n} images` }))
const resolutionOptions = computed(() => o.value.resolutions.slice()
  .sort((x, y) => RES_ORDER.indexOf(x) - RES_ORDER.indexOf(y))
  .map((r) => ({ value: r, label: r, hint: RES_NAMES[r] || '' })))
const can = computed(() => video.can)
// Edit footage shows when some offered model can edit; the chosen task stays visible even when the model cannot do
// it, so it is never switched behind the user.
const visibleTasks = computed(() => tasks.filter((t) => t.value !== 'edit' || can.value.edit || video.task === 'edit' || !!video.editRoute))
// Edit footage on a model that cannot edit proposes one that can, through the model-switch notice (never silently).
function chooseTask(value) {
  video.setTask(value)
  if (value === 'edit' && !can.value.edit && video.editRoute) video.pickRoute(String(video.editRoute.route_id))
}
const taskUnavailable = computed(() => video.task === 'edit' && !can.value.edit)
const currentName = computed(() => {
  if (video.kind === 'image') return video.imageModel ? video.imageModel.name : 'The current model'
  return video.route ? video.route.name : 'The current model'
})
const settingsTitle = computed(() => (video.kind === 'image' ? 'Image settings' : 'Video settings'))
const settingsSummary = computed(() => (video.kind === 'image'
  ? `${video.image.aspect_ratio}, ${video.image.n === 1 ? '1 image' : `${video.image.n} images`}`
  : `${video.settings.aspect_ratio}, ${video.task === 'story' ? video.targetSeconds : video.settings.duration} s`))
const showSettings = ref(false)
const settingsWrap = ref(null)
// The settings panel closes on a click outside it (and on Escape, and Done).
function closeSettingsOutside(e) {
  if (showSettings.value && settingsWrap.value && !settingsWrap.value.contains(e.target)) showSettings.value = false
}
onMounted(() => document.addEventListener('pointerdown', closeSettingsOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeSettingsOutside))
// The agent column's one-line summary: the model, then the shape and length.
const settingsLine = computed(() => {
  // The chip is narrow: the model's short name ("Nano Banana", not its long form in brackets).
  if (video.kind === 'image') {
    const name = video.imageModel ? String(video.imageModel.name).replace(/\s*\([^)]*\)\s*$/, '') : 'Auto'
    return `${name}, ${settingsSummary.value}`
  }
  const r = video.route
  const n = r ? String(r.name || '').replace(/^[^:]+:\s*/, '') : 'Auto'
  return `${n}, ${settingsSummary.value}`
})
function navigateTask(event, value) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const values = visibleTasks.value.map((t) => t.value)
  const index = values.indexOf(value)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1
    : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + values.length) % values.length
  chooseTask(values[next])
  event.currentTarget.parentElement.querySelectorAll('[role="radio"]')[next]?.focus()
}
// A chip's role can only be one the model takes.
const visibleRoles = computed(() => roleOptions.filter((r) => ({
  subject: can.value.references, style: can.value.references, motion: can.value.references,
  audio: can.value.references, first_frame: can.value.startFrame, last_frame: can.value.endFrame,
  edit_source: video.task === 'edit',
}[r.value])))
// A reference the current model cannot use is flagged, never removed (owner review 2026-10-19).
const problems = computed(() => Object.fromEntries(video.unusableRefs.map((r) => [r.key, r.problem])))
function problemOf(r) { return problems.value[r.key] || '' }
// A model that can use the flagged file, through the same switch notice as any model change.
function useAlternative(r) {
  const alt = video.alternativeFor(r)
  if (!alt) return
  if (alt.kind === 'image') video.pickImageModel(alt.id)
  else video.pickRoute(alt.id)
}
// Its own role stays selectable, so the chip shows the truth until the user changes or removes it.
function rolesFor(r) {
  if (video.kind === 'image') return imageRoleOptions
  const list = visibleRoles.value
  return list.some((x) => x.value === r.role) ? list : [...list, roleOptions.find((x) => x.value === r.role)].filter(Boolean)
}

// ── The "+" ──────────────────────────────────────────────────────────────────────────────────────────
const fileEl = ref(null)
const addEl = ref(null)
const addOpen = ref(false)
const dragging = ref(false)
const addLabel = computed(() => (video.kind === 'image' ? 'Add an image' : 'Add an image, video or sound'))
// What the chosen model does with media, said once under the box.
const addNote = computed(() => {
  if (video.kind === 'image') {
    const m = video.imageModel
    if (!m) return ''
    const refs = Number(m.max_references || 0)
    return refs ? `${m.name} takes up to ${refs} reference image${refs === 1 ? '' : 's'}.` : `${m.name} makes images from words only.`
  }
  if (!video.routes.length) return ''
  if (video.task === 'edit') return can.value.edit ? `Add the video to change; ${currentName.value} edits it.` : ''
  const uses = []
  if (can.value.references) uses.push('product, character and style references')
  if (can.value.startFrame) uses.push(can.value.endFrame ? 'opening and closing shots' : 'an opening shot')
  return uses.length ? `${currentName.value} uses ${uses.join(' and ')}.` : `${currentName.value} makes video from words only.`
})
// The best role the chosen model takes for a new file; the person can change it on the chip.
function defaultRole(file) {
  if (video.kind === 'image') return 'subject'
  const type = String((file && file.type) || '')
  if (type.startsWith('audio/')) return 'audio'
  if (video.task === 'edit' && type.startsWith('video/') && !video.refs.some((r) => r.role === 'edit_source')) return 'edit_source'
  if (can.value.references) return 'subject'
  // An opening (and closing) shot is one file each: a further image never replaces one behind the person's back,
  // it arrives as a reference the chip flags when the model takes none.
  if (can.value.startFrame && type.startsWith('image/')) {
    if (!video.refs.some((r) => r.role === 'first_frame')) return 'first_frame'
    if (can.value.endFrame && !video.refs.some((r) => r.role === 'last_frame')) return 'last_frame'
  }
  return 'subject'
}
function addFiles(files) {
  for (const f of files) video.addRef(f, defaultRole(f))
}
function upload() {
  addOpen.value = false
  setTimeout(() => fileEl.value && fileEl.value.click(), 0)
}
function fromLibrary() {
  addOpen.value = false
  video.libraryOpen = true
}
function onPick(e) {
  addFiles(Array.from((e.target && e.target.files) || []))
  if (e.target) e.target.value = ''
}
function onDrop(e) {
  dragging.value = false
  addFiles(Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter((f) => /^(image|video|audio)\//.test(f.type)))
}
function closeOnOutside(e) { if (addOpen.value && addEl.value && !addEl.value.contains(e.target)) addOpen.value = false }
onMounted(() => document.addEventListener('pointerdown', closeOnOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutside))

// The agent writes the video prompt from what the person typed, so a request needs their words.
const preparing = ref(false)
const isImage = computed(() => video.kind === 'image')
const primaryDisabled = computed(() => preparing.value || video.busy || chat.isBusy || !props.draft.trim()
  || !!video.pendingSwitch || video.unusableRefs.length > 0 || (!isImage.value && taskUnavailable.value)
  || (isImage.value && !imageAvailable.value))
const primaryLabel = computed(() => {
  if (video.busy || preparing.value) return 'Working…'
  if (isImage.value) return video.image.n === 1 ? 'Create image' : `Create ${video.image.n} images`
  return video.task === 'story' ? 'Plan the story' : 'Get estimate'
})
// What one image costs on the chosen model, when the platform has a price for it.
const imagePrice = computed(() => {
  const p = video.imageModel && video.imageModel.price_per_image
  return p ? ` About $${Number(p).toFixed(3)} an image.` : ''
})
const hint = computed(() => {
  if (isImage.value) {
    if (!imageAvailable.value) return 'No image model is available yet.'
    if (video.pendingSwitch) return 'Apply the model change or keep the current model to continue.'
    if (video.unusableRefs.length) return 'A file is not usable with this model. Remove it or choose another model.'
    return `Images are made as soon as you press Create, and each one is charged to your budget.${imagePrice.value}`
  }
  if (!video.routes.length) return 'No video model is available yet.'
  if (video.pendingSwitch) return 'Apply the model change or keep the current model to continue.'
  if (taskUnavailable.value) return `${currentName.value} cannot edit footage. Choose a model that can, or another task.`
  if (video.unusableRefs.length) return 'A file is not usable with this model. Remove it or choose another model.'
  if (video.task === 'story') return 'Planning is free: the agent writes the scenes, then you render them.'
  return 'An estimate never spends anything; the render starts only when you press Generate on it.'
})
// Something the person has to act on before a request can go (the agent column shows only these).
const blocked = computed(() => (isImage.value ? !imageAvailable.value : (!video.routes.length || taskUnavailable.value))
  || !!video.pendingSwitch || video.unusableRefs.length > 0)

async function onPrimary() {
  if (primaryDisabled.value) return
  preparing.value = true
  try {
    const text = props.draft
    // Studio clips are saved projects too, so they can be reopened from Projects.
    if (props.ensureProject && !video.project) {
      const project = await video.createProject({ chat, prompt: text,
        targetSeconds: video.task === 'story' ? video.targetSeconds : video.settings.duration })
      if (!project) return
      video.panelTab = isImage.value ? 'images' : video.task === 'story' ? 'storyboard' : 'preview'
    }
    if (isImage.value) {
      const sent = await video.requestImage({ prompt: text, chat })
      if (sent) { video.panelTab = 'images'; emit('done') }
      return
    }
    if (video.task === 'story') {
      const ok = await video.planStory({ prompt: text, chat })
      if (ok) emit('done')
      return
    }
    const sent = await video.request({ prompt: text, chat })
    if (sent) emit('done')
  } finally { preparing.value = false }
}

watch(() => chat.selectedAgentId, (id) => {
  if (!id) return
  video.loadCapabilities(id)
  video.loadImageCapabilities(id)
}, { immediate: true })
// Image mode cannot stay on when the agent has no image model the person may use.
watch(imageAvailable, (ok) => { if (!ok && video.kind === 'image' && video.image.loadedFor) video.setKind('video') })
// The host runs the main action from the keyboard (Ctrl+Enter in the prompt).
defineExpose({ submit: onPrimary })
</script>

<style scoped>
/* Colours come from the --vm-* tokens (the Studio sets its grading-suite values); --vs-* only for warnings. */
.vcp { display: grid; gap: 10px; min-width: 0; container-type: inline-size; text-align: left; color: var(--vm-ink, #0f172a); }
/* Create: cards and ideas at the top, the note and the box at the bottom of the screen (owner, 2026-10-19). The
   box stays in reach while the page scrolls. */
.vcp-create { gap: 16px; flex: 1; display: flex; flex-direction: column; }
.vcp-create > .vcp-hint { margin-top: auto; padding-top: 8px; }
.vcp-create > .vcp-box { position: sticky; bottom: 16px; z-index: 2; box-shadow: var(--vm-shadow-m, 0 8px 22px rgba(15, 23, 42, .08)); }

/* Task cards (create): a drawing of what each task makes, the name, one line on what it does. */
.vcp-cards { display: grid; grid-template-columns: repeat(var(--task-count, 3), minmax(0, 1fr)); gap: 12px; }
.vcp-card { position: relative; display: grid; grid-template-rows: auto 1fr; min-width: 0; padding: 0; overflow: hidden; border: 1px solid var(--vm-line-2, #e5e7eb);
  border-radius: 10px; background: var(--vm-surface, #fff); color: var(--vm-ink, #0f172a); font: inherit; text-align: left; cursor: pointer;
  transition: border-color .15s; }
.vcp-card:hover { border-color: var(--vm-line, #cbd5e1); }
.vcp-card.on { border-color: var(--vm-violet, #4f46e5); box-shadow: inset 0 0 0 1px var(--vm-violet, #4f46e5); }
.vcp-card-art { display: block; aspect-ratio: 16 / 7; padding: 10px 14px 0; color: var(--vm-ink-faint, #94a3b8); background: var(--vm-bg, #f8fafc); }
.vcp-card.on .vcp-card-art { color: var(--vs-accent-ink, var(--vm-violet, #4f46e5)); }
.vcp-card-art :deep(svg) { display: block; width: 100%; height: 100%; }
.vcp-card-text { display: grid; gap: 3px; padding: 12px 14px 14px; }
.vcp-card-title { font-size: 14.5px; font-weight: 600; }
.vcp-card-desc { font-size: 12.5px; line-height: 1.45; color: var(--vm-ink-soft, #64748b); }
.vcp-card-check { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 999px;
  background: var(--vm-violet-d, #4f46e5); color: #fff; }
.vcp-card-check :deep(svg) { width: 14px; height: 14px; }

/* Image or Video: one segmented switch. On the create screen it sits centred under the title, the first choice; in the
   agent column it sits small at the left above the box. The chosen side is lifted, with the accent on its icon. */
.vcp-kind { display: inline-flex; justify-self: start; gap: 2px; padding: 3px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 999px;
  background: var(--vm-bg, #f8fafc); }
.vcp-create > .vcp-kind { align-self: center; }
.vcp-kind-opt { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 14px; border: 0; border-radius: 999px;
  background: transparent; color: var(--vm-ink-soft, #64748b); font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer;
  transition: background-color .15s, color .15s; }
.vcp-kind-opt:hover:not(:disabled):not(.on) { color: var(--vm-ink, #0f172a); }
.vcp-kind-opt.on { background: var(--vm-surface-2, #fff); color: var(--vm-ink, #0f172a); box-shadow: 0 0 0 1px var(--vm-line, #dce3ee); }
.vcp-kind-opt:disabled { opacity: .45; cursor: not-allowed; }
.vcp-kind-ic { width: 16px; height: 16px; flex-shrink: 0; }
.vcp-kind-ic :deep(svg) { width: 16px; height: 16px; display: block; }
.vcp-kind-opt.on .vcp-kind-ic { color: var(--vs-accent-ink, var(--vm-violet, #4f46e5)); }
.vcp-create .vcp-kind-opt { min-height: 40px; padding: 0 20px; font-size: 14px; }
.vcp-kind-opt:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }

/* The box. */
.vcp-box { position: relative; display: grid; min-width: 0; border: 1px solid var(--vm-line, #dce3ee); border-radius: 10px;
  background: var(--vm-surface-2, #fff); transition: border-color .15s; }
.vcp-create .vcp-box { background: var(--vm-surface, #fff); }
.vcp-box:focus-within { border-color: var(--vm-violet, #4f46e5); box-shadow: 0 0 0 1px var(--vm-violet, #4f46e5); }
.vcp-box.dragging { border-style: dashed; border-color: var(--vm-violet, #4f46e5); }
.vcp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; min-width: 0; padding: 6px 8px 8px; }
.vcp-pills-wrap { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
.vcp-chat .vcp-pills-wrap { flex-basis: 0; }
.vcp-settings-toggle { justify-self: start; min-width: 0; max-width: 100%; overflow: hidden; }
/* The agent column's settings panel: floats above the box, one labelled row per setting, lists open in place. */
.vcp-pills.is-pop { position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 35; display: grid; gap: 8px;
  max-height: min(70vh, 560px); overflow-y: auto; padding: 0 12px 12px; box-sizing: border-box; border: 1px solid var(--vm-line, #dce3ee);
  border-radius: 10px; background: var(--vm-surface, #fff); box-shadow: var(--vm-shadow-l, 0 14px 34px rgba(15, 23, 42, .14)); }
.vcp-pop-head { position: sticky; top: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin: 0 -12px; padding: 10px 12px; background: var(--vm-surface, #fff); border-bottom: 1px solid var(--vm-line-2, #e5e7eb); }
.vcp-pop-title { font-size: 13.5px; font-weight: 600; }
.vcp-pop-done { min-height: 34px; padding: 0 12px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 6px; background: transparent;
  color: var(--vm-ink, #0f172a); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
.vcp-pop-done:hover { background: var(--vm-surface-2, #f1f5f9); }
.vcp-pop-done:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }
.vcp-hint.is-alert { color: var(--vs-warn-ink, #92400e); }
.vcp-toggle-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 12px; }
@media (max-width: 1023px) { .vcp-settings-toggle { display: none; } }
.vcp-go { display: flex; align-items: center; gap: 6px; margin-left: auto; }

/* The "+". */
.vcp-add { position: relative; flex-shrink: 0; }
.vcp-file { display: none; }
.vcp-plus { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 999px;
  background: transparent; color: var(--vm-ink, #0f172a); cursor: pointer; transition: background-color .15s; }
.vcp-plus:hover, .vcp-plus[aria-expanded="true"] { background: var(--vm-surface, #f1f5f9); }
.vcp-plus :deep(svg) { width: 18px; height: 18px; display: block; }
.vcp-add-menu { position: absolute; left: 0; bottom: calc(100% + 6px); z-index: 30; display: grid; gap: 2px; width: min(300px, 80vw); padding: 6px;
  border: 1px solid var(--vm-line, #dce3ee); border-radius: 8px; background: var(--vm-surface, #fff); box-shadow: var(--vm-shadow-l, 0 14px 34px rgba(15, 23, 42, .12)); }
.vcp-add-item { display: flex; align-items: flex-start; gap: 10px; min-height: 44px; padding: 8px 10px; border: 0; border-radius: 6px; background: transparent;
  color: var(--vm-ink, #0f172a); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; }
.vcp-add-item:hover, .vcp-add-item:focus-visible { background: var(--vm-surface-2, #f1f5f9); }
.vcp-add-ic { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; color: var(--vm-ink-soft, #64748b); }
.vcp-add-ic :deep(svg) { width: 18px; height: 18px; display: block; }
.vcp-add-text { display: grid; gap: 2px; }
.vcp-add-text small { font-size: 12px; color: var(--vm-ink-soft, #64748b); }

/* Files added. */
.vcp-chips { list-style: none; margin: 0; padding: 8px 8px 0; display: flex; flex-wrap: wrap; gap: 6px; }
.vcp-chip { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; max-width: 100%; box-sizing: border-box; padding: 3px 3px 3px 4px;
  border: 1px solid var(--vm-line-2, #e5e7eb); border-radius: 6px; background: var(--vm-surface, #f8fafc); }
.vcp-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 4px; background: #000; }
.vcp-thumb-sound { display: block; background: var(--vm-surface-2, #e5e7eb); }
.vcp-chip-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; }
.vcp-role :deep(.vch-pill) { min-height: 30px; padding: 0 8px; font-size: 12px; }
.vcp-chip-x { display: grid; place-items: center; min-width: 32px; min-height: 32px; border: 0; border-radius: 4px; background: transparent;
  color: var(--vm-ink-soft, #64748b); cursor: pointer; }
.vcp-chip-x:hover { color: var(--vm-ink, #0f172a); }
.vcp-chip-x :deep(svg) { width: 14px; height: 14px; display: block; }
.vcp-chip.bad { border-color: var(--vs-warn-line, #d97706); background: var(--vs-warn-bg, #fffbeb); }
.vcp-chip-why { flex-basis: 100%; padding: 0 4px 4px; font-size: 12px; line-height: 1.5; color: var(--vs-warn-ink, #92400e); }
.vcp-chip-fix { margin-left: 4px; padding: 0; border: 0; background: transparent; color: var(--vs-accent-ink, var(--vm-violet-d, #4f46e5));
  font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }

/* Settings as choices. */
.vcp-pills { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.vcp-pill { position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; max-width: 100%; padding: 0 10px; box-sizing: border-box;
  border: 1px solid var(--vm-line, #dce3ee); border-radius: 999px; background: transparent; color: var(--vm-ink, #0f172a); font: inherit; font-size: 13px; cursor: pointer; }
.vcp-pill:hover:not(:disabled) { background: var(--vm-surface, #f1f5f9); }
.vcp-pill:focus-within { border-color: var(--vm-violet, #4f46e5); }
.vcp-pill-ic { width: 16px; height: 16px; flex-shrink: 0; color: var(--vm-ink-soft, #64748b); }
.vcp-pill-ic :deep(svg) { width: 16px; height: 16px; display: block; }
.vcp-chev { position: absolute; right: 9px; width: 12px; height: 12px; pointer-events: none; color: var(--vm-ink-soft, #64748b); }
.vcp-chev :deep(svg) { width: 12px; height: 12px; display: block; }
.vcp-pill-toggle[aria-pressed="false"] { color: var(--vm-ink-soft, #64748b); }
.vcp-pill:disabled { opacity: .5; cursor: not-allowed; }
/* In the phone sheet the choices are a labelled list. */
.vcp-pills.in-sheet { display: grid; gap: 8px; }
.vcp-pills.in-sheet .vcp-pill { width: 100%; max-width: none; min-height: 48px; border-radius: 8px; }

/* The model-switch notice. */
.vcp-switch { display: grid; gap: 8px; margin: 0 8px 4px; padding: 12px 14px; border: 1px solid var(--vs-warn-line, #d97706); border-radius: 8px; background: var(--vs-warn-bg, #fffbeb); }
.vcp-switch-title { margin: 0; font-size: 13px; font-weight: 600; }
.vcp-switch-list { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
.vcp-switch-list span { color: var(--vm-ink-soft, #64748b); }
.vcp-switch-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.vcp-secondary { min-height: 40px; padding: 0 14px; border: 1px solid var(--vm-line, #dce3ee); border-radius: 6px; background: transparent;
  color: var(--vm-ink, #0f172a); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }

/* Actions and the line under the box. */
.vcp-primary { flex-shrink: 0; min-height: 40px; padding: 0 18px; border: none; border-radius: 8px; background: var(--vm-violet-d, #4f46e5);
  color: #fff; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background-color .15s; }
.vcp-primary:hover:not(:disabled) { background: var(--vm-violet, #6366f1); }
.vcp-primary:disabled { opacity: .45; cursor: not-allowed; }
.vcp-primary.quiet { padding: 0 12px; border: 1px solid var(--vm-line, #dce3ee); background: transparent; color: var(--vm-ink, #0f172a); font-size: 13px; font-weight: 500; }
.vcp-primary.quiet:hover:not(:disabled) { background: var(--vm-surface, #f1f5f9); }
.vcp-hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint, #64748b); }
.vcp-hint span { color: var(--vm-ink-soft, #64748b); }
.vcp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.vcp-card:focus-visible, .vcp-plus:focus-visible, .vcp-chip-fix:focus-visible, .vcp-primary:focus-visible, .vcp-secondary:focus-visible,
.vcp-pill:focus-visible, .vcp-chip-x:focus-visible { outline: 2px solid var(--vm-violet, #4f46e5); outline-offset: 2px; }

/* Touch: every control reaches 44px. */
@media (pointer: coarse) {
  .vcp-kind-opt { min-height: 44px; }
  .vcp-plus { width: 44px; height: 44px; }
  .vcp-pill, .vcp-role, .vcp-chip-x, .vcp-primary, .vcp-secondary { min-height: 44px; }
  .vcp-chip-x { min-width: 44px; }
}
/* A narrow box (the agent column, a phone): the cards become rows, the actions take their own line. */
@container (max-width: 560px) {
  .vcp-cards { grid-template-columns: 1fr; gap: 8px; }
  .vcp-card { grid-template-rows: none; grid-template-columns: 112px minmax(0, 1fr); align-items: center; }
  .vcp-card-art { aspect-ratio: 16 / 10; padding: 6px; }
  .vcp-card-text { padding: 10px 36px 10px 12px; }
  .vcp-create .vcp-go { flex: 1 1 100%; justify-content: flex-end; }
}
/* The agent column keeps "+", the settings chip and the two actions on one row until it is very narrow. */
@container (max-width: 360px) { .vcp-chat .vcp-go { flex: 1 1 100%; justify-content: flex-end; } }
@media (prefers-reduced-motion: reduce) { .vcp * { transition: none !important; } }
</style>
