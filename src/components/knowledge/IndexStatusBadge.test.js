// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IndexStatusBadge from './IndexStatusBadge.vue'

describe('IndexStatusBadge', () => {
  const states = ['uploaded', 'queued', 'converting', 'chunking', 'embedding', 'ready', 'failed']

  it('renders every pipeline state with a data-test hook', () => {
    for (const s of states) {
      const w = mount(IndexStatusBadge, { props: { status: s } })
      expect(w.find(`[data-test="status-${s}"]`).exists()).toBe(true)
    }
  })

  it('labels converting/chunking/embedding as busy', () => {
    for (const s of ['converting', 'chunking', 'embedding']) {
      const w = mount(IndexStatusBadge, { props: { status: s } })
      expect(w.find('.is-busy').exists()).toBe(true)
      expect(w.find('.isb-dot').exists()).toBe(true)  // animated busy dot
    }
  })

  it('shows ready as success with a check', () => {
    const w = mount(IndexStatusBadge, { props: { status: 'ready' } })
    expect(w.find('.is-ok').exists()).toBe(true)
    expect(w.text()).toContain('Ready')
  })

  it('shows failed with the error as the tooltip', () => {
    const w = mount(IndexStatusBadge, { props: { status: 'failed', error: 'ORIGINAL_FILE_MISSING' } })
    expect(w.find('.is-err').exists()).toBe(true)
    expect(w.find('[data-test="status-failed"]').attributes('title')).toBe('ORIGINAL_FILE_MISSING')
  })

  it('falls back to queued for an unknown status', () => {
    const w = mount(IndexStatusBadge, { props: { status: 'weird' } })
    expect(w.text()).toContain('Queued')
  })

  it('hides the label in compact mode', () => {
    const w = mount(IndexStatusBadge, { props: { status: 'ready', compact: true } })
    expect(w.find('.isb-label').exists()).toBe(false)
  })
})
