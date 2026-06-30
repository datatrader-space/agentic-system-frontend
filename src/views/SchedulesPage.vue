<template>
  <main class="schedules-page">
    <section class="schedules-main">
      <header class="page-head">
        <div>
          <h1>Automation & Schedules</h1>
          <p>Create recurring runs for your agent to automate tasks, reports, and workflows.</p>
        </div>
        <button class="demo-btn"><Icon icon="lucide:play" /> Watch demo</button>
      </header>

      <section class="create-card">
        <header class="create-head">
          <div class="head-title">
            <span><Icon icon="lucide:calendar-clock" /></span>
            <div>
              <h2>Create a Scheduled Run</h2>
              <p>Define what your agent should do, when, and how often.</p>
            </div>
          </div>
          <button class="template-btn"><Icon icon="lucide:calendar-days" /> Use template <Icon icon="lucide:chevron-down" /></button>
        </header>

        <section class="form-grid top">
          <article class="form-section basic">
            <h3><span>1</span> Basic Info</h3>
            <label>
              <span>Schedule name</span>
              <input placeholder="Daily report, Hourly sync..." />
            </label>
            <label>
              <span>What should the agent do?</span>
              <textarea placeholder="Describe the goal or task for each run..." />
            </label>
          </article>

          <article class="form-section">
            <h3><span>2</span> Run Frequency</h3>
            <label>
              <span>Frequency</span>
              <select>
                <option>Daily</option>
                <option>Hourly</option>
                <option>Weekly</option>
              </select>
            </label>
            <p>Choose how often this schedule should run.</p>
          </article>

          <article class="form-section">
            <h3><span>3</span> Timing</h3>
            <label>
              <span>Time of day</span>
              <input value="08:00" />
            </label>
            <label>
              <span>Timezone</span>
              <select>
                <option>(UTC +05:00) Asia/Karachi</option>
                <option>(UTC -05:00) US/Eastern</option>
              </select>
            </label>
          </article>
        </section>

        <section class="form-grid middle">
          <article class="form-section advanced">
            <h3><span>4</span> Advanced Settings</h3>
            <div class="two-fields">
              <label>
                <span>LLM Provider</span>
                <select><option>All Providers</option></select>
              </label>
              <label>
                <span>Model Override (optional)</span>
                <select><option>Select model</option></select>
              </label>
            </div>
            <label>
              <span>System Prompt Override (optional)</span>
              <input placeholder="Override agent system prompt for this schedule..." />
            </label>
            <button class="show-more">Show more options <Icon icon="lucide:chevron-down" /></button>
          </article>

          <article class="form-section limits">
            <h3><span>5</span> Limits & Controls</h3>
            <div class="limit-grid">
              <label v-for="limit in limits" :key="limit.label">
                <span>{{ limit.label }}</span>
                <input :value="limit.value" />
              </label>
            </div>
            <p>Set limits to control spend and ensure reliability.</p>
          </article>
        </section>

        <section class="safety-row">
          <article>
            <h3><span>6</span> Safety</h3>
            <label class="checkbox-row">
              <input type="checkbox" checked />
              <span><strong>Read-only mode</strong><small>Allow the agent to read data but prevent any changes.</small></span>
            </label>
          </article>
          <article class="preview">
            <span>Schedule preview</span>
            <div>
              <em>CRON</em>
              <code>0 8 * * *</code>
              <p>Every day at 08:00 (Asia/Karachi)</p>
              <button><Icon icon="lucide:copy" /> Copy</button>
            </div>
          </article>
        </section>

        <footer class="create-actions">
          <button class="ghost">Save as draft</button>
          <button class="primary">Create Schedule</button>
        </footer>
      </section>

      <section class="schedule-table-card">
        <header class="table-headline">
          <h2>Your Schedules <span>4</span></h2>
          <div class="table-tools">
            <label><Icon icon="lucide:search" /><input placeholder="Search schedules" /></label>
            <select><option>All statuses</option></select>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Frequency</th>
              <th>Next Run</th>
              <th>Last Run</th>
              <th>Status</th>
              <th>Runs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="schedule in schedules" :key="schedule.name">
              <td><strong>{{ schedule.name }}</strong><small>{{ schedule.copy }}</small></td>
              <td>{{ schedule.frequency }}</td>
              <td>{{ schedule.next }}</td>
              <td><span>{{ schedule.last }}</span><small :class="schedule.resultTone">{{ schedule.result }}</small></td>
              <td><b :class="schedule.statusTone">{{ schedule.status }}</b></td>
              <td>{{ schedule.runs }}</td>
              <td class="actions">
                <button><Icon icon="lucide:play" /></button>
                <button><Icon icon="lucide:pencil" /></button>
                <button><Icon icon="lucide:more-vertical" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="showing">Showing 1 to 4 of 4 schedules</p>
      </section>
    </section>

    <aside class="schedule-rail">
      <section class="rail-card how-card">
        <h2>How scheduling works</h2>
        <p>Aadml runs your agent automatically on the schedule you define. Each run uses the latest agent configuration and data.</p>
        <article v-for="step in steps" :key="step.title">
          <span :class="step.tone"><Icon :icon="step.icon" /></span>
          <div><strong>{{ step.title }}</strong><p>{{ step.copy }}</p></div>
        </article>
      </section>

      <section class="rail-card templates-card">
        <h2>Common templates</h2>
        <p>Use a template to get started quickly.</p>
        <button v-for="template in templates" :key="template.title">
          <span :class="template.tone"><Icon :icon="template.icon" /></span>
          <span><strong>{{ template.title }}</strong><small>{{ template.copy }}</small></span>
          <Icon icon="lucide:chevron-right" />
        </button>
      </section>

      <section class="rail-card tips-card">
        <h2>Tips</h2>
        <ul>
          <li v-for="tip in tips" :key="tip"><Icon icon="lucide:check" />{{ tip }}</li>
        </ul>
        <button>Learn more about scheduling <Icon icon="lucide:external-link" /></button>
      </section>
    </aside>
  </main>
