// @vitest-environment jsdom
// The composer's context ring (owner, 2026-11-17: "show context fullness how much currently like claude showing").
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ContextUsageRing from './ContextUsageRing.vue'
import { useChatStore, normalizeContextUsage } from '../../stores/useChatStore'

describe('normalizeContextUsage', () => {
  it('reads the frame the run sends', () => {
    expect(normalizeContextUsage({ used_tokens: 124000, window_tokens: 200000, compact_at_percent: 85 }))
      .toEqual({ used: 124000, window: 200000, percent: 62, compactAt: 85 })
  })

  it('says nothing for a frame with no usable numbers', () => {
    expect(normalizeContextUsage(null)).toBeNull()
    expect(normalizeContextUsage({ used_tokens: 10 })).toBeNull()
    expect(normalizeContextUsage({ used_tokens: 10, window_tokens: 0 })).toBeNull()
  })
})

describe('ContextUsageRing', () => {
  let chat
  beforeEach(() => {
    setActivePinia(createPinia())
    chat = useChatStore()
  })

  it('is hidden before the first measurement', () => {
    const w = mount(ContextUsageRing)
    expect(w.find('[data-test="context-usage-ring"]').exists()).toBe(false)
  })

  it('shows the share used, in words as well as the ring', async () => {
    chat.contextUsage = normalizeContextUsage({ used_tokens: 124000, window_tokens: 200000, compact_at_percent: 85 })
    const w = mount(ContextUsageRing)
    const ring = w.find('[data-test="context-usage-ring"]')
    expect(ring.attributes('role')).toBe('meter')
    expect(ring.attributes('aria-valuenow')).toBe('62')
    expect(ring.attributes('aria-label')).toContain('62% used, 124k of 200k tokens')
    expect(w.text()).toContain('62% of context used')
    expect(w.text()).toContain('The earlier conversation is summarized at 85%')
    expect(ring.classes()).toContain('is-ok')
  })

  it('from 85% of the auto-compact point says how much is left, and past it that it compacts next', async () => {
    // The point: 85% of 200k = 170k tokens. 85% of it is 144.5k.
    chat.contextUsage = normalizeContextUsage({ used_tokens: 144000, window_tokens: 200000, compact_at_percent: 85 })
    const w = mount(ContextUsageRing)
    expect(w.find('[data-test="context-usage-ring"]').classes()).toContain('is-ok')
    expect(w.text()).not.toContain('left until auto-compact')
    chat.contextUsage = normalizeContextUsage({ used_tokens: 144500, window_tokens: 200000, compact_at_percent: 85 })
    await w.vm.$nextTick()
    const ring = w.find('[data-test="context-usage-ring"]')
    expect(ring.classes()).toContain('is-near')
    expect(w.find('[data-test="compact-line"]').text()).toBe('15% left until auto-compact')
    expect(ring.attributes('aria-label')).toContain('15% left until auto-compact')       // in the label too
    expect(w.find('[data-test="compact-now"]').exists()).toBe(true)                       // Compact now is there
    chat.contextUsage = normalizeContextUsage({ used_tokens: 160000, window_tokens: 200000, compact_at_percent: 85 })
    await w.vm.$nextTick()
    expect(w.find('[data-test="compact-line"]').text()).toBe('6% left until auto-compact')
    chat.contextUsage = normalizeContextUsage({ used_tokens: 180000, window_tokens: 200000, compact_at_percent: 85 })
    await w.vm.$nextTick()
    expect(w.find('[data-test="context-usage-ring"]').classes()).toContain('is-full')
    expect(w.text()).toContain('Auto-compacts on the next step')
  })

  it('the warning follows the trigger the run sends, a 120k cap compacting at 87k (73%)', async () => {
    chat.contextUsage = normalizeContextUsage({ used_tokens: 75000, window_tokens: 120000, compact_at_percent: 73 })
    const w = mount(ContextUsageRing)
    expect(w.find('[data-test="context-usage-ring"]').classes()).toContain('is-near')
    expect(w.find('[data-test="compact-line"]').text()).toBe('14% left until auto-compact')
  })

  it('takes an optional focus for the summary, sent with Compact now or Enter, then cleared', async () => {
    chat.contextUsage = normalizeContextUsage({ used_tokens: 124000, window_tokens: 200000, compact_at_percent: 85 })
    chat.conversationId = '41'
    const spy = vi.spyOn(chat, 'compactNow').mockResolvedValue()
    const w = mount(ContextUsageRing)
    const input = w.find('[data-test="compact-focus"]')
    expect(input.attributes('maxlength')).toBe('2000')
    expect(input.element.closest('label').textContent).toContain('Focus on')        // a visible label
    await input.setValue('  the checkout bug ')
    await w.find('[data-test="compact-now"]').trigger('click')
    expect(spy).toHaveBeenLastCalledWith('the checkout bug')
    expect(input.element.value).toBe('')
    await input.setValue('the cart')
    await input.trigger('keydown', { key: 'Enter' })
    expect(spy).toHaveBeenLastCalledWith('the cart')
    chat.isStreaming = true
    await w.vm.$nextTick()
    expect(w.find('[data-test="compact-focus"]').attributes('disabled')).toBeDefined()
  })

  it('carries Compact now, which asks the store and shows what came of it', async () => {
    chat.contextUsage = normalizeContextUsage({ used_tokens: 124000, window_tokens: 200000, compact_at_percent: 85 })
    chat.conversationId = '41'
    const spy = vi.spyOn(chat, 'compactNow').mockResolvedValue()
    const w = mount(ContextUsageRing)
    const btn = w.find('[data-test="compact-now"]')
    expect(btn.text()).toBe('Compact now')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('')                                   // no focus given
    chat.compaction = { status: 'running', message: '' }
    await w.vm.$nextTick()
    expect(w.find('[data-test="compact-now"]').text()).toBe('Compacting…')
    expect(w.find('[data-test="compact-now"]').attributes('disabled')).toBeDefined()
    expect(w.find('.cur').classes()).toContain('is-open')                 // stays open while it runs
    expect(w.find('[data-test="compact-status"]').text()).toBe('Summarizing the earlier conversation…')
    chat.compaction = { status: 'failed', message: 'There is too little to compact.' }
    await w.vm.$nextTick()
    const st = w.find('[data-test="compact-status"]')
    expect(st.text()).toBe('There is too little to compact.')
    expect(st.classes()).toContain('is-err')
    expect(st.attributes('aria-live')).toBe('polite')
  })

  it('cannot be pressed while a reply is being written, and says when it can', async () => {
    chat.contextUsage = normalizeContextUsage({ used_tokens: 1000, window_tokens: 200000, compact_at_percent: 85 })
    chat.conversationId = '41'
    chat.isStreaming = true
    const w = mount(ContextUsageRing)
    expect(w.find('[data-test="compact-now"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Available when the reply has finished.')
  })
})

// Beside Send it read as a loading spinner while nothing ran (owner, 2026-11-25): a thin open arc. It is a gauge: a
// closed, filled ring with a wedge for the share used, and nothing on it moves.
describe('the ring is a gauge, not a spinner', () => {
  beforeEach(() => { setActivePinia(createPinia()) })
  it('is a closed filled ring with a wedge from twelve o\'clock, and has no animation', () => {
    useChatStore().contextUsage = normalizeContextUsage({ used_tokens: 6000, window_tokens: 200000, compact_at_percent: 85 })
    const w = mount(ContextUsageRing)
    const [track, wedge] = w.findAll('circle')
    expect(track.attributes('r')).toBe('8')
    expect(wedge.attributes('r')).toBe('3.5')
    expect(wedge.attributes('transform')).toBe('rotate(-90 10 10)')
    const on = Number(wedge.attributes('stroke-dasharray').split(' ')[0])
    expect(on).toBeGreaterThan(0)
    expect(on).toBeLessThan(2 * Math.PI * 3.5 * 0.05)                   // 3% of the wedge's circle
    expect(w.findAll('[class*="spin"], animate, animateTransform')).toHaveLength(0)
  })
})
