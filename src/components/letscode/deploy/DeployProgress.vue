<template>
  <section class="pg" aria-labelledby="pg-h">
    <h3 id="pg-h" class="sr-only">Current deployment</h3>

    <!-- Ready: the status bar and the live site -->
    <div v-if="dep.state === 'READY'" class="ready">
      <div class="ready-bar">
        <span class="ready-ok" aria-hidden="true"><Icon icon="lucide:check" /></span>
        <div class="ready-t">
          <b>Ready</b>
          <span>{{ dep.target === 'production' ? 'Live on your production URL' : 'Deployment successful · live preview available' }}</span>
        </div>
        <div v-if="branch" class="ready-cell">
          <span class="lbl"><Icon icon="lucide:git-branch" aria-hidden="true" /> Branch</span>
          <span class="chip mono">{{ branch }}</span>
        </div>
        <div class="ready-cell grow">
          <span class="lbl"><Icon icon="lucide:link" aria-hidden="true" /> {{ dep.target === 'production' ? 'Production URL' : 'Preview URL' }}</span>
          <a class="url" :href="dep.url" target="_blank" rel="noopener noreferrer"><span class="url-t">{{ host }}</span> <Icon icon="lucide:external-link" aria-hidden="true" /></a>
        </div>
        <a class="pbtn primary" :href="dep.url" target="_blank" rel="noopener noreferrer">
          <Icon icon="lucide:external-link" aria-hidden="true" /> {{ dep.target === 'production' ? 'Open site' : 'Open preview' }}
        </a>
      </div>
      <div class="site">
        <div class="site-chrome" aria-hidden="true"><i></i><i></i><i></i><span class="mono">{{ host }}</span></div>
        <iframe :src="dep.url" :title="`Live ${dep.target} of ${projectName}`" loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer"></iframe>
        <p class="site-note">If the site asks you to sign in to Vercel here, open it in a new tab: Vercel protects preview links by default.</p>
      </div>
    </div>

    <!-- Running or stopped: provider, status, the steps -->
    <div v-else class="run">
      <div class="run-top">
        <span class="lbl">Provider</span>
        <span class="chip big"><Icon icon="simple-icons:vercel" aria-hidden="true" /> Vercel</span>
        <span class="sep" aria-hidden="true"></span>
        <span class="lbl">Status</span>
        <span class="chip big state-pill" :class="tone" role="status" aria-live="polite">
          <Icon :icon="tone === 'bad' ? 'lucide:circle-alert' : tone === 'off' ? 'lucide:circle-slash' : 'lucide:loader-2'" :class="{ spin: dep.active }" aria-hidden="true" />
          {{ label }}
        </span>
        <span class="chip target">{{ dep.target === 'production' ? 'Production' : 'Preview' }}</span>
        <span v-if="dep.files_count" class="meta">{{ dep.files_count }} files<template v-if="dep.skipped_paths?.length"> · {{ dep.skipped_paths.length }} secret {{ dep.skipped_paths.length === 1 ? 'file' : 'files' }} kept out</template></span>
      </div>

      <ol class="steps" aria-label="Deployment steps">
        <li v-for="(s, i) in STEPS" :key="s.key" :class="stepClass(i)" :aria-current="i === stepIndex && dep.active ? 'step' : undefined">
          <span class="dot" aria-hidden="true">
            <Icon v-if="stepClass(i) === 'done'" icon="lucide:check" />
            <Icon v-else-if="stepClass(i) === 'bad'" icon="lucide:x" />
          </span>
          <span class="st">{{ s.label }}</span>
          <span class="sm">{{ stepNote(i) }}</span>
        </li>
      </ol>

      <p v-if="dep.error" class="err" role="alert"><Icon icon="lucide:circle-alert" aria-hidden="true" /> {{ dep.error }}</p>
    </div>

    <!-- Terminal: the build log -->
    <div class="term">
      <div class="term-h">
        <span class="mono prompt" aria-hidden="true">&gt;_</span>
        <span class="term-t">Build log</span>
        <span v-if="dep.active" class="live"><i aria-hidden="true"></i> Live logs ({{ label }})</span>
        <button type="button" class="ibtn" :disabled="!lines.length" :aria-label="copied ? 'Copied' : 'Copy the build log'" @click="copy">
          <Icon :icon="copied ? 'lucide:check' : 'lucide:copy'" />
        </button>
      </div>
      <div ref="logEl" class="term-b mono" tabindex="0" aria-label="Build log" aria-live="off">
        <div v-if="!lines.length" class="term-empty">{{ dep.state === 'PREPARING' ? 'Packing and uploading the project files…' : 'Waiting for the build log…' }}</div>
        <div v-for="(l, i) in lines" :key="i" class="ln" :class="{ e: l.type === 'stderr' || /error/i.test(l.text) }">
          <span class="ts">[{{ clock(l.created) }}]</span> {{ l.text }}
        </div>
        <span v-if="dep.active" class="cursor" aria-hidden="true"></span>
      </div>
    </div>

    <details v-if="dep.skipped_paths?.length" class="kept">
      <summary><Icon icon="lucide:shield-check" aria-hidden="true" /> {{ dep.skipped_paths.length }} secret {{ dep.skipped_paths.length === 1 ? 'file was' : 'files were' }} not uploaded</summary>
      <p>Their values belong in the project's environment variables on Vercel.</p>
      <ul><li v-for="p in dep.skipped_paths" :key="p"><code>{{ p }}</code></li></ul>
      <button type="button" class="pbtn" @click="$emit('open-env')"><Icon icon="lucide:key-round" aria-hidden="true" /> Set environment variables</button>
    </details>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  dep: { type: Object, required: true },
  lines: { type: Array, default: () => [] },
  branch: { type: String, default: '' },
  projectName: { type: String, default: '' },
})
defineEmits(['open-env'])

