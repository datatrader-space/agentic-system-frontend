// @vitest-environment jsdom
// ADM-1354: the schedule step's picker. Each mode shows only its own fields; every change is one history entry; the
// next runs and the problems come from the server's preview, and a failed preview says so instead of guessing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import ScheduleSettings from './ScheduleSettings.vue'
import { editorHarness } from '../wfNodeModal.testHarness'
import api from '@/services/api'

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), previewWorkflowSchedule: vi.fn() } }))

let wrapper
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { wrapper?.unmount(); wrapper = null; vi.useRealTimers(); vi.clearAllMocks() })

const answer = (over = {}) => ({ data: { ok: true, summary: 'Every 3 days at 02:00, from 2026-11-29, UTC',
  next: ['2026-11-29T02:00:00+00:00', '2026-12-02T02:00:00+00:00', '2026-12-05T02:00:00+00:00'], problems: [], ...over } })

async function mountSchedule(data) {
  const ctx = editorHarness({ nodeId: 's1', nodes: [{ id: 's1', type: 'trigger.schedule', data }], edges: [], render: () => h(ScheduleSettings) })
  wrapper = mount(ctx.Host, { attachTo: document.body })
  await vi.advanceTimersByTimeAsync(350)
  await flushPromises()
  return ctx
}
const data = (ctx) => ctx.doc.nodes.value.find((n) => n.id === 's1').data

describe('ScheduleSettings (ADM-1354)', () => {
  it('shows the next three runs and the summary from the server, without writing anything', async () => {
    api.previewWorkflowSchedule.mockResolvedValue(answer())
    const start = { mode: 'days', every: 3, at: '02:00', start_date: '2026-11-29', timezone: 'UTC' }
    const ctx = await mountSchedule({ ...start })
    expect(api.previewWorkflowSchedule).toHaveBeenCalledWith(start)
    expect(wrapper.get('.sc-summary').text()).toBe('Every 3 days at 02:00, from 2026-11-29, UTC')
    expect(wrapper.findAll('.sc-next li')).toHaveLength(3)
    expect(ctx.history.past.value).toHaveLength(0)
  })

  it('each mode shows only its own fields', async () => {
    api.previewWorkflowSchedule.mockResolvedValue(answer())
    await mountSchedule({ mode: 'minutes', every: 5, timezone: 'UTC' })
    expect(wrapper.find('input[type="time"]').exists()).toBe(false)
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
    const every = wrapper.get('select')
    expect(every.findAll('option').map((o) => o.text())).toEqual(['1', '2', '3', '4', '5', '6', '10', '12', '15', '20', '30'])
  })

  it('switching mode is ONE history entry that fills what the mode needs', async () => {
    api.previewWorkflowSchedule.mockResolvedValue(answer())
    const ctx = await mountSchedule({ mode: 'daily', at: '02:00', timezone: 'Asia/Karachi' })
    const days = wrapper.findAll('input[type="radio"]').find((r) => r.element.value === 'days')
    await days.setValue(true)
    expect(data(ctx)).toMatchObject({ mode: 'days', every: 3, at: '02:00', timezone: 'Asia/Karachi' })
    expect(data(ctx).start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(ctx.history.past.value.map((e) => e.label)).toEqual(['Edit How often'])
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
  })

  it('weekday buttons toggle the days, each press one entry, and say whether they are on', async () => {
    api.previewWorkflowSchedule.mockResolvedValue(answer())
    const ctx = await mountSchedule({ mode: 'weekly', at: '09:00', weekdays: [1], timezone: 'UTC' })
    const monday = wrapper.get('button[aria-label="Monday"]')
    const friday = wrapper.get('button[aria-label="Friday"]')
    expect(monday.attributes('aria-pressed')).toBe('true')
    await friday.trigger('click')
    expect(data(ctx).weekdays).toEqual([1, 5])
    await monday.trigger('click')
    expect(data(ctx).weekdays).toEqual([5])
    expect(ctx.history.past.value).toHaveLength(2)
  })

  it("shows the server's problem under its field and no next runs", async () => {
    api.previewWorkflowSchedule.mockResolvedValue(answer({ ok: false, next: [], summary: 'Schedule not set',
      problems: [{ message: '"every 5 minutes" is not a cron schedule.', path: 'data.cron' }] }))
    await mountSchedule({ mode: 'cron', cron: 'every 5 minutes', timezone: 'UTC' })
    const err = wrapper.get('.sc-err')
    expect(err.text()).toContain('is not a cron schedule')
    expect(wrapper.get('input[type="text"]').attributes('aria-describedby')).toContain(err.attributes('id'))
    expect(wrapper.find('.sc-next').exists()).toBe(false)
    expect(wrapper.text()).toContain('Fix the settings above to see when it runs.')
  })

  it('a preview that fails says so and offers a retry; it never shows guessed times', async () => {
    api.previewWorkflowSchedule.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(answer())
    await mountSchedule({ mode: 'daily', at: '02:00', timezone: 'UTC' })
    expect(wrapper.get('.sc-fail').text()).toContain('could not be read')
    expect(wrapper.find('.sc-next').exists()).toBe(false)
    await wrapper.get('.sc-retry').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.sc-next li')).toHaveLength(3)
  })

  it('typing a cron is one history entry for the whole edit, and the preview waits for a pause', async () => {
    api.previewWorkflowSchedule.mockResolvedValue(answer())
    const ctx = await mountSchedule({ mode: 'cron', cron: '', timezone: 'UTC' })
    api.previewWorkflowSchedule.mockClear()
    const box = wrapper.get('input[type="text"]')
    await box.trigger('focus')
    for (const v of ['0', '0 8', '0 8 * * *']) { box.element.value = v; await box.trigger('input') }
    await box.trigger('blur')
    expect(data(ctx).cron).toBe('0 8 * * *')
    expect(ctx.history.past.value).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(350)
    expect(api.previewWorkflowSchedule).toHaveBeenCalledTimes(1)
  })
})
