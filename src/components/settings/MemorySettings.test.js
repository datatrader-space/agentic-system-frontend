// @vitest-environment jsdom
// Settings → Memory lists the person's memory per scope (MEMORY_ONE_PLACE_PLAN.md section 3.5), every memory
// editable and deletable, and has no "Project memory" switch (project memory follows the agent's own memory).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  getMemorySettings: vi.fn(),
  updateMemorySettings: vi.fn(),
  regenerateMemoryDigests: vi.fn(),
  getGlobalMemoryDigest: vi.fn(),
  listMemoriesByScope: vi.fn(),
  createGlobalMemory: vi.fn(),
  updateGlobalMemory: vi.fn(),
  deleteGlobalMemory: vi.fn(),
}))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../composables/useConfirm', () => ({ confirm: vi.fn(async () => true) }))

import MemorySettings from './MemorySettings.vue'

const row = (id, content, extra = {}) => ({ id, content, kind: 'fact', status: 'active', pinned: false,
  created_by: 'assistant_tool', updated_at: '2026-11-18T10:00:00Z', ...extra })

const GROUPS = {
  groups: [
    { scope: 'user', label: 'Account-wide', places: [
      { key: 'u:2', label: 'Account-wide', detail: 'Used by all your agents, outside projects',
        memories: [row(1, 'Sajid prefers short answers', { created_by: 'user' })] }] },
    { scope: 'project', label: 'Projects', places: [
      { key: 'r:73', label: 'shop', detail: "Code project: used only in this project's chats",
        memories: [row(350, 'The store ships only within Pakistan')] },
      { key: 'p:5', label: 'Clothing store', detail: "Project: used only in this project's chats",
        memories: [row(360, 'Delivery takes 3 to 5 working days')] }] },
    { scope: 'agent', label: 'Your agents', places: [] },
    { scope: 'shared_agent', label: 'Shared agents', places: [] },
    { scope: 'conversation', label: 'Chat-only', places: [
      { key: 'c:9', label: 'Draft chat', detail: 'Kept for this chat only', memories: [row(400, 'The draft is version two')] }] },
  ],
}

async function mountPage() {
  const w = mount(MemorySettings)
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getMemorySettings.mockResolvedValue({ data: { memory_enabled: true, global_memory_enabled: true,
    agent_memory_enabled: true, end_of_run_learning_enabled: true, history_enabled: true, history_mode: 'auto' } })
  api.getGlobalMemoryDigest.mockResolvedValue({ data: { mode: 'exact', source_count: 1, content: '- x' } })
  api.listMemoriesByScope.mockResolvedValue({ data: GROUPS })
  api.updateGlobalMemory.mockResolvedValue({ data: {} })
  api.deleteGlobalMemory.mockResolvedValue({ data: {} })
})

describe('MemorySettings — memory per scope', () => {
  it('lists every scope with its count and shows account-wide first', async () => {
    const w = await mountPage()
    const tabs = w.findAll('[role="tab"]')
    expect(tabs.map(t => t.text())).toEqual(['Account-wide 1', 'Projects 2', 'Your agents 0', 'Shared agents 0', 'Chat-only 1'])
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(w.text()).toContain('Sajid prefers short answers')
    expect(w.text()).not.toContain('The store ships only within Pakistan')
    w.unmount()
  })

  it('shows each project under its own name', async () => {
    const w = await mountPage()
    await w.findAll('[role="tab"]')[1].trigger('click')
    const places = w.findAll('.gm-place')
    expect(places.map(p => p.find('.gm-place-title').text())).toEqual(['shop', 'Clothing store'])
    expect(places[1].text()).toContain('Delivery takes 3 to 5 working days')
    w.unmount()
  })

  it('edits and deletes a project memory by its id', async () => {
    const w = await mountPage()
    await w.findAll('[role="tab"]')[1].trigger('click')
    await w.find('[aria-label="Edit memory"]').trigger('click')
    expect(w.find('.gm-form-where').text()).toBe('Editing a memory in shop')
    await w.find('textarea').setValue('The store ships within Pakistan and to the UAE')
    await w.findAll('.gm-form button').find(b => b.text() === 'Save').trigger('click')
    await flushPromises()
    expect(api.updateGlobalMemory).toHaveBeenCalledWith(350, expect.objectContaining({
      content: 'The store ships within Pakistan and to the UAE' }))

    await w.find('[aria-label="Delete memory"]').trigger('click')
    await flushPromises()
    expect(api.deleteGlobalMemory).toHaveBeenCalledWith(350)
    w.unmount()
  })

  it('says so when a scope is empty', async () => {
    const w = await mountPage()
    await w.findAll('[role="tab"]')[2].trigger('click')
    expect(w.text()).toContain('None of your agents has a memory of its own yet.')
    w.unmount()
  })

  it('moves between scopes with the arrow keys', async () => {
    const w = await mountPage()
    await w.findAll('[role="tab"]')[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(w.findAll('[role="tab"]')[4].attributes('aria-selected')).toBe('true')
    w.unmount()
  })

  it('searches every scope on the server', async () => {
    vi.useFakeTimers()
    const w = mount(MemorySettings)
    await flushPromises()
    await w.find('input[type="search"]').setValue('ships')
    vi.advanceTimersByTime(300)
    await flushPromises()
    expect(api.listMemoriesByScope).toHaveBeenLastCalledWith({ q: 'ships' })
    vi.useRealTimers()
    w.unmount()
  })

  it('has no Project memory switch', async () => {
    const w = await mountPage()
    expect(w.text()).not.toContain('Project memory')
    expect(w.text()).toContain('Global user memory')
    w.unmount()
  })
})
