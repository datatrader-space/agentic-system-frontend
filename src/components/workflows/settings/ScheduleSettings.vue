<!--
  The schedule step's settings (ADM-1354): how often, at what time, in which timezone, and the next three runs.

  It replaces a bare cron box read in UTC. The person picks a mode (every few minutes / hours, every day, every week,
  every few days, or a cron of their own); each mode shows only its own fields. The rule, the problems and the next
  runs come from the server (POST /api/workflow-graphs/schedule-preview/, agent/services/cron.py), the same code the
  scheduler fires with, so the times shown are the times it runs. Every change is one history operation.
-->
<template>
  <div class="sc">
    <fieldset class="sc-group">
      <legend class="sc-label">How often</legend>
      <div class="sc-modes">
        <label v-for="m in SCHEDULE_MODES" :key="m.value" class="sc-mode" :class="{ on: mode === m.value }">
          <input type="radio" class="sc-radio" :name="`${uid}-mode`" :value="m.value" :checked="mode === m.value" @change="pickMode(m.value)">
          <span>{{ m.label }}</span>
        </label>
      </div>
    </fieldset>

    <!-- every few minutes / hours -->
    <div v-if="mode === 'minutes' || mode === 'hours'" class="sc-row">
      <div class="sc-field">
        <label class="sc-label" :for="`${uid}-every`">Every</label>
        <div class="sc-inline">
          <select :id="`${uid}-every`" class="sc-in sc-narrow" :value="String(data.every ?? '')" :aria-describedby="errId('data.every')"
                  @change="editor.set('every', Number($event.target.value), 'Every')">
            <option v-for="n in everyChoices(mode)" :key="n" :value="String(n)">{{ n }}</option>
          </select>
          <span>{{ mode === 'minutes' ? 'minutes' : 'hours' }}</span>
        </div>
        <FieldProblems :id="errId('data.every')" :list="problemsAt('data.every')" />
      </div>
      <div v-if="mode === 'hours'" class="sc-field">
        <label class="sc-label" :for="`${uid}-minute`">At minute</label>
        <NumberField :id="`${uid}-minute`" label="At minute" :model-value="data.minute ?? 0" :min="0" :max="59" integer
                     :describedby="errId('data.minute')" @update:model-value="(v) => editor.set('minute', v, 'At minute')" />
        <FieldProblems :id="errId('data.minute')" :list="problemsAt('data.minute')" />
      </div>
    </div>

    <!-- every few days -->
    <div v-if="mode === 'days'" class="sc-field">
      <label class="sc-label" :for="`${uid}-days`">Every</label>
      <div class="sc-inline">
        <NumberField :id="`${uid}-days`" label="Every how many days" :model-value="data.every ?? 3" :min="1" :max="365" integer
                     :describedby="errId('data.every')" @update:model-value="(v) => editor.set('every', v, 'Every')" />
        <span>days</span>
      </div>
      <FieldProblems :id="errId('data.every')" :list="problemsAt('data.every')" />
    </div>

    <!-- weekly: which days -->
    <fieldset v-if="mode === 'weekly'" class="sc-group">
      <legend class="sc-label">On</legend>
      <div class="sc-days" :aria-describedby="errId('data.weekdays')">
        <button v-for="w in WEEKDAYS" :key="w.value" type="button" class="sc-day" :class="{ on: weekdays.includes(w.value) }"
                :aria-pressed="weekdays.includes(w.value) ? 'true' : 'false'" :aria-label="w.long" @click="toggleDay(w.value)">
          {{ w.short }}
        </button>
      </div>
      <FieldProblems :id="errId('data.weekdays')" :list="problemsAt('data.weekdays')" />
    </fieldset>

    <!-- a time of day -->
    <div v-if="['daily', 'weekly', 'days'].includes(mode)" class="sc-row">
      <div class="sc-field">
        <label class="sc-label" :for="`${uid}-at`">At</label>
        <input :id="`${uid}-at`" class="sc-in sc-narrow" type="time" step="60" :value="data.at || ''" :aria-describedby="errId('data.at')"
               @change="editor.set('at', $event.target.value, 'At')">
        <FieldProblems :id="errId('data.at')" :list="problemsAt('data.at')" />
      </div>
      <div v-if="mode === 'days'" class="sc-field">
        <label class="sc-label" :for="`${uid}-start`">Starting</label>
        <input :id="`${uid}-start`" class="sc-in sc-narrow" type="date" :value="data.start_date || ''" :aria-describedby="errId('data.start_date')"
               @change="editor.set('start_date', $event.target.value, 'Starting')">
        <FieldProblems :id="errId('data.start_date')" :list="problemsAt('data.start_date')" />
      </div>
    </div>

    <!-- a cron of their own -->
    <div v-if="mode === 'cron'" class="sc-field">
      <label class="sc-label" :for="`${uid}-cron`">Cron</label>
      <input :id="`${uid}-cron`" class="sc-in sc-mono" type="text" :value="data.cron || ''" placeholder="0 8 * * *" autocomplete="off" spellcheck="false"
             translate="no" :aria-describedby="`${uid}-cron-help ${errId('data.cron')}`"
             @focus="editor.begin('Cron')" @blur="editor.end()" @input="editor.set('cron', $event.target.value, 'Cron')">
      <p :id="`${uid}-cron-help`" class="sc-help">Five parts: minute, hour, day of the month, month, day of the week. <code translate="no">30 6 * * 1-5</code> is 06:30 on weekdays.</p>
      <FieldProblems :id="errId('data.cron')" :list="problemsAt('data.cron')" />
    </div>

    <div class="sc-field">
      <label class="sc-label" :for="`${uid}-tz`">Timezone</label>
      <select :id="`${uid}-tz`" class="sc-in" :value="zone" :aria-describedby="errId('data.timezone')" @change="editor.set('timezone', $event.target.value, 'Timezone')">
        <option v-for="z in zones" :key="z" :value="z">{{ z }}</option>
      </select>
      <FieldProblems :id="errId('data.timezone')" :list="problemsAt('data.timezone')" />
    </div>

    <section class="sc-preview" aria-live="polite" :aria-busy="preview.loading ? 'true' : 'false'">
      <h4 class="sc-label">Next runs</h4>
      <p v-if="preview.failed" class="sc-fail" role="alert">
        The next runs could not be read. <button type="button" class="sc-retry" @click="refresh()">Try again</button>
      </p>
      <template v-else-if="preview.ok">
        <p class="sc-summary">{{ preview.summary }}</p>
        <ol class="sc-next">
          <li v-for="t in preview.next" :key="t"><Icon icon="lucide:clock-3" aria-hidden="true" />{{ formatRunTime(t, zone) }}</li>
        </ol>
      </template>
      <p v-else-if="preview.loading" class="sc-help">Working out the next runs…</p>
      <p v-else class="sc-help">Fix the settings above to see when it runs.</p>
    </section>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onBeforeUnmount, reactive, useId, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import NumberField from './NumberField.vue'
