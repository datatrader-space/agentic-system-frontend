// @vitest-environment jsdom
//
// THE MEMORIES AN ANSWER DREW ON, UNDER THE ANSWER.
//
// The backend records the saved facts, past runs and learned practices that were in front of the agent (or
// that it opened) with each answer. These pin that they are shown, that a saved fact is corrected right
// there — outdated (with undo) or forgotten (after asking once more) — through the Settings → Memory
// endpoints, and that past runs and learned practices are shown but never edited.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: {
    updateGlobalMemory: vi.fn(),
    deleteGlobalMemory: vi.fn(),
  },
}))

import api from '../../services/api'
import MemoryChips from './MemoryChips.vue'
import { useChatStore } from '../../stores/useChatStore'

enableAutoUnmount(afterEach)

const FACT = { ref: 'm:2302', kind: 'fact', id: 2302, status: 'current', via: 'prompt',
  text: 'We deploy straight to production; staging is no longer required first.' }
const RUN = { ref: 'run:2978', kind: 'run', via: 'opened', outcome: 'partial',
  text: 'Count the lines in the file /tmp/acc-tau.md' }
const HINT = { ref: 'hint:45', kind: 'hint', via: 'prompt', text: 'Run migrations before seeding data.' }

const mountIt = (memories) => mount(MemoryChips, {
  props: { message: { id: 'm2', role: 'assistant', status: 'done', content: 'ok', memories } },
})

describe('MemoryChips', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows each memory the answer drew on, by kind', () => {
    const w = mountIt([FACT, RUN, HINT])
    const chips = w.findAll('.mc-chip')
    expect(chips.map((c) => c.attributes('data-ref'))).toEqual(['m:2302', 'run:2978', 'hint:45'])
    expect(chips[0].text()).toContain('Saved')
    expect(chips[1].text()).toContain('Past run')
    expect(chips[2].text()).toContain('Learned')
    expect(chips[1].attributes('title')).toContain('The agent opened this memory')
  })

  it('renders nothing when the answer drew on no memory', () => {
    expect(mountIt([]).find('[data-test="memory-chips"]').exists()).toBe(false)
  })

  it('marks a saved fact outdated, and undoes it', async () => {
    api.updateGlobalMemory.mockResolvedValue({ data: {} })
    const w = mountIt([FACT])
    await w.find('.mc-chip').trigger('click')
    await w.find('[data-test="outdated"]').trigger('click')
    await flushPromises()
    expect(api.updateGlobalMemory).toHaveBeenCalledWith(2302, { status: 'archived' })
    expect(w.find('.mc-chip').classes()).toContain('outdated')
    await w.find('[data-test="undo"]').trigger('click')
    await flushPromises()
    expect(api.updateGlobalMemory).toHaveBeenLastCalledWith(2302, { status: 'active' })
    expect(w.find('.mc-chip').classes()).not.toContain('outdated')
  })

  it('asks once more before forgetting a fact for good', async () => {
    api.deleteGlobalMemory.mockResolvedValue({ data: {} })
    const w = mountIt([FACT])
    await w.find('.mc-chip').trigger('click')
    await w.find('[data-test="forget"]').trigger('click')
    expect(api.deleteGlobalMemory).not.toHaveBeenCalled()
    await w.find('[data-test="confirm-forget"]').trigger('click')
    await flushPromises()
    expect(api.deleteGlobalMemory).toHaveBeenCalledWith(2302)
    expect(w.find('.mc-chip').classes()).toContain('forgotten')
  })

  it("says so when the memory isn't the person's to change", async () => {
    api.updateGlobalMemory.mockRejectedValue({ response: { status: 404 } })
    const w = mountIt([FACT])
    await w.find('.mc-chip').trigger('click')
    await w.find('[data-test="outdated"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain("isn't one of yours")
    expect(w.find('.mc-chip').classes()).not.toContain('outdated')
  })

  it('shows past runs and learned practices without edit actions', async () => {
    const w = mountIt([RUN, HINT])
    for (const chip of w.findAll('.mc-chip')) await chip.trigger('click')
    expect(w.find('.mc-panel').exists()).toBe(false)
  })
})

describe('the memories_used frame', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('attaches the memories to the answer it was saved as', () => {
    const chat = useChatStore()
    chat.messages = [
      { id: 'a1', serverId: 11, role: 'assistant', status: 'done', memories: [] },
      { id: 'a2', serverId: 12, role: 'assistant', status: 'done', memories: [] },
    ]
    chat._onEvent({ type: 'memories_used', message_id: 11, memories: [FACT] })
    expect(chat.messages[0].memories).toEqual([FACT])
    expect(chat.messages[1].memories).toEqual([])
  })
})
