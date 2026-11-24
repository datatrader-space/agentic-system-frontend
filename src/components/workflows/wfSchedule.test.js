// ADM-1354: the schedule step's words on the canvas, a mode's starting values, and the steps the registry allows.
import { describe, expect, it } from 'vitest'
import { everyChoices, formatRunTime, modePatch, scheduleConfigured, scheduleSummary, timeZones, todayIn } from './wfSchedule'
import { wfDefaultData } from '@/config/wfNodeDefinitions'
import { nodeConfigPreview, nodeIsConfigured } from '@/utils/wfNodeView'

describe('wfSchedule (ADM-1354)', () => {
  it('reads the allowed steps from the registry: only steps that keep an even pace', () => {
    expect(everyChoices('minutes')).toEqual([1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30])
    expect(everyChoices('hours')).toEqual([1, 2, 3, 4, 6, 8, 12])
    expect(everyChoices('minutes')).not.toContain(7)
  })

  it('says each choice in a few words, with its timezone', () => {
    expect(scheduleSummary({ mode: 'minutes', every: 5, timezone: 'Europe/London' })).toBe('Every 5 minutes · Europe/London')
    expect(scheduleSummary({ mode: 'hours', every: 1, minute: 0 })).toBe('Every hour at :00 · UTC')
    expect(scheduleSummary({ mode: 'daily', at: '02:00', timezone: 'Asia/Karachi' })).toBe('Daily 02:00 · Asia/Karachi')
    expect(scheduleSummary({ mode: 'weekly', at: '09:30', weekdays: [5, 1] })).toBe('Mon, Fri 09:30 · UTC')
    expect(scheduleSummary({ mode: 'days', every: 3, at: '02:00', start_date: '2026-11-29' })).toBe('Every 3 days 02:00 · UTC')
    expect(scheduleSummary({ cron: '0 7 * * *', timezone: 'Europe/London' })).toBe('cron 0 7 * * * · Europe/London')   // saved before modes
    expect(scheduleSummary({ mode: 'weekly', at: '09:00', weekdays: [] })).toBe('')
  })

  it('the canvas card shows the summary and marks an unset step as not configured', () => {
    expect(nodeConfigPreview('trigger.schedule', { mode: 'daily', at: '02:00', timezone: 'UTC' })).toBe('Daily 02:00 · UTC')
    expect(nodeIsConfigured('trigger.schedule', { mode: 'daily', at: '02:00' })).toBe(true)
    expect(scheduleConfigured({ mode: 'cron', cron: '' })).toBe(false)
  })

  it('switching mode fills only what the new mode needs and keeps the rest', () => {
    const now = new Date('2026-11-24T12:00:00Z')
    expect(modePatch('minutes', { at: '02:00' }, now)).toEqual({ mode: 'minutes', every: 15 })
    expect(modePatch('minutes', { every: 10 }, now)).toEqual({ mode: 'minutes', every: 10 })
    expect(modePatch('hours', { every: 10 }, now)).toEqual({ mode: 'hours', every: 1, minute: 0 })   // 10 is not an hour step
    expect(modePatch('weekly', { at: '06:30' }, now)).toEqual({ mode: 'weekly', weekdays: [1, 2, 3, 4, 5] })
    expect(modePatch('days', { timezone: 'Asia/Karachi' }, now)).toEqual({ mode: 'days', every: 3, at: '08:00', start_date: '2026-11-24' })
    expect(modePatch('cron', { cron: '5 4 * * *' }, now)).toEqual({ mode: 'cron' })
  })

  it("today is the chosen timezone's today", () => {
    const lateUtc = new Date('2026-11-24T22:30:00Z')
    expect(todayIn('UTC', lateUtc)).toBe('2026-11-24')
    expect(todayIn('Asia/Karachi', lateUtc)).toBe('2026-11-25')      // 03:30 the next day there
  })

  it('a run time is shown in the chosen timezone', () => {
    const shown = formatRunTime('2026-11-29T02:00:00+00:00', 'Asia/Karachi')
    expect(shown).toMatch(/07:00/)
    expect(formatRunTime('not a time', 'UTC')).toBe('not a time')
  })

  it('the timezone list starts with UTC and keeps an unknown current value', () => {
    const zones = timeZones('Mars/Olympus_Mons')
    expect(zones[0]).toBe('UTC')
    expect(zones).toContain('Mars/Olympus_Mons')
  })

  it("a new schedule step starts daily at 08:00 in the person's own timezone", () => {
    const data = wfDefaultData('trigger.schedule')
    expect(data.mode).toBe('daily')
    expect(data.at).toBe('08:00')
    expect(data.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  })
})
