<template>
  <main class="approvals-page">
    <section class="approvals-main">
      <header class="page-head">
        <div class="title-block">
          <span class="title-icon"><Icon icon="lucide:shield-check" /></span>
          <div>
            <h1>Guardrails</h1>
            <p>Control how your agents operate with policies, permissions, and safety limits.</p>
          </div>
        </div>
        <div class="head-actions">
          <button class="ghost"><Icon icon="lucide:file-clock" /> View audit log</button>
          <button class="primary">Save guardrails</button>
        </div>
      </header>

      <section class="notice">
        <span><Icon icon="lucide:shield" /></span>
        <div>
          <strong>Guardrails keep your agents aligned with your policies and values.</strong>
          <p>Apply rules that control what agents can do, when they need approval, and how they spend or communicate.</p>
        </div>
      </section>

      <section class="policy-grid">
        <article class="policy-card">
          <header class="card-head">
            <span>1</span>
            <div>
              <h2>Approval Policies</h2>
              <p>Require approval for sensitive or high-impact actions.</p>
            </div>
          </header>
          <div class="setting-list">
            <label v-for="item in approvals" :key="item.label" class="setting-row">
              <span>{{ item.label }}</span>
              <button :class="['toggle', { on: item.enabled }]" type="button"><i /></button>
            </label>
          </div>
          <label class="field-row">
            <span>Approval timeout</span>
            <select>
              <option>2 hours</option>
              <option>6 hours</option>
              <option>24 hours</option>
            </select>
          </label>
        </article>

        <article class="policy-card">
          <header class="card-head">
            <span>2</span>
            <div>
              <h2>Risky Actions</h2>
              <p>Block or warn on potentially risky behavior.</p>
            </div>
          </header>
          <div class="setting-list">
            <label v-for="item in riskyActions" :key="item.label" class="setting-row">
              <span>{{ item.label }}</span>
              <button :class="['toggle', { on: item.enabled }]" type="button"><i /></button>
            </label>
          </div>
          <label class="field-row">
            <span>Action on violation</span>
            <select>
              <option>Block and notify</option>
              <option>Warn only</option>
              <option>Require approval</option>
            </select>
          </label>
        </article>

        <article class="policy-card">
          <header class="card-head">
            <span>3</span>
            <div>
              <h2>Tool Permissions</h2>
              <p>Control which tools and connectors agents can use.</p>
            </div>
          </header>
          <div class="permission-box">
            <span class="box-label">Allowed tools</span>
            <div class="tag-cloud">
              <button v-for="tool in tools" :key="tool">{{ tool }} <Icon icon="lucide:x" /></button>
            </div>
            <button class="link-button"><Icon icon="lucide:plus" /> Add tool</button>
          </div>
          <label class="connector-field">
            <span>Allowed connectors</span>
            <select>
              <option>All allowed</option>
              <option>Approved only</option>
              <option>None</option>
            </select>
          </label>
          <p class="hint">Manage connectors from the <strong>Connectors</strong> page <Icon icon="lucide:external-link" /></p>
        </article>

        <article class="policy-card">
          <header class="card-head">
            <span>4</span>
            <div>
              <h2>Read-only vs Action Mode</h2>
              <p>Choose the default mode for this agent.</p>
            </div>
          </header>
          <div class="mode-grid">
            <label class="mode-card selected">
              <input type="radio" checked />
              <strong>Read-only mode</strong>
              <p>Agent can analyze and provide recommendations without making changes.</p>
            </label>
            <label class="mode-card">
              <input type="radio" />
              <strong>Action mode</strong>
              <p>Agent can take actions based on permissions and approvals.</p>
            </label>
          </div>
          <label class="field-row mode-select">
            <span>Default mode</span>
            <select>
              <option>Read-only mode</option>
              <option>Action mode</option>
            </select>
          </label>
          <label class="checkbox-row">
            <input type="checkbox" checked />
            <span>Require approval to switch to Action mode</span>
          </label>
        </article>

        <article class="policy-card">
          <header class="card-head">
            <span>5</span>
            <div>
              <h2>Human-in-the-loop Checkpoints</h2>
              <p>Add checkpoints for important decisions.</p>
            </div>
          </header>
          <div class="setting-list">
            <label v-for="item in checkpoints" :key="item.label" class="setting-row">
              <span>{{ item.label }}</span>
              <button :class="['toggle', { on: item.enabled }]" type="button"><i /></button>
            </label>
          </div>
          <label class="reviewer-field">
            <span>Default reviewer</span>
            <select>
              <option>hamza@northrays.ai</option>
              <option>sarah@northrays.ai</option>
            </select>
          </label>
        </article>

        <article class="policy-card">
          <header class="card-head">
            <span>6</span>
            <div>
              <h2>Spending & Communication Restrictions</h2>
              <p>Set limits for spend and outbound communications.</p>
            </div>
          </header>
          <div class="limit-list">
            <label v-for="limit in limits" :key="limit.label">
              <span>{{ limit.label }}</span>
              <input :value="limit.value" />
            </label>
          </div>
          <label class="domain-row">
            <span>Allowed domains (email)</span>
            <div>
              <select><option>Allow list</option></select>
              <input value="example.com, northrays.ai" />
            </div>
          </label>
          <p class="hint">Only emails to these domains are allowed.</p>
        </article>
      </section>

      <section class="escalation-card">
        <header class="card-head">
          <span>7</span>
          <div>
            <h2>Escalation Rules</h2>
            <p>Define what happens when guardrails are triggered.</p>
          </div>
        </header>
        <div class="escalation-table">
          <div class="table-head">
            <span>Trigger</span>
            <span>Escalation action</span>
            <span>Notify</span>
            <span />
          </div>
          <div v-for="rule in escalationRules" :key="rule.trigger" class="escalation-row">
            <select><option>{{ rule.trigger }}</option></select>
            <select><option>{{ rule.action }}</option></select>
            <div class="email-pill">hamza@northrays.ai <Icon icon="lucide:x" /></div>
            <button><Icon icon="lucide:trash-2" /></button>
          </div>
        </div>
        <button class="add-rule"><Icon icon="lucide:plus" /> Add escalation rule</button>
      </section>
    </section>

    <aside class="guardrail-rail">
      <section class="rail-card about">
        <span class="rail-icon"><Icon icon="lucide:shield-check" /></span>
        <h2>About Guardrails</h2>
        <p>Guardrails help you safely scale agent autonomy by setting clear boundaries and escalation paths. You can always review and adjust these settings.</p>
      </section>

      <section class="rail-card presets">
        <h2>Recommended Presets</h2>
        <p>Start with a preset, then customize as needed.</p>
        <article v-for="preset in presets" :key="preset.title">
          <h3>{{ preset.title }}</h3>
          <p>{{ preset.copy }}</p>
          <ul>
            <li v-for="line in preset.lines" :key="line"><Icon icon="lucide:check" /> {{ line }}</li>
          </ul>
          <button>Apply {{ preset.button }}</button>
        </article>
        <p class="settings-note">You can create custom presets in <strong>Settings</strong>.</p>
      </section>
    </aside>
  </main>