import { useNodeEditor } from './nodeEditor'
import { browserTimeZone } from '@/utils/timeZone'
import { SCHEDULE_MODES, WEEKDAYS, everyChoices, formatRunTime, modePatch, timeZones } from '../wfSchedule'

const editor = useNodeEditor()
const uid = `sc-${useId()}`
const data = computed(() => editor.data.value)
const mode = computed(() => data.value.mode || 'cron')
const zone = computed(() => data.value.timezone || 'UTC')
const zones = computed(() => timeZones(zone.value === 'UTC' ? browserTimeZone() : zone.value))
const weekdays = computed(() => (Array.isArray(data.value.weekdays) ? data.value.weekdays.map(Number) : []))

function pickMode(value) {
  editor.patch(modePatch(value, data.value), 'How often')
}

function toggleDay(value) {
  const next = weekdays.value.includes(value) ? weekdays.value.filter((d) => d !== value) : [...weekdays.value, value]
  editor.set('weekdays', next.sort((a, b) => a - b), 'Days of the week')
}

// ── the preview: what the server's rule makes of these settings ──
const preview = reactive({ loading: false, failed: false, ok: false, summary: '', next: [], problems: [] })
let timer = null
let asked = 0
async function refresh() {
  const mine = ++asked
  preview.loading = true
  preview.failed = false
  try {
    const { data: res } = await api.previewWorkflowSchedule(data.value)
    if (mine !== asked) return
    Object.assign(preview, { ok: !!res.ok, summary: res.summary || '', next: res.next || [], problems: res.problems || [] })
  } catch {
    if (mine !== asked) return
    Object.assign(preview, { ok: false, failed: true, next: [], problems: [] })
  } finally {
    if (mine === asked) preview.loading = false
  }
}
watch(() => JSON.stringify([data.value.mode, data.value.every, data.value.minute, data.value.at, data.value.weekdays,
  data.value.start_date, data.value.cron, data.value.timezone]), () => {
  clearTimeout(timer)
  timer = setTimeout(refresh, 300)
}, { immediate: true })
onBeforeUnmount(() => { clearTimeout(timer); asked += 1 })