const STEPS = [
  { key: 'upload', label: 'Uploading files' },
  { key: 'queue', label: 'Queued' },
  { key: 'build', label: 'Building application' },
  { key: 'live', label: 'Deploying' },
]
const LABELS = { PREPARING: 'Uploading files', QUEUED: 'Queued', INITIALIZING: 'Starting the build', BUILDING: 'Building',
  READY: 'Ready', ERROR: 'Build failed', FAILED: 'Not deployed', CANCELED: 'Cancelled' }
const label = computed(() => LABELS[props.dep.state] || props.dep.state)
const tone = computed(() => (['ERROR', 'FAILED'].includes(props.dep.state) ? 'bad' : props.dep.state === 'CANCELED' ? 'off' : 'run'))
const host = computed(() => String(props.dep.url || '').replace(/^https?:\/\//, ''))

// Where the deploy is, or where it stopped.
const stepIndex = computed(() => {
  const s = props.dep.state
  if (s === 'PREPARING') return 0
  if (s === 'QUEUED' || s === 'INITIALIZING') return 1
  if (s === 'BUILDING') return 2
  if (s === 'READY') return 4
  return props.dep.has_build ? 2 : 0          // ERROR / FAILED / CANCELED: where it stopped
})
function stepClass(i) {
  if (i < stepIndex.value) return 'done'
  if (i === stepIndex.value) return props.dep.active ? 'now' : (tone.value === 'run' ? 'todo' : 'bad')
  return 'todo'
}
function stepNote(i) {
  const c = stepClass(i)
  if (c === 'now') return 'In progress'
  if (c === 'bad') return tone.value === 'off' ? 'Cancelled' : 'Stopped here'
  if (c === 'done' && i === 0 && props.dep.created_at) return clock(props.dep.created_at)
  return ''
}

function clock(t) {
  if (!t) return ''
  const d = typeof t === 'number' ? new Date(t) : new Date(String(t))
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

// Follow the newest line unless the person scrolled up to read.
const logEl = ref(null)
watch(() => props.lines.length, async () => {
  const el = logEl.value
  const atEnd = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 40
  await nextTick()
  if (atEnd && logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
})

const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(props.lines.map((l) => `[${clock(l.created)}] ${l.text}`).join('\n'))
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch { /* the clipboard is not available here */ }
}
</script>

<style scoped>
.pg { display: flex; flex-direction: column; gap: 16px; --pg-term: #0b0d10; --pg-term-ink: #d7dbe2; --pg-ok: var(--vm-green, #16a34a); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.mono { font-family: var(--vm-font-mono); }
.lbl { display: inline-flex; align-items: center; gap: 5px; font: 500 13px var(--vm-font-sans); color: var(--vm-ink-soft); }
.lbl :deep(svg) { width: 14px; height: 14px; }
.pg .chip { display: inline-flex; flex-direction: row; align-items: center; gap: 7px; min-height: 28px; padding: 0 10px; border: 1px solid var(--vm-line-2); border-radius: 8px; background: var(--vm-surface); font: 600 13px var(--vm-font-sans); color: var(--vm-ink); }
.chip.big { min-height: 36px; padding: 0 13px; font-size: 14px; }
.chip :deep(svg) { width: 14px; height: 14px; }
.chip.state-pill.run { border-color: color-mix(in srgb, var(--vm-violet) 60%, transparent); background: color-mix(in srgb, var(--vm-violet) 14%, var(--vm-surface)); }
.chip.state-pill.bad { border-color: color-mix(in srgb, var(--vm-danger) 55%, transparent); color: var(--vm-danger); }
.chip.state-pill.off { color: var(--vm-ink-soft); }
.chip.target { color: var(--vm-ink-soft); }

.run { display: flex; flex-direction: column; gap: 22px; padding: 18px 20px; border: 1px solid var(--vm-line-2); border-radius: 14px; background: var(--vm-surface-soft); }
.run-top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; }
.sep { width: 1px; height: 26px; background: var(--vm-line-2); margin: 0 4px; }
.meta { margin-left: auto; font-size: 13px; color: var(--vm-ink-soft); }

.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); position: relative; }
.steps li { position: relative; display: flex; flex-direction: column; align-items: center; gap: 7px; text-align: center; }
.steps li::before { content: ''; position: absolute; top: 13px; right: 50%; width: 100%; height: 3px; background: var(--vm-line-2); z-index: 0; }
.steps li:first-child::before { display: none; }
.steps li.done::before, .steps li.now::before, .steps li.bad::before { background: var(--vm-violet); }
.dot { position: relative; z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--vm-line-2); background: var(--vm-surface); color: #fff; }
.dot :deep(svg) { width: 15px; height: 15px; stroke-width: 3; }
.done .dot { background: var(--pg-ok); border-color: var(--pg-ok); }
.now .dot { background: var(--vm-surface); border: 6px solid var(--vm-violet); box-shadow: 0 0 0 4px color-mix(in srgb, var(--vm-violet) 22%, transparent); }
.bad .dot { background: var(--vm-danger); border-color: var(--vm-danger); }
.st { font: 700 13.5px/1.25 var(--vm-font-sans); color: var(--vm-ink); }
.todo .st { color: var(--vm-ink-faint); }
.sm { min-height: 16px; font-size: 12px; color: var(--vm-ink-soft); }
.err { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--vm-danger) 9%, transparent); color: var(--vm-danger); font-size: 13.5px; line-height: 1.45; }
.err :deep(svg) { width: 16px; height: 16px; flex: 0 0 auto; margin-top: 1px; }

