<!--
  The builder's one floating toolbar row (plan §3.1).
    left    back, the inline name, the status pill (Draft / Published vN / Paused) and the save state
    centre  add a step, Undo, Redo, Tidy up, Fit
    right   Test, Run / Stop, Publish and the menu (Save, Versions, Validate, Outline, Shortcuts, Help, ...)
  At phone width (`compact`) the row keeps back, the name, Run / Stop and the menu; everything else moves into the
  menu, so nothing is lost and the canvas still fills the screen.

  `role` = the person's role on the workflow (ADM-1339, utils/workflowAccess): a control the role cannot use is not
  shown (a viewer sees no edit, Test or Run; a runner sees Test and Run; only the owner sees Share and Archive). The
  server refuses those requests anyway. A shared workflow shows the person's role beside its status.

  `runBlocked` = why this workflow has no Run (a frame workflow, ADM-1351: only a stream runs it). Run then stays in its
  place, focusable but aria-disabled and described by the page's note (`runBlockedBy`, its id); pressing it emits `run`
  as before, and the page says the reason. Test stays.
-->
<template>
  <div class="wfb-toolbar" role="toolbar" aria-label="Workflow">
    <div class="wfb-toolbar__left">
      <button type="button" class="wfb-icon-btn" aria-label="Back to workflows" title="Back to workflows" @click="emit('back')">
        <Icon icon="lucide:arrow-left" aria-hidden="true" />
      </button>
      <input
        v-if="renaming"
        ref="nameInput"
        v-model="draft"
        class="wfb-name-input"
        aria-label="Workflow name"
        maxlength="200"
        autocomplete="off"
        spellcheck="false"
        data-wf-own-escape
        @keydown.enter.prevent="commit"
        @keydown.esc.prevent.stop="cancel"
        @blur="commit"
      />
      <button v-else-if="can.edit" type="button" class="wfb-name" :disabled="disabled" title="Rename workflow (F2)" @click="startRename">
        <span class="wfb-name__text" translate="no">{{ name || 'Untitled workflow' }}</span>
        <Icon icon="lucide:pencil" aria-hidden="true" />
        <span class="wf-sr">Rename workflow</span>
      </button>
      <span v-else class="wfb-name is-static"><span class="wfb-name__text" translate="no">{{ name || 'Untitled workflow' }}</span></span>
      <span v-if="statusText" class="wfb-pill" :class="`is-${status}`">{{ statusText }}</span>
      <span v-if="roleText" class="wfb-pill is-role" :title="roleTitle"><span class="wf-sr">Your role: </span>{{ roleText }}</span>
      <button v-if="can.edit && saveState === 'dirty'" type="button" class="wfb-save-state is-dirty" :aria-label="`Unsaved changes. Save (${mod}+S)`" :title="`Save (${mod}+S)`" @click="emit('save')">
        <Icon icon="lucide:circle-dot" aria-hidden="true" /><span class="wfb-save-state__text">Unsaved changes</span>
      </button>
      <span v-else-if="can.edit" class="wfb-save-state" role="status">
        <span class="wfb-save-state__text">{{ SAVE_TEXT[saveState] }}</span>
      </span>
    </div>

    <div v-if="!compact" class="wfb-toolbar__centre">
      <template v-if="can.edit">
        <button type="button" class="wfb-icon-btn" :disabled="disabled" aria-label="Add a step" title="Add a step (N)" @click="emit('add')"><Icon icon="lucide:plus" aria-hidden="true" /></button>
        <span class="wfb-toolbar__sep" aria-hidden="true"></span>
        <button type="button" class="wfb-icon-btn" :disabled="disabled || !canUndo" :aria-label="undoLabel ? `Undo ${undoLabel}` : 'Undo'" :title="`Undo (${mod}+Z)`" @click="emit('undo')"><Icon icon="lucide:undo-2" aria-hidden="true" /></button>
        <button type="button" class="wfb-icon-btn" :disabled="disabled || !canRedo" :aria-label="redoLabel ? `Redo ${redoLabel}` : 'Redo'" :title="`Redo (${mod}+Shift+Z)`" @click="emit('redo')"><Icon icon="lucide:redo-2" aria-hidden="true" /></button>
        <button type="button" class="wfb-icon-btn" :disabled="disabled" aria-label="Tidy up" title="Tidy up (Shift+Alt+T)" @click="emit('tidy')"><Icon icon="lucide:network" aria-hidden="true" /></button>
      </template>
      <button type="button" class="wfb-icon-btn" :disabled="loading" aria-label="Fit the workflow in view" title="Fit (1)" @click="emit('fit')"><Icon icon="lucide:scan" aria-hidden="true" /></button>
    </div>

    <div class="wfb-toolbar__right">
      <button v-if="!compact && can.run" type="button" class="wfb-btn" :disabled="disabled || running" :title="runBlocked ? 'Test on a photo that stands in for a camera frame' : 'Test the draft without real side effects'" @click="emit('test')">
        <Icon icon="lucide:flask-conical" aria-hidden="true" />Test
      </button>
      <button
        v-if="can.run && !running" type="button" class="wfb-btn is-primary" :class="{ 'is-blocked': !!runBlocked }" :disabled="disabled"
        :aria-disabled="runBlocked ? 'true' : undefined" :aria-describedby="runBlocked && runBlockedBy ? runBlockedBy : undefined"
        :title="runBlocked || `Run (${mod}+Enter)`" @click="emit('run')"
      >
        <Icon icon="lucide:play" aria-hidden="true" />Run
      </button>
      <button v-else-if="can.run" type="button" class="wfb-btn is-stop" :disabled="stopping" @click="emit('stop')">
        <Icon icon="lucide:square" aria-hidden="true" />{{ stopping ? 'Stopping…' : 'Stop' }}
      </button>
      <button v-if="!compact && can.edit" type="button" class="wfb-btn" :disabled="disabled || running" title="Publish the saved draft as the version triggers run" @click="emit('publish')">
        <Icon icon="lucide:upload" aria-hidden="true" />Publish
      </button>
      <DropdownMenuRoot v-model:open="menuOpen">
        <DropdownMenuTrigger class="wfb-icon-btn" aria-label="More workflow actions" title="More">
          <Icon icon="lucide:ellipsis" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent class="wfb-root wfb-layer wfb-menu" align="end" :side-offset="6">
            <template v-if="compact">
              <template v-if="can.edit">
                <DropdownMenuItem class="wfb-menu__item" :disabled="disabled" @select="emit('add')"><Icon icon="lucide:plus" aria-hidden="true" />Add a step</DropdownMenuItem>
                <DropdownMenuItem class="wfb-menu__item" :disabled="disabled || !canUndo" @select="emit('undo')"><Icon icon="lucide:undo-2" aria-hidden="true" />Undo</DropdownMenuItem>
                <DropdownMenuItem class="wfb-menu__item" :disabled="disabled || !canRedo" @select="emit('redo')"><Icon icon="lucide:redo-2" aria-hidden="true" />Redo</DropdownMenuItem>
                <DropdownMenuItem class="wfb-menu__item" :disabled="disabled" @select="emit('tidy')"><Icon icon="lucide:network" aria-hidden="true" />Tidy up</DropdownMenuItem>
              </template>
              <DropdownMenuItem class="wfb-menu__item" :disabled="loading" @select="emit('fit')"><Icon icon="lucide:scan" aria-hidden="true" />Fit the workflow</DropdownMenuItem>
              <DropdownMenuItem v-if="can.run" class="wfb-menu__item" :disabled="disabled || running" @select="emit('test')"><Icon icon="lucide:flask-conical" aria-hidden="true" />Test</DropdownMenuItem>
              <DropdownMenuItem v-if="can.edit" class="wfb-menu__item" :disabled="disabled || running" @select="emit('publish')"><Icon icon="lucide:upload" aria-hidden="true" />Publish</DropdownMenuItem>
              <DropdownMenuSeparator class="wfb-menu__sep" />
            </template>
            <template v-if="can.edit">
              <DropdownMenuItem class="wfb-menu__item" :disabled="disabled || !dirty" @select="emit('save')"><Icon icon="lucide:save" aria-hidden="true" />Save<kbd>{{ mod }}+S</kbd></DropdownMenuItem>
              <DropdownMenuItem class="wfb-menu__item" :disabled="disabled || !dirty" @select="emit('discard')"><Icon icon="lucide:rotate-ccw" aria-hidden="true" />Discard changes</DropdownMenuItem>
              <DropdownMenuItem class="wfb-menu__item" :disabled="disabled" @select="emit('validate')"><Icon icon="lucide:shield-check" aria-hidden="true" />Validate</DropdownMenuItem>
            </template>
            <DropdownMenuItem class="wfb-menu__item" :disabled="loading" @select="emit('versions')"><Icon icon="lucide:history" aria-hidden="true" />Versions</DropdownMenuItem>
            <template v-if="can.edit">
              <DropdownMenuItem v-if="status === 'published'" class="wfb-menu__item" :disabled="disabled" @select="emit('pause')"><Icon icon="lucide:pause" aria-hidden="true" />Pause triggers</DropdownMenuItem>
              <DropdownMenuItem v-else-if="status === 'paused'" class="wfb-menu__item" :disabled="disabled" @select="emit('resume')"><Icon icon="lucide:play" aria-hidden="true" />Resume triggers</DropdownMenuItem>
            </template>
            <DropdownMenuItem v-if="can.share" class="wfb-menu__item" :disabled="loading" @select="emit('share')"><Icon icon="lucide:users" aria-hidden="true" />Share</DropdownMenuItem>
            <DropdownMenuItem class="wfb-menu__item" :disabled="disabled" @select="emit('duplicate')"><Icon icon="lucide:copy" aria-hidden="true" />Duplicate workflow</DropdownMenuItem>
            <DropdownMenuSeparator class="wfb-menu__sep" />
            <DropdownMenuItem class="wfb-menu__item" :disabled="loading" @select="emit('outline')"><Icon icon="lucide:list-tree" aria-hidden="true" />Outline</DropdownMenuItem>
            <DropdownMenuItem class="wfb-menu__item" @select="emit('shortcuts')"><Icon icon="lucide:keyboard" aria-hidden="true" />Shortcuts<kbd>?</kbd></DropdownMenuItem>
            <DropdownMenuItem class="wfb-menu__item" @select="emit('help')"><Icon icon="lucide:circle-help" aria-hidden="true" />Help</DropdownMenuItem>
            <template v-if="can.archive">
              <DropdownMenuSeparator class="wfb-menu__sep" />
              <DropdownMenuItem class="wfb-menu__item is-danger" :disabled="disabled || running" @select="emit('archive')"><Icon icon="lucide:archive" aria-hidden="true" />Archive workflow</DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from 'reka-ui'
