<template>
  <Teleport to="body">
    <div class="bm-overlay" @click.self="$emit('close')">
      <div class="bm-modal" role="dialog" aria-modal="true">
        <header class="bm-head">
          <h3>{{ form.id ? 'Edit rule' : 'New budget rule' }}</h3>
          <button class="bm-x" @click="$emit('close')"><Icon icon="lucide:x" /></button>
        </header>

        <div class="bm-body">
          <label class="bm-field" v-if="!form.id">
            <span>Budget</span>
            <select v-model.number="form.budget">
              <option v-for="b in budgets" :key="b.id" :value="b.id">
                {{ b.name || b.scope_type }} ({{ b.scope_type }})
              </option>
            </select>
            <small v-if="!budgets.length" class="bm-warn">Create a budget first to attach rules.</small>
          </label>

          <label class="bm-field">
            <span>Rule type</span>
            <select v-model="form.rule_type" @change="onTypeChange">
              <option value="daily_cap">Daily cap</option>
              <option value="monthly_cap">Monthly cap</option>
              <option value="per_run">Per-run budget</option>
              <option value="token_budget">Token budget</option>
              <option value="provider_budget">Provider budget</option>
              <option value="approval">Approval threshold</option>
            </select>
          </label>

          <label class="bm-field">
            <span>Target <small>(provider name, "all_agents", etc. — optional)</small></span>
            <input v-model="form.target" type="text" placeholder="e.g. openai" />
          </label>

          <div class="bm-row">
            <label class="bm-field">
              <span>Limit value</span>
              <input v-model.number="form.limit_value" type="number" step="0.0001" min="0" />
            </label>
            <label class="bm-field">
              <span>Unit</span>
              <select v-model="form.unit">
                <option value="usd">USD</option>
                <option value="tokens">Tokens</option>
              </select>
            </label>
          </div>

          <label class="bm-field">
            <span>Action when exceeded</span>
            <select v-model="form.action">
              <option value="warn">Warn only</option>
              <option value="require_approval">Require approval</option>
              <option value="block">Block</option>
            </select>
          </label>
        </div>

        <footer class="bm-foot">
          <button class="bm-ghost" @click="$emit('close')">Cancel</button>
          <button class="bm-primary" :disabled="saving || (!form.id && !form.budget)" @click="submit">
            {{ saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create rule') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps({
  rule: { type: Object, default: null },
  budgets: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save'])

const r = props.rule || {}
const form = reactive({
  id: r.id || null,
  budget: r.budget || (props.budgets[0]?.id ?? null),
  rule_type: r.rule_type || 'daily_cap',
  target: r.target || '',
  limit_value: r.limit_value ?? 0,
  unit: r.unit || 'usd',
  action: r.action || 'warn',
})

function onTypeChange() {
  // Token budgets are counted in tokens; everything else in USD.
  form.unit = form.rule_type === 'token_budget' ? 'tokens' : 'usd'
}

function submit() {
  emit('save', {
    id: form.id,
    budget: form.budget,
    rule_type: form.rule_type,
    target: form.target,
    limit_value: Number(form.limit_value || 0),
    unit: form.unit,
    action: form.action,
    enabled: true,
  })
}
</script>

<style scoped>
.bm-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center;
  background: rgba(15, 23, 42, .45); padding: 24px; }
.bm-modal { width: 100%; max-width: 480px; background: #fff; border-radius: 14px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, .25); display: flex; flex-direction: column; max-height: 90vh; }
.bm-head { display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid #eef2f7; }
.bm-head h3 { margin: 0; font-size: 16px; font-weight: 850; color: #0f172a; }
.bm-x { border: 0; background: transparent; cursor: pointer; color: #64748b; display: grid; place-items: center; }
.bm-x svg { width: 18px; height: 18px; }
.bm-body { padding: 18px 20px; overflow-y: auto; display: grid; gap: 14px; }
.bm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.bm-field { display: grid; gap: 6px; }
.bm-field span { font-size: 11px; font-weight: 800; color: #475569; }
.bm-field span small { font-weight: 600; color: #94a3b8; }
.bm-field input, .bm-field select { height: 38px; border: 1px solid #dbe4f0; border-radius: 9px;
  padding: 0 12px; font: inherit; font-size: 13px; color: #0f172a; background: #fff; }
.bm-field input:focus, .bm-field select:focus { outline: 2px solid #c7d2fe; border-color: #3156e9; }
.bm-warn { color: #b45309; font-size: 11px; font-weight: 700; }
.bm-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid #eef2f7; }
.bm-ghost, .bm-primary { height: 38px; border-radius: 9px; padding: 0 16px; font-size: 13px; font-weight: 800; cursor: pointer; }
.bm-ghost { border: 1px solid #dbe4f0; background: #fff; color: #334155; }
.bm-primary { border: 0; background: #3156e9; color: #fff; }
.bm-primary:disabled { opacity: .6; cursor: default; }
</style>