</template>

<script setup>
import { Icon } from '@iconify/vue'

const approvals = [
  { label: 'Require approval before sending emails', enabled: true },
  { label: 'Require approval before posting messages', enabled: true },
  { label: 'Require approval before making purchases', enabled: true },
  { label: 'Require approval before editing files', enabled: true },
  { label: 'Require approval before calling external APIs', enabled: false },
]

const riskyActions = [
  { label: 'Block data exfiltration attempts', enabled: true },
  { label: 'Block prompt injection attempts', enabled: true },
  { label: 'Warn on destructive file operations', enabled: true },
  { label: 'Warn on long-running or expensive tasks', enabled: true },
]

const tools = ['Web Search', 'Code Interpreter', 'Notion', 'Gmail', 'Slack']

const checkpoints = [
  { label: 'Checkpoint for high-risk actions', enabled: true },
  { label: 'Checkpoint for spending over limit', enabled: true },
  { label: 'Checkpoint for new tool usage', enabled: false },
  { label: 'Checkpoint for external API calls', enabled: false },
]

const limits = [
  { label: 'Max spend per run (USD)', value: '10.00' },
  { label: 'Max spend per day (USD)', value: '50.00' },
  { label: 'Max emails per run', value: '10' },
  { label: 'Max external API calls per run', value: '20' },
]