import { ROLE_HELP, ROLE_LABELS, workflowAbilities } from '@/utils/workflowAccess'

const props = defineProps({
  name: { type: String, default: '' },
  status: { type: String, default: 'draft' },
  version: { type: Number, default: 1 },
  saveState: { type: String, default: 'saved' },   // loading | error | saving | dirty | saved | conflict
  dirty: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  undoLabel: { type: String, default: '' },
  redoLabel: { type: String, default: '' },
  running: { type: Boolean, default: false },
  stopping: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  mod: { type: String, default: 'Ctrl' },
  // The person's role on this workflow (ADM-1339): 'owner' | 'editor' | 'runner' | 'viewer'.
  role: { type: String, default: 'owner' },
  // Why Run is not offered ('' = it is), and the id of the page's note that says so (ADM-1351, a frame workflow).
  runBlocked: { type: String, default: '' },
  runBlockedBy: { type: String, default: '' },
})
const emit = defineEmits([
  'back', 'rename', 'save', 'discard', 'add', 'undo', 'redo', 'tidy', 'fit', 'test', 'run', 'stop', 'publish',
  'validate', 'versions', 'pause', 'resume', 'duplicate', 'outline', 'shortcuts', 'help', 'archive', 'share',
])

const can = computed(() => workflowAbilities(props.role))
// The owner sees no role pill; anyone the workflow is shared with sees theirs.
const roleText = computed(() => (props.loading || props.role === 'owner' ? '' : ROLE_LABELS[props.role] || ''))
const roleTitle = computed(() => (roleText.value ? `Shared with you as ${roleText.value}. ${ROLE_HELP[props.role] || ''}`.trim() : ''))

const SAVE_TEXT = { loading: 'Loading…', error: 'Not loaded', saving: 'Saving…', saved: 'Saved', conflict: 'Changed elsewhere' }
const statusText = computed(() => {
  if (props.loading || props.saveState === 'error') return ''
  if (props.status === 'published') return `Published v${props.version}`
  if (props.status === 'paused') return 'Paused'
  return 'Draft'
})

const menuOpen = ref(false)
const renaming = ref(false)
const draft = ref('')
const nameInput = ref(null)
function startRename() {
  if (props.disabled || !can.value.edit) return
  draft.value = props.name
  renaming.value = true
  nextTick(() => { nameInput.value?.focus(); nameInput.value?.select() })
}
function commit() {
  if (!renaming.value) return
  renaming.value = false
  const v = draft.value.trim()
  if (v && v !== props.name) emit('rename', v)
}
function cancel() { renaming.value = false }

defineExpose({ startRename })
</script>
