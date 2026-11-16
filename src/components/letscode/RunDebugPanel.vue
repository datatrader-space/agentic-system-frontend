<template>
  <!-- Run and Debug (ADM-1205 phase F item 17; agentic-docs/LETS_CODE_DEBUGGER_PLAN.md), as VS Code's view: what to
       start, the controls, Variables, Watch, Call stack and Breakpoints. -->
  <div class="rd">
    <div class="rd-start">
      <label for="rd-config" class="sr-only">What to run</label>
      <select id="rd-config" v-model="dbg.selectedConfig.value" class="rd-select" :disabled="dbg.running.value" name="configuration">
        <option v-if="!dbg.configs.value.length" value="">Open a Python or JavaScript file</option>
        <option v-for="c in dbg.configs.value" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>
      <button v-if="!dbg.running.value" type="button" class="rd-go" :disabled="!dbg.configs.value.length"
              title="Start debugging (F5)" @click="dbg.start()">
        <Icon icon="lucide:play" aria-hidden="true" /> Start
      </button>
      <button type="button" class="rd-icon" title="Read package.json and .vscode/launch.json again" aria-label="Refresh the list of what can run"
              :disabled="dbg.running.value" @click="dbg.loadConfigs()">
        <Icon icon="lucide:refresh-cw" aria-hidden="true" />
      </button>
    </div>

    <div v-if="dbg.running.value" class="rd-bar" role="toolbar" aria-label="Debug controls">
      <button v-if="dbg.state.value === 'paused'" type="button" class="rd-icon" title="Continue (F5)" aria-label="Continue" @click="dbg.step('continue')"><Icon icon="lucide:play" aria-hidden="true" /></button>
      <button v-else type="button" class="rd-icon" title="Pause (F6)" aria-label="Pause" :disabled="dbg.state.value !== 'running'" @click="dbg.step('pause')"><Icon icon="lucide:pause" aria-hidden="true" /></button>
      <button type="button" class="rd-icon" title="Step over (F10)" aria-label="Step over" :disabled="!paused" @click="dbg.step('next')"><Icon icon="lucide:redo-dot" aria-hidden="true" /></button>
      <button type="button" class="rd-icon" title="Step into (F11)" aria-label="Step into" :disabled="!paused" @click="dbg.step('stepIn')"><Icon icon="lucide:arrow-down-to-dot" aria-hidden="true" /></button>
      <button type="button" class="rd-icon" title="Step out (Shift+F11)" aria-label="Step out" :disabled="!paused" @click="dbg.step('stepOut')"><Icon icon="lucide:arrow-up-from-dot" aria-hidden="true" /></button>
      <button type="button" class="rd-icon" title="Restart (Ctrl+Shift+F5)" aria-label="Restart" @click="dbg.restart()"><Icon icon="lucide:rotate-ccw" aria-hidden="true" /></button>
      <button type="button" class="rd-icon stop" title="Stop (Shift+F5)" aria-label="Stop" @click="dbg.stop()"><Icon icon="lucide:square" aria-hidden="true" /></button>
    </div>

    <p class="rd-state" role="status" aria-live="polite">{{ stateText }}</p>
    <p v-if="dbg.error.value" class="rd-err" role="alert">{{ dbg.error.value }}</p>

    <section class="rd-sec" aria-labelledby="rd-vars">
      <h3 id="rd-vars" class="rd-h">Variables</h3>
      <div v-if="!rows.length" class="rd-empty">{{ paused ? 'No variables in this frame.' : 'Shown when the program is paused.' }}</div>
      <div v-for="r in rows" :key="r.key" class="rd-var" :style="{ paddingLeft: 6 + r.depth * 14 + 'px' }">
        <button v-if="r.node.ref" type="button" class="rd-tw" :aria-expanded="r.node.open ? 'true' : 'false'"
                :aria-label="`${r.node.open ? 'Close' : 'Open'} ${r.node.name}`" @click="dbg.expand(r.node)">
          <Icon :icon="r.node.open ? 'lucide:chevron-down' : 'lucide:chevron-right'" aria-hidden="true" />
        </button>
        <span v-else class="rd-tw-pad" />
        <span :class="r.depth ? 'rd-name' : 'rd-scope'">{{ r.node.name }}</span>
        <template v-if="r.depth"><span class="rd-eq">=</span><span class="rd-val" :title="r.node.type || undefined">{{ r.node.value }}</span></template>
      </div>
    </section>

    <section class="rd-sec" aria-labelledby="rd-watch">
      <h3 id="rd-watch" class="rd-h">Watch</h3>
      <div v-for="(w, i) in dbg.watches.value" :key="i" class="rd-var">
        <span class="rd-name">{{ w.expr }}</span><span class="rd-eq">=</span>
        <span class="rd-val" :class="{ err: w.error }">{{ w.error || w.value || (paused ? '' : 'not available') }}</span>
        <button type="button" class="rd-x" :aria-label="`Remove the watch ${w.expr}`" @click="dbg.removeWatch(i)"><Icon icon="lucide:x" aria-hidden="true" /></button>
      </div>
      <form class="rd-add" @submit.prevent="addWatch">
        <label for="rd-watch-in" class="sr-only">Add an expression to watch</label>
        <input id="rd-watch-in" v-model="watchExpr" name="watch" type="text" autocomplete="off" spellcheck="false" placeholder="Add an expression to watch…" />
      </form>
    </section>

    <section class="rd-sec" aria-labelledby="rd-stack">
      <h3 id="rd-stack" class="rd-h">Call stack</h3>
      <div v-if="!dbg.frames.value.length" class="rd-empty">{{ dbg.running.value ? 'Running.' : 'Not running.' }}</div>
      <button v-for="f in dbg.frames.value" :key="f.id" type="button" class="rd-frame"
              :class="{ on: dbg.selectedFrame.value && dbg.selectedFrame.value.id === f.id, ext: !f.path }"
              :title="f.path ? `Open ${f.path} at line ${f.line}` : 'Outside the project'" @click="dbg.selectFrame(f)">
        <span class="rd-fn">{{ f.name }}</span>
        <span class="rd-loc">{{ f.path || f.source || '' }}:{{ f.line }}</span>
      </button>
    </section>

    <section class="rd-sec" aria-labelledby="rd-bps">
      <h3 id="rd-bps" class="rd-h">Breakpoints</h3>
      <div v-if="!dbg.breakpointList.value.length" class="rd-empty">Click left of a line number in the editor, or press F9, to add one.</div>
      <div v-for="b in dbg.breakpointList.value" :key="`${b.path}:${b.line}`" class="rd-bp">
        <div class="rd-bp-row">
          <span class="rd-dot" :class="{ cond: b.condition || b.hitCondition, log: b.logMessage, off: b.verified === false }" aria-hidden="true" />
          <button type="button" class="rd-bp-open" :title="`Open ${b.path} at line ${b.line}`" @click="dbg.open(b)">{{ b.path }}:{{ b.line }}</button>
          <button type="button" class="rd-x" :aria-label="`Edit the breakpoint at ${b.path} line ${b.line}`" :aria-expanded="editing === key(b) ? 'true' : 'false'" @click="edit(b)"><Icon icon="lucide:pencil" aria-hidden="true" /></button>
          <button type="button" class="rd-x" :aria-label="`Remove the breakpoint at ${b.path} line ${b.line}`" @click="dbg.toggleBreakpoint(b.path, b.line)"><Icon icon="lucide:x" aria-hidden="true" /></button>
        </div>
        <span v-if="b.verified === false" class="rd-note">The debugger could not set this breakpoint.</span>
        <form v-if="editing === key(b)" class="rd-bp-edit" @submit.prevent="save(b)">
          <label :for="`c-${key(b)}`">Stop only when</label>
          <input :id="`c-${key(b)}`" v-model="form.condition" name="condition" type="text" autocomplete="off" spellcheck="false" placeholder="an expression, e.g. total > 10" />
          <label :for="`h-${key(b)}`">Stop after hits</label>
          <input :id="`h-${key(b)}`" v-model="form.hitCondition" name="hitCondition" type="text" autocomplete="off" spellcheck="false" placeholder="e.g. 3" />
          <label :for="`l-${key(b)}`">Log instead of stopping</label>
          <input :id="`l-${key(b)}`" v-model="form.logMessage" name="logMessage" type="text" autocomplete="off" spellcheck="false" placeholder="a message; {expression} is filled in" />
          <div class="rd-bp-acts">
            <button type="submit" class="rd-go">Save</button>
            <button type="button" class="rd-plain" @click="editing = ''">Cancel</button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject } from 'vue'