</template>

<script setup>
import { Icon } from '@iconify/vue'

const limits = [
  { label: 'Budget per run ($)', value: '1.00' },
  { label: 'Max iterations', value: '10' },
  { label: 'Daily budget cap ($)', value: 'No limit' },
  { label: 'Max total runs', value: 'âˆž' },
  { label: 'Pause after failures', value: '3' },
]

const schedules = [
  { name: 'Daily Sales Report', copy: 'Generate and email daily sales summary', frequency: 'Daily at 08:00', next: 'May 20, 2025 08:00\n(Asia/Karachi)', last: 'May 19, 2025 08:00', result: 'Success', resultTone: 'success', status: 'Active', statusTone: 'active', runs: '156' },
  { name: 'Hourly Data Sync', copy: 'Sync data from external sources', frequency: 'Every hour', next: 'May 19, 2025 14:00', last: 'May 19, 2025 13:00', result: 'Success', resultTone: 'success', status: 'Active', statusTone: 'active', runs: '1,248' },
  { name: 'Weekly Summary', copy: 'Generate weekly performance summary', frequency: 'Weekly on Mon 09:00', next: 'May 26, 2025 09:00\n(Asia/Karachi)', last: 'May 19, 2025 09:00', result: 'Success', resultTone: 'success', status: 'Paused', statusTone: 'paused', runs: '32' },
  { name: 'Leads Enrichment', copy: 'Enrich and score new leads', frequency: 'Daily at 02:00', next: '-', last: 'May 18, 2025 02:00', result: 'Failed', resultTone: 'failed', status: 'Failed', statusTone: 'failed-chip', runs: '18' },
]

const steps = [
  { title: 'Define the task', copy: 'Tell your agent what to do.', icon: 'lucide:calendar-check', tone: 'blue' },
  { title: 'Set when & how often', copy: 'Choose frequency and time that works for you.', icon: 'lucide:timer-reset', tone: 'violet' },
  { title: 'We handle the rest', copy: 'Your agent runs automatically and logs results.', icon: 'lucide:search-check', tone: 'green' },
]

const templates = [
  { title: 'Daily Report', copy: 'Every day at 08:00', icon: 'lucide:calendar-days', tone: 'blue' },
  { title: 'Hourly Sync', copy: 'Every hour', icon: 'lucide:database-zap', tone: 'green' },
  { title: 'Weekly Summary', copy: 'Every Monday at 09:00', icon: 'lucide:clipboard-list', tone: 'violet' },
  { title: 'Data Cleanup', copy: 'Every Sunday at 02:00', icon: 'lucide:trash-2', tone: 'amber' },
]

const tips = [
  'Use limits to control costs and avoid runaway runs.',
  'Pause after failures helps prevent repeated errors.',
  'You can edit or pause schedules anytime.',
  'All runs are logged in the Activity section.',
]
</script>

