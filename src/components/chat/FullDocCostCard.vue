<!-- Full-document cost gate (manual / plan-review): a complete-mode KB scope overflowed the model's
     context window, so reading the whole document is a bigger, costlier operation. This card lets the user
     approve the full read, keep it cheap (targeted top-k on the original question), or ask something
     specific. Shown only when the store holds a fullDocCostGate; autonomous agents never see it. -->
<template>
  <div v-if="gate" class="fdc-overlay" @click.self="dismiss">
    <div class="fdc-card" role="dialog" aria-modal="true" aria-labelledby="fdc-title">
      <div class="fdc-head">
        <span class="fdc-icon" aria-hidden="true">📄</span>
        <h3 id="fdc-title" class="fdc-title">This document is larger than the model can read at once</h3>
      </div>

      <p class="fdc-body">
        Answering <em>completely</em> means reading the whole document in
        <strong>{{ cost.batch_count || 'several' }}</strong> passes.
        Keeping it focused on a specific question is faster and cheaper.
      </p>

      <dl class="fdc-stats">
        <div><dt>Document</dt><dd>{{ fmt(cost.enumerated_tokens) }} tokens</dd></div>
        <div><dt>Model window</dt><dd>{{ fmt(cost.context_window_tokens) }} tokens</dd></div>
        <div v-if="cost.chunk_count"><dt>Sections</dt><dd>{{ fmt(cost.chunk_count) }}</dd></div>
        <div v-if="estCost"><dt>Est. cost</dt><dd>{{ estCost }}</dd></div>
      </dl>

      <div class="fdc-actions">
        <button class="fdc-btn primary" @click="choose('approve')">
          Read the whole document<span v-if="estCost" class="fdc-hint"> · {{ estCost }}</span>
        </button>
        <button class="fdc-btn secondary" @click="choose('reject')">
          Answer from relevant sections only
        </button>
      </div>

      <div class="fdc-focus">
        <label class="fdc-focus-label" for="fdc-focus-input">…or ask about something specific</label>
        <div class="fdc-focus-row">
          <input
            id="fdc-focus-input"
            v-model="focus"
            class="fdc-input"
            type="text"
            placeholder="What specifically do you want to know?"
            @keydown.enter.prevent="submitFocus"
          />
          <button class="fdc-btn ghost" :disabled="!focus.trim()" @click="submitFocus">Ask</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '../../stores/useChatStore'

const chat = useChatStore()
const focus = ref('')

const gate = computed(() => chat.fullDocCostGate)
const cost = computed(() => (chat.fullDocCostGate && chat.fullDocCostGate.cost) || {})

const estCost = computed(() => {
  const c = cost.value.est_cost_usd
  if (typeof c !== 'number' || !c) return ''
  return c < 0.01 ? '<$0.01' : `~$${c.toFixed(2)}`
})

function fmt(n) {
  const v = Number(n || 0)
  return v.toLocaleString()
}

function choose(decision) {
  chat.resolveFullDocCost(decision)
}

function submitFocus() {
  const q = focus.value.trim()
  if (!q) return
  chat.resolveFullDocCost('focus', q)
  focus.value = ''
}

// Dismiss = keep it cheap (targeted on the original question) — the same as "relevant sections only".
function dismiss() {
  chat.resolveFullDocCost('reject')
}
</script>

<style scoped>
.fdc-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(15, 18, 24, 0.5);
  backdrop-filter: blur(2px);
}
.fdc-card {
  width: min(30rem, 100%);
  background: var(--surface, #fff);
  color: var(--text, #1a1d23);
  border: 1px solid var(--border, #e3e6eb);
  border-radius: 14px;
  box-shadow: 0 18px 48px rgba(15, 18, 24, 0.28);
  padding: 1.25rem 1.25rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.fdc-head { display: flex; align-items: flex-start; gap: 0.6rem; }
.fdc-icon { font-size: 1.35rem; line-height: 1.4; }
.fdc-title { margin: 0; font-size: 1.02rem; font-weight: 650; line-height: 1.35; text-wrap: balance; }
.fdc-body { margin: 0; font-size: 0.9rem; line-height: 1.5; color: var(--text-muted, #565c66); }
.fdc-body strong { color: var(--text, #1a1d23); }

.fdc-stats {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 1rem;
  padding: 0.7rem 0.8rem;
  background: var(--surface-muted, #f5f6f8);
  border-radius: 10px;
}
.fdc-stats > div { display: flex; flex-direction: column; gap: 0.1rem; }
.fdc-stats dt { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #7a828d); }
.fdc-stats dd { margin: 0; font-size: 0.9rem; font-weight: 600; font-variant-numeric: tabular-nums; }

.fdc-actions { display: flex; flex-direction: column; gap: 0.5rem; }
.fdc-btn {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 9px;
  padding: 0.6rem 0.85rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
}
.fdc-btn.primary { background: var(--accent, #3b6ef5); color: #fff; }
.fdc-btn.primary:hover { background: var(--accent-strong, #2f5bd6); }
.fdc-btn.secondary { background: transparent; border-color: var(--border, #d6dae1); color: var(--text, #1a1d23); }
.fdc-btn.secondary:hover { background: var(--surface-muted, #f2f4f7); }
.fdc-btn.ghost { background: var(--surface-muted, #eef0f4); color: var(--text, #1a1d23); }
.fdc-btn.ghost:hover:not(:disabled) { background: var(--border, #dfe3ea); }
.fdc-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.fdc-hint { font-weight: 500; opacity: 0.85; }

.fdc-focus { display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.15rem; }
.fdc-focus-label { font-size: 0.78rem; color: var(--text-muted, #7a828d); }
.fdc-focus-row { display: flex; gap: 0.45rem; }
.fdc-input {
  flex: 1;
  min-width: 0;
  padding: 0.55rem 0.7rem;
  font-size: 0.9rem;
  border: 1px solid var(--border, #d6dae1);
  border-radius: 9px;
  background: var(--surface, #fff);
  color: var(--text, #1a1d23);
}
.fdc-input:focus { outline: 2px solid var(--accent, #3b6ef5); outline-offset: 1px; border-color: transparent; }

@media (prefers-color-scheme: dark) {
  .fdc-card { background: var(--surface, #1c2027); color: var(--text, #eef1f5); border-color: var(--border, #313742); }
  .fdc-title { color: var(--text, #eef1f5); }
  .fdc-body { color: var(--text-muted, #a2abb8); }
  .fdc-body strong { color: var(--text, #eef1f5); }
  .fdc-stats { background: var(--surface-muted, #252b34); }
  .fdc-stats dd { color: var(--text, #eef1f5); }
  .fdc-btn.secondary { color: var(--text, #eef1f5); border-color: var(--border, #3a414d); }
  .fdc-btn.secondary:hover { background: var(--surface-muted, #252b34); }
  .fdc-btn.ghost { background: var(--surface-muted, #2b323c); color: var(--text, #eef1f5); }
  .fdc-input { background: var(--surface, #1c2027); color: var(--text, #eef1f5); border-color: var(--border, #3a414d); }
}
:root[data-theme='dark'] .fdc-card { background: #1c2027; color: #eef1f5; border-color: #313742; }
:root[data-theme='dark'] .fdc-body { color: #a2abb8; }
:root[data-theme='dark'] .fdc-stats { background: #252b34; }
:root[data-theme='light'] .fdc-card { background: #fff; color: #1a1d23; border-color: #e3e6eb; }
</style>