import { Icon } from '@iconify/vue'
import { DEBUGGER } from '@/stores/useDebugger'

const dbg = inject(DEBUGGER)
const paused = computed(() => dbg.state.value === 'paused')
const ADAPTER_STATES = { connecting: 'Connecting to the project’s sandbox…', installing: 'Installing the debugger (the first time takes a minute)…', starting: 'Starting the debugger…' }
const stateText = computed(() => {
  const s = dbg.state.value
  if (s === 'starting') return ADAPTER_STATES[dbg.adapterState.value] || 'Starting…'
  if (s === 'running') return 'Running.'
  if (s === 'paused') { const f = dbg.selectedFrame.value; return f ? `Paused in ${f.name} at line ${f.line}.` : 'Paused.' }
  if (s === 'ended') return 'The debug session ended.'
  if (s === 'error') return 'The debugger stopped.'
  return 'Not running.'
})

// The variables tree, flattened into rows: a scope, then its opened children.
const rows = computed(() => {
  const out = []
  const walk = (nodes, depth, prefix) => nodes.forEach((n, i) => {
    const key = `${prefix}${i}`
    out.push({ node: n, depth, key })
    if (n.open && n.children) walk(n.children, depth + 1, `${key}.`)
  })
  walk(dbg.scopes.value, 0, '')
  return out
})