// The live preview's problems while it has answered; the last save's validation before that.
function problemsAt(path) {
  const live = preview.problems.filter((p) => p.path === path).map((p) => p.message)
  if (live.length || preview.ok) return live
  return editor.issuesAt(path).filter((i) => i.level === 'error').map((i) => i.message)
}
const errId = (path) => (problemsAt(path).length ? `${uid}-${path.replace('data.', '')}-err` : undefined)

const FieldProblems = defineComponent({
  props: { id: { type: String, default: undefined }, list: { type: Array, default: () => [] } },
  setup(props) {
    return () => (props.list.length ? h('p', { id: props.id, class: 'sc-err', role: 'alert' }, props.list.join(' ')) : null)
  },
})
</script>

<style scoped>
.sc { display: grid; gap: 16px; }
.sc-group { min-width: 0; margin: 0; padding: 0; border: 0; display: grid; gap: 6px; }
.sc-label { margin: 0; padding: 0; font-size: 12px; font-weight: 600; color: var(--vm-ink-soft); }
.sc-modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.sc-mode {
  display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 6px 10px; border: 1px solid var(--vm-line-2);
  border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font-size: 13px; cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.sc-mode:hover { border-color: var(--vm-ink-faint); }
.sc-mode.on { border-color: var(--vm-accent, var(--vm-focus)); background: var(--vm-surface-soft); font-weight: 600; }
.sc-mode:focus-within { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.sc-radio { accent-color: var(--vm-accent, var(--vm-focus)); margin: 0; }
.sc-row { display: flex; flex-wrap: wrap; gap: 12px 16px; }
.sc-field { display: grid; gap: 5px; min-width: 0; }
.sc-inline { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--vm-ink); }
.sc-in {
  width: 100%; min-height: 34px; padding: 7px 9px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background-color: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px;
}
.sc-narrow { width: auto; min-width: 7.5rem; }
.sc-mono { font-family: var(--vm-font-mono, ui-monospace, monospace); }
.sc-in:focus-visible, .sc-day:focus-visible, .sc-retry:focus-visible { outline: 2px solid var(--vm-focus); outline-offset: 1px; }
.sc-days { display: flex; flex-wrap: wrap; gap: 6px; }
.sc-day {
  min-width: 44px; min-height: 34px; padding: 0 10px; border: 1px solid var(--vm-line-2); border-radius: 6px;
  background: var(--vm-surface); color: var(--vm-ink); font: inherit; font-size: 13px; cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.sc-day.on { border-color: var(--vm-accent, var(--vm-focus)); background: var(--vm-surface-soft); font-weight: 600; }
.sc-help, .sc-fail { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-ink-faint); }
.sc-help code { font-family: var(--vm-font-mono, ui-monospace, monospace); color: var(--vm-ink-soft); }
.sc-err { margin: 0; font-size: 12px; line-height: 1.5; color: var(--vm-danger, #b42318); }
.sc-fail { color: var(--vm-ink-soft); }
.sc-retry { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-decoration: underline; cursor: pointer; }
.sc-preview { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--vm-line); border-radius: 8px; background: var(--vm-surface-soft); }
.sc-summary { margin: 0; font-size: 13px; color: var(--vm-ink); }
.sc-next { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 13px; color: var(--vm-ink); font-variant-numeric: tabular-nums; }
.sc-next li { display: flex; align-items: center; gap: 6px; }
.sc-next :deep(svg) { width: 14px; height: 14px; color: var(--vm-ink-faint); flex-shrink: 0; }
@media (pointer: coarse) { .sc-mode, .sc-in, .sc-day { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .sc-mode, .sc-day { transition: none; } }
</style>
