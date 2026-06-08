<!--
  ActivityStep — one transcript row: status icon + label + duration, and (when it has
  content) an expandable body rendered by `kind`:
    thinking → reasoning text · bash → $cmd + IN/OUT · read → file snippet ·
    edit/write → diff/code · search → matches · http → request/response · generic → I/O.
  Presentational only; driven by the step object from activityStream.js.
-->
<template>
  <div class="border-b border-gray-100 last:border-b-0" :class="{ 'opacity-30': step.status === 'pending' }">
    <!-- header -->
    <div class="flex items-start gap-2.5 py-1.5"
         :class="hasBody ? 'cursor-pointer hover:bg-slate-50/70 rounded -mx-1 px-1' : ''"
         @click="hasBody && (open = !open)">
      <span class="mt-0.5 shrink-0">
        <span v-if="step.status === 'running'" class="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-200 border-t-indigo-500 animate-spin"></span>
        <span v-else-if="step.status === 'pending_approval'" class="inline-block w-3.5 h-3.5 rounded-full bg-amber-400 animate-pulse" title="Waiting for your approval"></span>
        <svg v-else-if="step.status === 'done' || step.status === 'approved'" class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z" clip-rule="evenodd"/></svg>
        <svg v-else-if="step.status === 'blocked' || step.status === 'rejected'" class="w-3.5 h-3.5 text-amber-600" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM4.6 5.7l9.7 9.7a6.5 6.5 0 0 1-9.7-9.7Zm1.1-1.1a6.5 6.5 0 0 1 9.7 9.7L5.7 4.6Z" clip-rule="evenodd"/></svg>
        <svg v-else-if="step.status === 'error'" class="w-3.5 h-3.5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM8.7 7.3a1 1 0 0 0-1.4 1.4L8.6 10l-1.3 1.3a1 1 0 1 0 1.4 1.4L10 11.4l1.3 1.3a1 1 0 0 0 1.4-1.4L11.4 10l1.3-1.3a1 1 0 0 0-1.4-1.4L10 8.6 8.7 7.3Z" clip-rule="evenodd"/></svg>
        <span v-else class="inline-block w-3 h-3 rounded-full border-[1.5px] border-gray-300"></span>
      </span>

      <div class="flex-1 min-w-0">
        <div class="text-[13px] leading-tight flex items-center gap-1.5" :class="statusTextClass(step.status)">
          <span class="truncate">{{ step.label }}</span>
          <span v-if="step.exitCode != null" class="text-[9px] font-bold px-1.5 rounded shrink-0"
                :class="step.exitCode === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'">exit {{ step.exitCode }}</span>
          <span v-if="step.status === 'pending_approval'" class="text-[10px] font-semibold uppercase tracking-wide text-amber-600">pending approval</span>
          <span v-else-if="step.status === 'blocked'" class="text-[10px] font-semibold uppercase tracking-wide text-amber-700">blocked</span>
          <span v-else-if="step.status === 'rejected'" class="text-[10px] font-semibold uppercase tracking-wide text-red-600">rejected</span>
        </div>
        <div v-if="step.error" class="mt-0.5 text-[11px] text-red-500/90 font-mono break-words">{{ step.error }}</div>
      </div>

      <span class="text-[11px] text-gray-400 shrink-0 mt-0.5 flex items-center gap-1">
        <span v-if="step.status === 'running'">…</span>
        <span v-else-if="secs != null">{{ secs.toFixed(1) }}s</span>
        <span v-if="hasBody" class="text-gray-300">{{ open ? '▾' : '▸' }}</span>
      </span>
    </div>

    <!-- expandable body -->
    <div v-if="open && hasBody" class="pl-6 pr-1 pb-2">
      <!-- thinking -->
      <div v-if="step.thinkingText" class="text-[12px] text-gray-500 italic leading-relaxed whitespace-pre-wrap break-words">{{ step.thinkingText }}</div>

      <!-- bash / terminal: dark block, command in sky, stderr / error lines in red -->
      <div v-else-if="step.kind === 'bash'" class="text-[11.5px] font-mono leading-relaxed bg-slate-900 rounded-lg p-2.5 overflow-auto max-h-60">
        <div v-if="cmd" class="text-sky-300 whitespace-pre-wrap break-words"><span>$ </span>{{ cmd }}</div>
        <div v-for="(ln, i) in termLines" :key="i" :class="ln.cls" class="whitespace-pre-wrap break-words">{{ ln.text }}</div>
      </div>

      <!-- edit / write: diff when it looks like one, else code -->
      <template v-else-if="step.kind === 'edit' || step.kind === 'write'">
        <div v-if="diffLines" class="text-[11.5px] font-mono leading-relaxed bg-slate-900 rounded-lg p-2.5 overflow-auto max-h-60">
          <div v-for="(ln, i) in diffLines" :key="i" :class="ln.cls" class="whitespace-pre-wrap break-words">{{ ln.text }}</div>
        </div>
        <pre v-else class="text-[11.5px] font-mono bg-slate-50 border border-gray-100 rounded-lg p-2.5 overflow-auto max-h-60 whitespace-pre-wrap break-words">{{ bodyText }}</pre>
      </template>

      <!-- http -->
      <template v-else-if="step.kind === 'http'">
        <div class="text-[10px] uppercase text-gray-400">request</div>
        <pre class="text-[11.5px] font-mono bg-slate-50 border border-gray-100 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap break-words">{{ httpReq }}</pre>
        <div v-if="step.output" class="text-[10px] uppercase text-gray-400 mt-1.5">response</div>
        <pre v-if="step.output" class="text-[11.5px] font-mono bg-slate-50 border border-gray-100 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-words">{{ step.output }}</pre>
      </template>

      <!-- read / search / generic -->
      <template v-else>
        <div v-if="inputText" class="text-[10px] uppercase text-gray-400">input</div>
        <pre v-if="inputText" class="text-[11.5px] font-mono bg-slate-50 border border-gray-100 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap break-words">{{ inputText }}</pre>
        <div v-if="step.output" class="text-[10px] uppercase text-gray-400" :class="{ 'mt-1.5': inputText }">output</div>
        <pre v-if="step.output" class="text-[11.5px] font-mono bg-slate-50 border border-gray-100 rounded p-2 overflow-auto max-h-60 whitespace-pre-wrap break-words">{{ step.output }}</pre>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { stepSeconds } from '../../composables/activityStream'