const escalationRules = [
  { trigger: 'High risk action blocked', action: 'Notify and require approval' },
  { trigger: 'Spend limit exceeded', action: 'Pause agent and notify' },
  { trigger: 'Repeated policy violations', action: 'Disable agent and notify' },
]

const presets = [
  {
    title: 'Safe (Recommended)',
    button: 'Safe',
    copy: 'Maximum protection with strict approvals and lower limits.',
    lines: ['All high-impact actions require approval', 'Lower spend & communication limits', 'Best for regulated or sensitive work'],
  },
  {
    title: 'Balanced',
    button: 'Balanced',
    copy: 'Smart defaults for most teams and use cases.',
    lines: ['Key actions require approval', 'Moderate limits', 'Good balance of safety and speed'],
  },
  {
    title: 'Advanced',
    button: 'Advanced',
    copy: 'More autonomy with higher thresholds.',
    lines: ['Fewer approvals', 'Higher spend & usage limits', 'Best for trusted, low-risk environments'],
  },
]
</script>

<style scoped>
.approvals-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  min-height: 100%;
  padding: 26px 28px;
  background: #f8fbff;
  color: #0f172a;
}
.approvals-main { max-width: 1240px; width: 100%; justify-self: center; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
.title-block { display: flex; gap: 14px; align-items: flex-start; }
.title-icon, .notice span, .rail-icon {
  width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; background: #eef4ff; color: #3156e9;
}
h1, h2, h3, p { margin: 0; }
h1 { font-size: 24px; line-height: 1.1; font-weight: 850; }
.page-head p, .notice p, .card-head p, .hint, .rail-card p { color: #5b6b84; font-size: 12px; line-height: 1.45; }
.page-head p { margin-top: 8px; }
.head-actions { display: flex; gap: 12px; }
button, input, select { font: inherit; }
.ghost, .primary {
  height: 40px; border-radius: 8px; padding: 0 16px; display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 850;
}
.ghost { border: 1px solid #d9e3f0; background: #fff; color: #334155; }
.primary { border: 0; background: #4a47ea; color: #fff; box-shadow: 0 12px 24px rgba(74,71,234,.18); }
.notice, .policy-card, .escalation-card, .rail-card {
  border: 1px solid #dfe7f2; border-radius: 11px; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.03);
}
.notice { display: flex; gap: 14px; align-items: center; padding: 18px 20px; margin-bottom: 14px; }
.notice strong { display: block; font-size: 13px; margin-bottom: 5px; }
.policy-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.policy-card, .escalation-card { padding: 18px; }
.card-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 18px; }
.card-head > span {
  width: 22px; height: 22px; border-radius: 8px; display: grid; place-items: center; flex: 0 0 auto; background: #eaf1ff; color: #3156e9; font-size: 12px; font-weight: 900;
}
.card-head h2 { font-size: 15px; font-weight: 850; margin-bottom: 6px; }
.setting-list { display: grid; gap: 16px; }
.setting-row, .field-row, .connector-field, .reviewer-field, .domain-row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px; color: #334155; font-size: 12px; font-weight: 750;
}
.field-row { margin-top: 22px; }
.toggle {
  width: 32px; height: 18px; border-radius: 999px; border: 0; padding: 2px; background: #d7dee8; flex: 0 0 auto;
}
.toggle i { display: block; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(15,23,42,.2); }
.toggle.on { background: #3156e9; }
.toggle.on i { margin-left: auto; }
select, input {
  height: 34px; border: 1px solid #d7e1ee; border-radius: 7px; background: #fff; color: #0f172a; padding: 0 12px; font-size: 12px; font-weight: 700;
}
.field-row select { width: 112px; }
.permission-box {
  border: 1px solid #d7e1ee; border-radius: 8px; padding: 10px; min-height: 112px; margin-bottom: 14px;
}
.box-label, .connector-field > span, .reviewer-field > span, .domain-row > span {
  display: block; color: #64748b; font-size: 11px; font-weight: 850; margin-bottom: 8px;
}
.tag-cloud { display: flex; flex-wrap: wrap; gap: 7px; }
.tag-cloud button {
  height: 26px; border: 0; border-radius: 6px; background: #f1f5f9; color: #334155; padding: 0 9px; display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 750;
}
.tag-cloud svg { width: 12px; height: 12px; }
.link-button, .add-rule {
  margin-top: 10px; border: 0; background: transparent; color: #3156e9; padding: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 850;
}
.connector-field, .reviewer-field, .domain-row { display: block; }
.connector-field select, .reviewer-field select { width: 100%; }
.hint { margin-top: 8px; display: flex; align-items: center; gap: 4px; }
.hint strong { color: #3156e9; }
.mode-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mode-card {
  min-height: 104px; border: 1px solid #d7e1ee; border-radius: 8px; padding: 14px; display: grid; align-content: start; gap: 8px; color: #334155;
}
.mode-card.selected { border-color: #3156e9; background: #f7faff; }
.mode-card input { width: 15px; height: 15px; padding: 0; accent-color: #3156e9; }
.mode-card strong { font-size: 12px; }
.mode-card p { color: #64748b; font-size: 11px; line-height: 1.45; padding-left: 28px; }
.mode-select select { width: 238px; }
.checkbox-row {
  display: flex; gap: 8px; align-items: center; margin-top: 14px; color: #334155; font-size: 12px; font-weight: 750;
}
.checkbox-row input { width: 14px; height: 14px; accent-color: #3156e9; padding: 0; }
.limit-list { display: grid; gap: 10px; }
.limit-list label { display: grid; grid-template-columns: 1fr 150px; align-items: center; gap: 12px; color: #52637a; font-size: 12px; font-weight: 750; }
.limit-list input { width: 100%; }
.domain-row { margin-top: 14px; }
.domain-row div { display: grid; grid-template-columns: 86px 1fr; gap: 8px; }
.escalation-card { margin-top: 12px; }
.escalation-table { display: grid; gap: 8px; }
.table-head, .escalation-row {
  display: grid; grid-template-columns: 1fr 1.05fr 1fr 34px; gap: 10px; align-items: center;
}
.table-head { color: #64748b; font-size: 11px; font-weight: 850; }
.escalation-row select, .email-pill { width: 100%; }
.email-pill {
  min-height: 34px; border: 1px solid #d7e1ee; border-radius: 7px; padding: 0 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #334155; font-size: 12px; font-weight: 750; background: #fff;
}
.escalation-row button {
  width: 34px; height: 34px; border: 0; background: transparent; color: #64748b;
}
.guardrail-rail { display: grid; gap: 14px; align-content: start; }
.rail-card { padding: 20px; }
.rail-card h2 { font-size: 15px; font-weight: 850; margin-bottom: 14px; }
.about .rail-icon { margin-bottom: 12px; }
.presets > p { margin-bottom: 16px; }
.presets article {
  border: 1px solid #dfe7f2; border-radius: 9px; padding: 16px; margin-bottom: 14px;
}
.presets h3 { color: #3156e9; font-size: 13px; font-weight: 850; margin-bottom: 10px; }
.presets ul { list-style: none; margin: 14px 0 16px; padding: 0; display: grid; gap: 9px; }
.presets li { display: flex; align-items: flex-start; gap: 7px; color: #52637a; font-size: 11px; font-weight: 750; line-height: 1.35; }
.presets li svg { color: #16a34a; width: 13px; height: 13px; flex: 0 0 auto; }
.presets article button {
  width: 100%; height: 36px; border: 0; border-radius: 7px; background: #edeafb; color: #3156e9; font-size: 12px; font-weight: 850;
}
.settings-note { margin-top: 18px; }
.settings-note strong { color: #3156e9; }
@media (max-width: 1320px) {
  .approvals-page { grid-template-columns: 1fr; }
  .guardrail-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 1050px) {
  .policy-grid { grid-template-columns: 1fr 1fr; }
  .guardrail-rail { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .approvals-page { padding: 18px; }
  .page-head, .head-actions { flex-direction: column; }
  .head-actions, .ghost, .primary { width: 100%; justify-content: center; }
  .policy-grid, .mode-grid { grid-template-columns: 1fr; }
  .table-head { display: none; }
  .escalation-row { grid-template-columns: 1fr; }
  .limit-list label, .domain-row div { grid-template-columns: 1fr; }
}
</style>