.ready { display: flex; flex-direction: column; gap: 14px; }
.ready-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; padding: 14px 16px; border: 1px solid var(--vm-line-2); border-radius: 14px; background: var(--vm-surface-soft); }
.ready-ok { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: 2.5px solid var(--pg-ok); color: var(--pg-ok); }
.ready-ok :deep(svg) { width: 18px; height: 18px; stroke-width: 3; }
.ready-t { display: flex; flex-direction: column; }
.ready-t b { font: 800 16px var(--vm-font-sans); }
.ready-t span { font-size: 12.5px; color: var(--vm-ink-soft); }
.ready-cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding-left: 20px; border-left: 1px solid var(--vm-line-2); }
.ready-cell.grow { flex: 1; }
.url { display: flex; align-items: center; gap: 5px; min-width: 0; max-width: 100%; color: var(--vm-violet); font: 600 14px var(--vm-font-sans); text-decoration: underline; }
.url-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.url :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.site { border: 1px solid var(--vm-line-2); border-radius: 14px; overflow: hidden; background: var(--vm-surface); }
.site-chrome { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--vm-line); background: var(--vm-surface-soft); }
.site-chrome i { width: 10px; height: 10px; border-radius: 50%; background: var(--vm-line-2); }
.site-chrome span { margin-left: 10px; font-size: 12px; color: var(--vm-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.site iframe { display: block; width: 100%; height: min(52vh, 460px); border: 0; background: #fff; }
.site-note { margin: 0; padding: 8px 12px; font-size: 12px; color: var(--vm-ink-soft); border-top: 1px solid var(--vm-line); }

.term { border: 1px solid #262a30; border-radius: 12px; overflow: hidden; background: var(--pg-term); color: var(--pg-term-ink); }
.term-h { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid #262a30; font: 600 13.5px var(--vm-font-sans); }
.prompt { color: #8b919b; }
.live { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; font: 500 12.5px var(--vm-font-sans); color: #a3a9b3; }
.live i { width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; animation: pulse 1.4s ease-in-out infinite; }
.term-h .ibtn { margin-left: auto; }
.live + .ibtn { margin-left: 4px; }
.ibtn { display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 7px; background: transparent; color: #a3a9b3; cursor: pointer; }
.ibtn:hover:not(:disabled) { background: #1b1f25; color: #fff; }
.ibtn:disabled { opacity: .4; cursor: not-allowed; }
.ibtn:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.ibtn :deep(svg) { width: 15px; height: 15px; }
.term-b { max-height: 260px; min-height: 130px; overflow: auto; padding: 12px 14px; font-size: 12.5px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.term-b:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: -2px; }
.ts { color: #6b717c; }
.ln.e { color: #fca5a5; }
.term-empty { color: #8b919b; }
.cursor { display: inline-block; width: 8px; height: 15px; margin-top: 4px; background: var(--pg-term-ink); animation: blink 1s steps(1) infinite; }

.kept { padding: 12px 14px; border: 1px dashed color-mix(in srgb, var(--vm-amber) 55%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--vm-amber) 7%, transparent); font-size: 13px; color: var(--vm-ink-soft); }
.kept summary { display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; color: var(--vm-ink); }
.kept summary :deep(svg) { width: 16px; height: 16px; color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.kept summary:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.kept p { margin: 8px 0 4px; }
.kept ul { margin: 0 0 10px; padding-left: 20px; }
.kept code { font: 12px var(--vm-font-mono); color: var(--vm-ink); }

.pbtn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 0 14px; border: 1px solid var(--vm-line-2); border-radius: var(--vm-r); background: var(--vm-surface); color: var(--vm-ink); font: 600 13px var(--vm-font-sans); text-decoration: none; cursor: pointer; transition: border-color .15s, background-color .15s; }
.pbtn:hover { border-color: var(--vm-violet); background: var(--vm-violet-soft); }
.pbtn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.pbtn.primary:hover { background: var(--vm-violet-d); border-color: var(--vm-violet-d); }
.pbtn:focus-visible, .url:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 2px; }
.pbtn :deep(svg) { width: 15px; height: 15px; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 50% { opacity: .35; } }
@keyframes blink { 50% { opacity: 0; } }

@media (max-width: 640px) {
  .steps { grid-template-columns: 1fr; gap: 10px; }
  .steps li { flex-direction: row; text-align: left; gap: 10px; }
  .steps li::before { display: none; }
  .sm { margin-left: auto; }
  .ready-cell { padding-left: 0; border-left: none; }
  .pbtn { min-height: 44px; }
  .meta { margin-left: 0; width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .spin, .live i, .cursor { animation: none; } }
</style>
