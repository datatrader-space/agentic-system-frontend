// The schedule step as a person picks it (ADM-1354): pure helpers, no DOM, no Vue.
//
// THE RULE IS THE SERVER'S. A schedule step stores the person's choice (`mode` and that mode's fields, plus `timezone`)
// and agent/services/cron.py `schedule_rule` turns it into what the scheduler fires: validation, the tick and the
// next-runs preview (POST /api/workflow-graphs/schedule-preview/) all read it there. This file only says the choice in
// a few words for the canvas and fills a mode's starting values; it never builds a cron the server would not.
//
// The steps a mode allows (every 5 minutes, every 3 hours) come from the step registry's `every` field `choices`, so
// the list here and the check there are the same list.
import { wfDef } from '@/config/wfNodeDefinitions'
import { browserTimeZone } from '@/utils/timeZone'

export const SCHEDULE_TYPE = 'trigger.schedule'

export const SCHEDULE_MODES = [
  { value: 'minutes', label: 'Every few minutes' },
  { value: 'hours', label: 'Every few hours' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'days', label: 'Every few days' },
  { value: 'cron', label: 'Custom (cron)' },
]

// Cron numbers the days 0-6 from Sunday; the picker lists them from Monday.
export const WEEKDAYS = [
  { value: 1, short: 'Mon', long: 'Monday' }, { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' }, { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' }, { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
]

/** Every IANA zone this browser knows, with `current` kept in the list even when the browser does not know it. */
export function timeZones(current = '') {
  let zones = []
  try { zones = Intl.supportedValuesOf('timeZone') } catch { zones = [] }
  const all = new Set(['UTC', ...zones])
  if (current) all.add(current)
  return [...all].sort((a, b) => (a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b)))
}

/** The steps the registry allows for `mode` ('minutes' or 'hours'), e.g. [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30]. */
export function everyChoices(mode) {
  const field = (wfDef(SCHEDULE_TYPE)?.fields || []).find((f) => f.key === 'every')
  const list = field?.choices?.[mode]
  return Array.isArray(list) ? list : []
}

/** Today's date (YYYY-MM-DD) in `tz`. */
export function todayIn(tz, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
    const get = (t) => parts.find((p) => p.type === t)?.value
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/**
 * The data to write when the person switches to `mode`: the mode, plus a starting value for each field the mode needs
 * and the step does not have yet (so the step is valid the moment it is picked). Fields of other modes are kept: going
 * back to a mode finds what was there.
 */
export function modePatch(mode, data = {}, now = new Date()) {
  const d = data || {}
  const patch = { mode }
  const keepEvery = (list, fallback) => (list.includes(Number(d.every)) ? Number(d.every) : fallback)
  if (mode === 'minutes') patch.every = keepEvery(everyChoices('minutes'), 15)
  if (mode === 'hours') {
    patch.every = keepEvery(everyChoices('hours'), 1)
    if (d.minute == null) patch.minute = 0
  }
  if (['daily', 'weekly', 'days'].includes(mode) && !d.at) patch.at = '08:00'
  if (mode === 'weekly' && !(Array.isArray(d.weekdays) && d.weekdays.length)) patch.weekdays = [1, 2, 3, 4, 5]
  if (mode === 'days') {
    const n = Number(d.every)
    patch.every = Number.isInteger(n) && n >= 1 && n <= 365 ? n : 3
    if (!d.start_date) patch.start_date = todayIn(d.timezone || browserTimeZone(), now)
  }
  if (mode === 'cron' && !d.cron) patch.cron = '0 8 * * *'
  return patch
}

const plural = (n, one, many) => (Number(n) === 1 ? one : `${n} ${many}`)
const pad2 = (n) => String(n).padStart(2, '0')

/** The schedule in a few words for the canvas ("Every 3 days 02:00 · Europe/London"). '' when nothing is chosen. */
export function scheduleSummary(data) {
  const d = data || {}
  const mode = d.mode || 'cron'
  const zone = d.timezone || 'UTC'
  let text = ''
  if (mode === 'minutes' && d.every) text = `Every ${plural(d.every, 'minute', 'minutes')}`
  else if (mode === 'hours' && d.every) text = `Every ${plural(d.every, 'hour', 'hours')} at :${pad2(Number(d.minute) || 0)}`
  else if (mode === 'daily' && d.at) text = `Daily ${d.at}`
  else if (mode === 'weekly' && d.at && Array.isArray(d.weekdays) && d.weekdays.length) {
    const days = WEEKDAYS.filter((w) => d.weekdays.map(Number).includes(w.value)).map((w) => w.short).join(', ')
    text = `${days} ${d.at}`
  } else if (mode === 'days' && d.every && d.at) text = `Every ${plural(d.every, 'day', 'days')} ${d.at}`
  else if (mode === 'cron' && d.cron) text = `cron ${d.cron}`
  return text ? `${text} · ${zone}` : ''
}

/** Whether the step has its choice made (the canvas's idle vs configured mark; the server still checks it). */
export function scheduleConfigured(data) {
  return !!scheduleSummary(data)
}

/** A run time (ISO, from the preview) as the person reads it in `tz`: "Sat 29 Nov, 02:00". */
export function formatRunTime(iso, tz) {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return String(iso || '')
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz || 'UTC', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(when)
  } catch {
    return when.toISOString()
  }
}
