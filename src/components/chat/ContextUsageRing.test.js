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

  it('says it summarizes soon near the point, and on the next step past it', async () => {
    chat.contextUsage = normalizeContextUsage({ used_tokens: 160000, window_tokens: 200000, compact_at_percent: 85 })
    const w = mount(ContextUsageRing)
    expect(w.find('[data-test="context-usage-ring"]').classes()).toContain('is-near')
    expect(w.text()).toContain('summarized soon, at 85%')
    chat.contextUsage = normalizeContextUsage({ used_tokens: 180000, window_tokens: 200000, compact_at_percent: 85 })
    await w.vm.$nextTick()
    expect(w.find('[data-test="context-usage-ring"]').classes()).toContain('is-full')
    expect(w.text()).toContain('summarized on the next step')
  })

  it('carries Compact now, which asks the store and shows what came of it', async () => {
    chat.contextUsage = normalizeContextUsage({ used_tokens: 124000, window_tokens: 200000, compact_at_percent: 85 })
    chat.conversationId = '41'
    const spy = vi.spyOn(chat, 'compactNow').mockResolvedValue()
    const w = mount(ContextUsageRing)
    const btn = w.find('[data-test="compact-now"]')
    expect(btn.text()).toBe('Compact Now')
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    expect(spy).toHaveBeenCalledTimes(1)
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