<style scoped>
.schedules-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  min-height: 100%;
  padding: 28px;
  background: #f8fbff;
  color: #0f172a;
}
.schedules-main { max-width: 1220px; width: 100%; justify-self: center; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: 23px; line-height: 1.12; font-weight: 850; letter-spacing: 0; }
.page-head p, .create-head p, .form-section p, .rail-card p, .showing { color: #5c6d85; font-size: 11.5px; line-height: 1.45; }
.page-head p { margin-top: 8px; }
button, input, select, textarea { font: inherit; }
.demo-btn, .ghost, .primary, .template-btn {
  height: 36px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 11.5px; font-weight: 850;
}
.demo-btn, .ghost, .template-btn { border: 1px solid #d9e3f0; background: #fff; color: #3156e9; padding: 0 14px; }
.primary { border: 0; background: linear-gradient(135deg, #3156e9, #5b3ee8); color: #fff; padding: 0 22px; box-shadow: 0 12px 24px rgba(49,86,233,.18); }
.create-card, .schedule-table-card, .rail-card {
  border: 1px solid #dfe7f2; border-radius: 11px; background: #fff; box-shadow: 0 8px 22px rgba(15,23,42,.03);
}
.create-card { overflow: hidden; margin-bottom: 14px; }
.create-head {
  display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px 24px; border-bottom: 1px solid #e8eef7;
}
.head-title { display: flex; align-items: center; gap: 14px; }
.head-title > span {
  width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: #eef4ff; color: #3156e9;
}
.head-title svg { width: 22px; height: 22px; }
.create-head h2, .table-headline h2, .rail-card h2 { font-size: 14px; font-weight: 850; }
.form-grid { display: grid; border-bottom: 1px solid #e8eef7; }
.form-grid.top { grid-template-columns: 1.65fr .9fr .85fr; }
.form-grid.middle { grid-template-columns: 1.45fr 1.55fr; }
.form-section { padding: 20px 22px; border-right: 1px solid #e8eef7; }
.form-section:last-child { border-right: 0; }
.form-section h3, .safety-row h3 {
  display: flex; align-items: center; gap: 9px; color: #3156e9; font-size: 11.5px; font-weight: 850; margin-bottom: 18px;
}
.form-section h3 span, .safety-row h3 span {
  width: 18px; height: 18px; border-radius: 999px; display: grid; place-items: center; background: #3156e9; color: #fff; font-size: 9.5px;
}
label { display: grid; gap: 7px; color: #52637a; font-size: 11px; font-weight: 750; }
.basic label + label, .form-section label + label { margin-top: 16px; }
input, select, textarea {
  width: 100%; border: 1px solid #d7e1ee; border-radius: 7px; background: #fff; color: #334155; font-size: 11px; font-weight: 500;
}
input, select { height: 32px; padding: 0 12px; }
textarea { height: 56px; padding: 10px 12px; resize: vertical; }
input::placeholder, textarea::placeholder { color: #94a3b8; font-weight: 500; }
.two-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.show-more {
  margin-top: 12px; border: 0; background: transparent; color: #3156e9; display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 850; padding: 0;
}
.limit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.limit-grid label:nth-child(n+4) { grid-column: span 1; }
.limits p { margin-top: 12px; }
.safety-row {
  display: grid; grid-template-columns: 1.45fr 1.55fr; border-bottom: 1px solid #e8eef7; background: #f7faff;
}
.safety-row article { padding: 18px 22px; border-right: 1px solid #e8eef7; }
.safety-row article:last-child { border-right: 0; }
.checkbox-row { display: flex; align-items: flex-start; gap: 10px; }
.checkbox-row input { width: 14px; height: 14px; padding: 0; accent-color: #3156e9; }
.checkbox-row strong { display: block; color: #0f172a; font-size: 11.5px; }
.checkbox-row small { display: block; color: #64748b; font-size: 10.5px; font-weight: 700; margin-top: 4px; }
.preview > span { display: block; color: #52637a; font-size: 11.5px; font-weight: 850; margin-bottom: 10px; }
.preview div { display: flex; align-items: center; gap: 12px; }
.preview em {
  border-radius: 999px; background: #eaf1ff; color: #3156e9; padding: 4px 8px; font-style: normal; font-size: 10px; font-weight: 900;
}
.preview code { border-radius: 999px; background: #fff; border: 1px solid #dfe7f2; padding: 5px 12px; color: #3156e9; font-size: 10.5px; font-weight: 850; }
.preview p { color: #334155; font-size: 11.5px; font-weight: 750; flex: 1; }
.preview button {
  height: 29px; border: 1px solid #d9e3f0; border-radius: 7px; background: #fff; color: #52637a; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; font-size: 10.5px; font-weight: 850;
}
.create-actions { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; }
.schedule-table-card { overflow: hidden; }
.table-headline { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; border-bottom: 1px solid #e8eef7; }
.table-headline h2 span { margin-left: 8px; border-radius: 999px; background: #edf2f7; color: #64748b; padding: 2px 8px; font-size: 11px; }
.table-tools { display: flex; gap: 10px; align-items: center; }
.table-tools label {
  width: 170px; height: 34px; border: 1px solid #d7e1ee; border-radius: 999px; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: #fff;
}
.table-tools label input { border: 0; height: auto; padding: 0; min-width: 0; }
.table-tools svg { color: #94a3b8; }
.table-tools select { width: 118px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { text-align: left; color: #64748b; font-size: 10.5px; font-weight: 850; padding: 10px 18px; border-bottom: 1px solid #e8eef7; }
td { color: #334155; font-size: 11.5px; font-weight: 750; padding: 10px 18px; border-bottom: 1px solid #eef3f8; vertical-align: middle; white-space: pre-line; }
td strong { display: block; color: #0f172a; font-size: 11.5px; margin-bottom: 4px; }
td small { display: block; color: #64748b; font-size: 10.5px; line-height: 1.25; }
.success { color: #16a34a; }
.failed { color: #dc2626; }
td b {
  display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 9.5px; font-weight: 850;
}
.active { background: #dcfce7; color: #047857; }
.paused { background: #fef3c7; color: #b45309; }
.failed-chip { background: #fee2e2; color: #dc2626; }
.actions { display: flex; gap: 8px; }
.actions button {
  width: 28px; height: 28px; border-radius: 999px; border: 1px solid #d9e3f0; background: #fff; color: #52637a; display: grid; place-items: center;
}
.showing { padding: 12px 18px; }
.schedule-rail { display: grid; gap: 14px; align-content: start; margin-top: 56px; }
.rail-card { padding: 18px; }
.how-card > p, .templates-card > p { margin: 10px 0 18px; }
.how-card article { display: flex; gap: 14px; align-items: flex-start; margin-top: 18px; }
.how-card article > span, .templates-card button > span:first-child {
  width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; flex: 0 0 auto;
}
.blue { background: #eef4ff; color: #3156e9; }
.violet { background: #f1efff; color: #6d5dfc; }
.green { background: #e9fbf2; color: #059669; }
.amber { background: #fff7ed; color: #f59e0b; }
.how-card strong, .templates-card strong { display: block; font-size: 11.5px; font-weight: 850; margin-bottom: 5px; }
.templates-card button {
  width: 100%; min-height: 56px; border: 1px solid #dfe7f2; border-radius: 8px; background: #fff; display: grid; grid-template-columns: 38px 1fr 16px; gap: 12px; align-items: center; padding: 10px; text-align: left; margin-top: 10px;
}
.templates-card small { color: #64748b; font-size: 10.5px; font-weight: 700; }
.templates-card button > svg { color: #94a3b8; }
.tips-card ul { list-style: none; padding: 0; margin: 14px 0 18px; display: grid; gap: 12px; }
.tips-card li { display: flex; gap: 9px; align-items: flex-start; color: #52637a; font-size: 10.75px; line-height: 1.35; font-weight: 750; }
.tips-card li svg { color: #16a34a; flex: 0 0 auto; width: 14px; height: 14px; }
.tips-card button {
  border: 0; background: transparent; color: #3156e9; padding: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 850;
}
@media (max-width: 1320px) {
  .schedules-page { grid-template-columns: 1fr; }
  .schedule-rail { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 0; }
}
@media (max-width: 1050px) {
  .form-grid.top, .form-grid.middle, .safety-row { grid-template-columns: 1fr; }
  .form-section, .safety-row article { border-right: 0; border-bottom: 1px solid #e8eef7; }
  .schedule-rail { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
  .schedules-page { padding: 18px; }
  .page-head, .create-head, .table-headline, .table-tools { flex-direction: column; align-items: stretch; }
  .demo-btn, .template-btn, .table-tools label, .table-tools select { width: 100%; }
  .two-fields, .limit-grid { grid-template-columns: 1fr; }
  .preview div { flex-wrap: wrap; }
  .schedule-table-card { overflow-x: auto; }
  table { min-width: 820px; }
}
</style>