const watchExpr = ref('')
function addWatch() { dbg.addWatch(watchExpr.value); watchExpr.value = '' }

const key = (b) => `${b.path}:${b.line}`
const editing = ref('')
const form = reactive({ condition: '', hitCondition: '', logMessage: '' })
function edit(b) {
  if (editing.value === key(b)) { editing.value = ''; return }
  Object.assign(form, { condition: b.condition || '', hitCondition: b.hitCondition || '', logMessage: b.logMessage || '' })
  editing.value = key(b)
}
function save(b) {
  dbg.updateBreakpoint(b.path, b.line, { condition: form.condition.trim(), hitCondition: form.hitCondition.trim(), logMessage: form.logMessage.trim() })
  editing.value = ''
}
</script>

<style scoped>
.rd { display: flex; flex-direction: column; gap: 8px; padding: 8px; font: 12.5px var(--vm-font-sans); color: var(--vm-ink-soft); }
.rd-start { display: flex; align-items: center; gap: 4px; }
.rd-select { flex: 1; min-width: 0; min-height: 30px; border: 1px solid var(--vm-line-2); border-radius: 7px; padding: 0 6px; background: var(--vm-surface); color: var(--vm-ink); font: inherit; }
.rd-go { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding: 0 10px; border: none; border-radius: 7px; background: var(--vm-violet); color: #fff; font: 600 12px var(--vm-font-sans); cursor: pointer; }
.rd-go:hover:not(:disabled) { filter: brightness(1.08); }
.rd-go:disabled { opacity: .5; cursor: not-allowed; }
.rd-plain { min-height: 30px; padding: 0 10px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: transparent; color: var(--vm-ink); font: 600 12px var(--vm-font-sans); cursor: pointer; }
.rd-icon, .rd-x, .rd-tw { display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; flex: 0 0 auto; }
.rd-x, .rd-tw { width: 22px; height: 22px; }
.rd-icon:hover:not(:disabled), .rd-x:hover, .rd-tw:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.rd-icon:disabled { opacity: .4; cursor: not-allowed; }
.rd-icon.stop { color: var(--vm-danger); }
.rd-icon :deep(svg), .rd-go :deep(svg) { width: 15px; height: 15px; }
.rd-x :deep(svg), .rd-tw :deep(svg) { width: 13px; height: 13px; }
.rd-tw-pad { width: 22px; flex: 0 0 auto; }
.rd-bar { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--vm-line); border-radius: 8px; align-self: flex-start; }
.rd-state { margin: 0; color: var(--vm-ink); }
.rd-err { margin: 0; color: var(--vm-danger); font-size: 12px; white-space: pre-wrap; }
.rd-sec { border-top: 1px solid var(--vm-line); padding-top: 6px; }
.rd-h { margin: 0 0 4px; font: 700 11px var(--vm-font-sans); letter-spacing: .04em; text-transform: uppercase; color: var(--vm-ink-faint); }
.rd-empty { color: var(--vm-ink-faint); font-size: 12px; padding: 2px 0; }
.rd-var { display: flex; align-items: center; gap: 4px; min-height: 22px; font: 12px var(--vm-font-mono); }
.rd-scope { font: 600 12px var(--vm-font-sans); color: var(--vm-ink); }
.rd-name { color: color-mix(in srgb, var(--vm-violet) 70%, var(--vm-ink)); white-space: nowrap; }
.rd-eq { color: var(--vm-ink-faint); }
.rd-val { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink); }
.rd-val.err { color: var(--vm-danger); }
.rd-add input, .rd-bp-edit input { width: 100%; min-height: 26px; margin-top: 2px; border: 1px solid var(--vm-line-2); border-radius: 6px; padding: 0 6px; background: var(--vm-surface); color: var(--vm-ink); font: 12px var(--vm-font-mono); box-sizing: border-box; }
.rd-frame { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 3px 6px; border: none; border-radius: 5px; background: transparent; color: var(--vm-ink); font: 12px var(--vm-font-mono); text-align: left; cursor: pointer; }
.rd-frame:hover { background: var(--vm-surface-soft); }
.rd-frame.on { background: color-mix(in srgb, var(--vm-amber) 18%, transparent); }
.rd-frame.ext { color: var(--vm-ink-faint); }
.rd-fn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rd-loc { flex: 0 0 auto; color: var(--vm-ink-faint); }
.rd-bp { padding: 2px 0; }
.rd-bp-row { display: flex; align-items: center; gap: 4px; }
.rd-dot { width: 10px; height: 10px; border-radius: 50%; background: #e51400; flex: 0 0 auto; margin: 0 4px; }
.rd-dot.cond { background: #e51400; box-shadow: inset 0 0 0 2px #fff; border: 1px solid #e51400; }
.rd-dot.log { border-radius: 2px; transform: rotate(45deg); width: 9px; height: 9px; }
.rd-dot.off { background: transparent; border: 1.5px solid var(--vm-ink-faint); box-shadow: none; }
.rd-bp-open { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: none; background: transparent; padding: 2px 0; color: var(--vm-ink); font: 12px var(--vm-font-mono); text-align: left; cursor: pointer; }
.rd-bp-open:hover { text-decoration: underline; }
.rd-note { display: block; padding-left: 22px; color: var(--vm-ink-faint); font-size: 11.5px; }
.rd-bp-edit { display: flex; flex-direction: column; gap: 2px; padding: 6px 0 4px 22px; }
.rd-bp-edit label { font-size: 11.5px; color: var(--vm-ink-faint); margin-top: 4px; }
.rd-bp-acts { display: flex; gap: 6px; margin-top: 6px; }
.rd button:focus-visible, .rd select:focus-visible, .rd input:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -1px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 640px) {
  .rd-icon, .rd-go, .rd-plain, .rd-select { min-height: 44px; }
  .rd-icon { width: 44px; height: 44px; }
  .rd-x, .rd-tw { width: 36px; height: 36px; }
  .rd-add input, .rd-bp-edit input { min-height: 44px; font-size: 16px; }
}
</style>
