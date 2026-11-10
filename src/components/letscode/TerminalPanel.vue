<template>
  <!-- The Terminal tab of a Let's Code project (ADM-1196, Phase 3): "Coding Agent" shows the commands the agent
       ran; up to three of the person's own shells in the project's sandbox, each kept running when the page is
       left (it reattaches) and ended by its close button. -->
  <div class="tp">
    <div class="tp-tabs" role="tablist" aria-label="Terminals">
      <button type="button" role="tab" class="tp-tab" :class="{ on: current === 'agent' }"
              :aria-selected="current === 'agent' ? 'true' : 'false'" @click="current = 'agent'">
        <Icon icon="lucide:sparkles" aria-hidden="true" /> Coding Agent
        <span v-if="agentCommands.length" class="tp-count">{{ agentCommands.length }}</span>
      </button>
      <div v-for="n in shells" :key="n" class="tp-tabwrap" :class="{ on: current === n }">
        <button type="button" role="tab" class="tp-tab" :aria-selected="current === n ? 'true' : 'false'" @click="current = n">
          <Icon icon="lucide:square-terminal" aria-hidden="true" /> Terminal {{ n }}
        </button>
        <button type="button" class="tp-x" :aria-label="`End terminal ${n}`" title="End this terminal" @click="endShell(n)">
          <Icon icon="lucide:x" aria-hidden="true" />
        </button>
      </div>
      <button v-if="shells.length < MAX" type="button" class="tp-add" aria-label="New terminal" title="New terminal" @click="addShell">
        <Icon icon="lucide:plus" aria-hidden="true" />
      </button>
    </div>
    <div class="tp-body">
      <ProjectTerminal v-show="current === 'agent'" mode="agent" :repo-id="repoId" :entries="agentCommands" :active="current === 'agent'" />
      <ProjectTerminal v-for="n in shells" v-show="current === n" :key="`${repoId}-${n}`"
                       :ref="(el) => setRef(n, el)" mode="shell" :repo-id="repoId" :n="n" :active="current === n" />
      <p v-if="!ready" class="tp-wait">The terminal opens when the project is ready.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import ProjectTerminal from './ProjectTerminal.vue'

const props = defineProps({
  repoId: { type: Number, required: true },
  ready: { type: Boolean, default: false },
  agentCommands: { type: Array, default: () => [] },
})

const MAX = 3
const shells = ref([])
const current = ref('agent')
const refs = {}
function setRef(n, el) { if (el) refs[n] = el; else delete refs[n] }

function addShell() {
  if (!props.ready || shells.value.length >= MAX) return
  const n = [1, 2, 3].find(x => !shells.value.includes(x))
  shells.value = [...shells.value, n].sort()
  current.value = n
}
function endShell(n) {
  try { refs[n]?.end() } catch { /* already gone */ }
  shells.value = shells.value.filter(x => x !== n)
  if (current.value === n) current.value = shells.value.length ? shells.value[shells.value.length - 1] : 'agent'
}

// The first visit opens Terminal 1, as VS Code does; once the project is ready.
watch(() => props.ready, (r) => { if (r && !shells.value.length) addShell() }, { immediate: true })
// Another project: its own terminals.
watch(() => props.repoId, () => { shells.value = []; current.value = 'agent'; if (props.ready) addShell() })

defineExpose({ addShell })
</script>

<style scoped>
.tp { display: flex; flex-direction: column; height: 100%; }
.tp-tabs { display: flex; align-items: center; gap: 2px; padding: 4px 8px 0; flex: 0 0 auto; overflow-x: auto; }
.tp-tabwrap { display: inline-flex; align-items: center; border-radius: 6px 6px 0 0; }
.tp-tab {
  display: inline-flex; align-items: center; gap: 6px; background: transparent; border: none; color: var(--vm-ink-soft);
  font: 600 12px var(--vm-font-sans); padding: 6px 10px; cursor: pointer; border-radius: 6px 6px 0 0; white-space: nowrap;
  transition: color .15s, background-color .15s;
}
.tp-tab :deep(svg) { width: 13px; height: 13px; }
.tp-tab:hover { color: var(--vm-ink); }
.tp-tab.on, .tp-tabwrap.on .tp-tab { color: var(--vm-ink); background: var(--vm-surface-soft); }
.tp-tabwrap.on { background: var(--vm-surface-soft); }
.tp-count { background: var(--vm-violet); color: var(--cb-on-solid, #fff); font-size: 10px; font-weight: 700; border-radius: 8px; padding: 0 5px; line-height: 16px; min-width: 16px; text-align: center; }
.tp-x, .tp-add {
  display: grid; place-items: center; width: 24px; height: 24px; border: none; border-radius: 4px; background: transparent;
  color: var(--vm-ink-soft); cursor: pointer; transition: background-color .15s, color .15s;
}
.tp-x:hover, .tp-add:hover { background: color-mix(in srgb, var(--vm-ink) 8%, transparent); color: var(--vm-ink); }
.tp-x :deep(svg), .tp-add :deep(svg) { width: 13px; height: 13px; }
.tp-tab:focus-visible, .tp-x:focus-visible, .tp-add:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.tp-body { position: relative; flex: 1; min-height: 0; border-top: 1px solid var(--vm-line); }
.tp-body > * { position: absolute; inset: 0; }
.tp-wait { position: absolute; left: 14px; top: 10px; margin: 0; color: var(--vm-ink-faint); font-size: 13px; }
@media (max-width: 640px) { .tp-tab { min-height: 44px; } .tp-x, .tp-add { width: 44px; height: 44px; } }
</style>