const props = defineProps({ step: { type: Object, required: true } })
const open = ref(false)

const secs = computed(() => stepSeconds(props.step))

function asText(x) {
  if (x == null) return ''
  if (typeof x === 'string') return x
  try { return JSON.stringify(x, null, 2) } catch { return String(x) }
}

const cmd = computed(() => {
  const i = props.step.input || {}
  return i.command || i.cmd || i.script || ''
})

// Terminal output split into lines, with stderr / error-looking lines colored red (the rest light).
const ERR_RE = /\b(error|exception|traceback|failed|fatal|modulenotfounderror)\b|no module named|^e\s/i
const termLines = computed(() => {
  const s = props.step
  const lines = []
  const push = (text, red) => lines.push({ text, cls: red ? 'text-red-300' : 'text-slate-100' })
  if (s.stderr != null || (s.stdout != null && s.stdout !== '')) {
    String(s.stdout || '').split('\n').forEach((l) => { if (l !== '') push(l, ERR_RE.test(l)) })
    String(s.stderr || '').split('\n').forEach((l) => { if (l !== '') push(l, true) }) // stderr always red
  } else {
    const out = s.output || ''
    if (out) out.split('\n').forEach((l) => push(l, ERR_RE.test(l)))
  }
  return lines
})
const httpReq = computed(() => {
  const i = props.step.input || {}
  const m = (i.method || 'GET').toString().toUpperCase()
  const u = i.url || i.endpoint || ''
  return u ? `${m} ${u}` : asText(i)
})
const inputText = computed(() => {
  const i = props.step.input
  if (i == null) return ''
  // For read/search the path/query is already in the label; show the raw args only when
  // they add detail (objects), keep it short.
  if (typeof i === 'string') return i
  const t = asText(i)
  return t === '{}' ? '' : t
})
const bodyText = computed(() => props.step.output || asText(props.step.input?.content) || asText(props.step.input))

// Render a unified-diff-looking output with +/- coloring.
const diffLines = computed(() => {
  const out = props.step.output || ''
  if (!out || !/^[-+]/m.test(out)) return null
  return out.split('\n').map((text) => {
    let cls = 'text-slate-400'
    if (/^\+(?!\+\+)/.test(text)) cls = 'text-emerald-300'
    else if (/^-(?!--)/.test(text)) cls = 'text-red-300'
    else if (/^@@/.test(text)) cls = 'text-sky-300'
    return { text, cls }
  })
})

const hasBody = computed(() => {
  const s = props.step
  return !!(s.thinkingText || s.output || (s.phase === 'tool' && (cmd.value || inputText.value || httpReq.value)))
})

function statusTextClass(status) {
  if (status === 'running') return 'text-gray-900 font-medium'
  if (status === 'pending_approval') return 'text-amber-700 font-medium'
  if (status === 'blocked') return 'text-amber-700'
  if (status === 'error' || status === 'rejected') return 'text-red-600'
  return 'text-gray-500'
}
</script>
