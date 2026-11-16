<template>
  <!-- The Debug Console tab of the bottom panel (ADM-1205 phase F item 17): what the program prints, and expressions
       evaluated in the paused frame, as VS Code's. -->
  <div class="dc">
    <div ref="out" class="dc-out vm-scroll" role="log" aria-live="polite" aria-label="Debug console output">
      <div v-if="!dbg.consoleLines.value.length" class="dc-empty">
        Start debugging from Run and Debug in the sidebar. What the program prints shows here.
      </div>
      <div v-for="(l, i) in dbg.consoleLines.value" :key="i" class="dc-ln" :class="l.kind">
        <span v-if="l.kind === 'in'" class="dc-pfx" aria-hidden="true">›</span>
        <span v-else-if="l.kind === 'result'" class="dc-pfx" aria-hidden="true">‹</span>{{ l.text }}
      </div>
    </div>
    <form class="dc-in" @submit.prevent="send">
      <label for="dc-expr" class="sr-only">Evaluate an expression</label>
      <span class="dc-pfx" aria-hidden="true">›</span>
      <input id="dc-expr" v-model="expr" name="expression" type="text" autocomplete="off" spellcheck="false"
             :disabled="dbg.state.value !== 'paused'"
             :placeholder="dbg.state.value === 'paused' ? 'Evaluate an expression in the selected frame…' : 'Pause the program to evaluate an expression'"
             @keydown.up.prevent="back(1)" @keydown.down.prevent="back(-1)" />
    </form>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, inject } from 'vue'
import { DEBUGGER } from '@/stores/useDebugger'

const dbg = inject(DEBUGGER)
const expr = ref('')
const out = ref(null)
const history = []
let at = -1

function send() {
  const e = expr.value.trim()
  if (!e) return
  history.unshift(e)
  at = -1
  expr.value = ''
  dbg.repl(e)
}
function back(d) {
  at = Math.max(-1, Math.min(history.length - 1, at + d))
  expr.value = at < 0 ? '' : history[at]
}
watch(() => dbg.consoleLines.value.length, () => nextTick(() => { const e = out.value; if (e) e.scrollTop = e.scrollHeight }))
</script>

<style scoped>
.dc { display: flex; flex-direction: column; height: 100%; min-height: 0; font: 12px/1.6 var(--vm-font-mono); }
.dc-out { flex: 1; min-height: 0; overflow: auto; }
.dc-empty { color: var(--vm-ink-faint); font: 13px var(--vm-font-sans); }
.dc-ln { white-space: pre-wrap; word-break: break-word; color: var(--vm-ink-soft); }
.dc-ln.err { color: var(--vm-danger); }
.dc-ln.info { color: var(--vm-ink-faint); font-style: italic; }
.dc-ln.in { color: var(--vm-ink); }
.dc-ln.result { color: color-mix(in srgb, var(--vm-violet) 70%, var(--vm-ink)); }
.dc-pfx { display: inline-block; width: 14px; color: var(--vm-ink-faint); }
.dc-in { display: flex; align-items: center; gap: 2px; border-top: 1px solid var(--vm-line); padding-top: 6px; margin-top: 6px; }
.dc-in input { flex: 1; min-width: 0; min-height: 28px; border: 1px solid var(--vm-line-2); border-radius: 6px; padding: 0 8px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; }
.dc-in input:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -1px; }
.dc-in input:disabled { opacity: .65; cursor: not-allowed; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 640px) { .dc-in input { min-height: 44px; font-size: 16px; } }
</style>
