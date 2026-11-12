<template>
  <!-- The Problems and References tabs of the bottom panel (ADM-1205 phase F item 16): what the project's language
       servers report, Check project's tsc run, and Find All References. A row opens its file at the place. -->
  <div class="pp">
    <template v-if="mode === 'problems'">
      <div class="pp-bar">
        <span class="pp-sum" role="status" aria-live="polite">
          <Icon icon="lucide:circle-x" class="pp-ic error" aria-hidden="true" /> {{ store.counts.value.errors }}
          <Icon icon="lucide:triangle-alert" class="pp-ic warning" aria-hidden="true" /> {{ store.counts.value.warnings }}
          <span class="pp-servers">{{ serversText }}</span>
        </span>
        <button type="button" class="pp-btn" :disabled="store.checking.value" @click="store.check()">
          <Icon :icon="store.checking.value ? 'lucide:loader' : 'lucide:list-checks'" :class="{ spin: store.checking.value }" aria-hidden="true" />
          {{ store.checking.value ? 'Checking the project…' : 'Check project' }}
        </button>
      </div>
      <p v-if="store.checkError.value" class="pp-note err" role="alert">{{ store.checkError.value }}</p>
      <p v-if="serverError" class="pp-note err" role="alert">{{ serverError }}</p>
      <div v-if="!groups.length" class="pp-empty">
        No problems. Open a TypeScript, JavaScript or Python file to start its language server, or check the whole
        project.
      </div>
      <div v-for="g in groups" :key="g.path" class="pp-group">
        <div class="pp-file"><Icon icon="lucide:file-code" aria-hidden="true" /> {{ g.path }} <span class="pp-n">{{ g.items.length }}</span></div>
        <button v-for="(p, i) in g.items" :key="i" type="button" class="pp-row" :title="`Open ${g.path} at line ${p.line}`" @click="store.open(p)">
          <Icon :icon="ICON[p.severity] || ICON.error" class="pp-ic" :class="p.severity" aria-hidden="true" />
          <span class="pp-msg">{{ p.message }}</span>
          <span class="pp-meta">{{ p.source }}{{ p.code ? `(${p.code})` : '' }} [{{ p.line }}, {{ p.column }}]</span>
        </button>
      </div>
    </template>
    <template v-else>
      <div class="pp-bar">
        <span class="pp-sum" role="status" aria-live="polite">
          <template v-if="refs.loading">Finding the references of {{ refs.query }}…</template>
          <template v-else-if="refs.query">{{ refs.items.length }} {{ refs.items.length === 1 ? 'reference' : 'references' }} to <code>{{ refs.query }}</code></template>
          <template v-else>Put the cursor on a name in the editor and press Shift+F12.</template>
        </span>
      </div>
      <p v-if="refs.error" class="pp-note err" role="alert">{{ refs.error }}</p>
      <button v-for="(r, i) in refs.items" :key="i" type="button" class="pp-row" @click="store.open(r)">
        <Icon icon="lucide:corner-down-right" class="pp-ic" aria-hidden="true" />
        <span class="pp-msg">{{ r.path }}</span>
        <span class="pp-meta">[{{ r.line }}, {{ r.column }}]</span>
      </button>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { Icon } from '@iconify/vue'
import { LANGUAGE_SERVERS } from '@/stores/useLanguageServers'

defineProps({ mode: { type: String, default: 'problems' } })   // 'problems' | 'references'
const store = inject(LANGUAGE_SERVERS)

const ICON = { error: 'lucide:circle-x', warning: 'lucide:triangle-alert', info: 'lucide:info', hint: 'lucide:lightbulb' }
const NAMES = { typescript: 'TypeScript', python: 'Python' }
const STATES = { connecting: 'connecting', installing: 'installing (first time, about a minute)', starting: 'starting',
  initializing: 'starting', ready: 'ready', error: 'not running', closed: 'stopped', exited: 'stopped' }

const groups = computed(() => {
  const by = new Map()
  for (const p of store.problems.value) {
    if (!by.has(p.path)) by.set(p.path, [])
    by.get(p.path).push(p)
  }
  return [...by].map(([path, items]) => ({ path, items }))
})
const serversText = computed(() => Object.entries(store.servers)
  .map(([lang, s]) => `${NAMES[lang] || lang}: ${STATES[s.state] || s.state}`).join(' · '))
const serverError = computed(() => Object.values(store.servers).map((s) => s.error).filter(Boolean)[0] || '')
const refs = computed(() => store.references.value)
</script>

<style scoped>
.pp { display: flex; flex-direction: column; gap: 4px; font: 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); }
.pp-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding-bottom: 6px; }
.pp-sum { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pp-sum code { font-family: var(--vm-font-mono); color: var(--vm-ink); }
.pp-servers { color: var(--vm-ink-faint); margin-left: 6px; }
.pp-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 10px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12px var(--vm-font-sans); cursor: pointer; }
.pp-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.pp-btn:disabled { cursor: progress; opacity: .75; }
.pp-btn:focus-visible, .pp-row:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -2px; }
.pp-btn :deep(svg) { width: 14px; height: 14px; }
.pp-note { margin: 0; font-size: 12px; }
.pp-note.err { color: var(--vm-danger); }
.pp-empty { color: var(--vm-ink-faint); font-size: 13px; padding: 4px 0; }
.pp-file { display: flex; align-items: center; gap: 6px; padding: 6px 0 2px; font-weight: 600; color: var(--vm-ink); word-break: break-all; }
.pp-file :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; }
.pp-n { font-weight: 500; color: var(--vm-ink-faint); }
.pp-row { display: flex; align-items: flex-start; gap: 8px; width: 100%; padding: 3px 6px 3px 20px; border: none; border-radius: 5px; background: transparent; color: var(--vm-ink-soft); font: inherit; text-align: left; cursor: pointer; }
.pp-row:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.pp-msg { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-word; }
.pp-meta { flex: 0 0 auto; color: var(--vm-ink-faint); font-family: var(--vm-font-mono); font-size: 11.5px; }
.pp-ic { width: 14px; height: 14px; flex: 0 0 auto; margin-top: 2px; }
.pp-ic.error { color: var(--vm-danger); }
.pp-ic.warning { color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.pp-ic.info, .pp-ic.hint { color: var(--vm-blue, var(--vm-violet)); }
.spin { animation: pp-spin 1s linear infinite; } @keyframes pp-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
@media (max-width: 640px) { .pp-btn, .pp-row { min-height: 44px; } }
</style>
