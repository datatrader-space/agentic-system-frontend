// @vitest-environment jsdom
// Workflows list page (ADM-1333, F16 / F2 / F15): the card actions are real buttons beside the card's own
// button, each with an aria-label; the archive confirmation names a control that exists ("Show archived"), and
// that control and Restore work; the templates picker is a real dialog (role, title, Esc); and the page's
// colours are theme tokens, never hard-coded light ones.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import source from './WorkflowsList.vue?raw'

const api = vi.hoisted(() => ({
  getWorkflowGraphs: vi.fn(),
  getWorkflowGraphTemplates: vi.fn(),
  deleteWorkflowGraph: vi.fn(() => Promise.resolve({ data: { archived: true } })),
  saveWorkflowGraph: vi.fn(() => Promise.resolve({ data: { is_active: true } })),
  getWorkflowGraph: vi.fn(),
  createWorkflowGraph: vi.fn(),
  createWorkflowGraphFromTemplate: vi.fn(),
  exportWorkflowGraph: vi.fn(),
  importWorkflowGraph: vi.fn(),
}))
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
const push = vi.hoisted(() => vi.fn())
vi.mock('../services/api', () => ({ default: api }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmMock }))
vi.mock('../utils/saveBlob', () => ({ saveBlob: vi.fn() }))

import WorkflowsList from './WorkflowsList.vue'

const tick = async () => { await flushPromises(); await nextTick(); await new Promise((r) => setTimeout(r, 0)); await nextTick() }

const page = (rows, extra = {}) => ({ data: { count: rows.length, next: null, results: rows, ...extra } })
const graph = (id, over = {}) => ({
  id, name: `Flow ${id}`, status: 'draft', is_active: true, node_count: 2, run_count: 1, description: '', last_run: null, ...over,
})

let wrapper
function mountPage() {
  wrapper = mount(WorkflowsList, { attachTo: document.body, global: { stubs: { Icon: true, PageLoader: true } } })
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getWorkflowGraphs.mockResolvedValue(page([graph(1), graph(2)]))
})
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

describe('WorkflowsList — card actions (F16)', () => {
  it('puts the actions in real buttons beside the card button, never inside it', async () => {
    const w = mountPage()
    await tick()
    const cards = w.findAll('article.wf-card')
    expect(cards).toHaveLength(2)
    const main = cards[0].find('button.wf-card__main')
    expect(main.exists()).toBe(true)
    // Nothing interactive nested inside the card's own button.
    expect(main.findAll('button, [role="button"], a')).toHaveLength(0)
    const labels = cards[0].findAll('.wf-card__actions button').map((b) => b.attributes('aria-label'))
    expect(labels).toEqual(['Duplicate Flow 1', 'Export Flow 1', 'Archive Flow 1'])
    for (const b of cards[0].findAll('.wf-card__actions button')) expect(b.attributes('type')).toBe('button')
  })

  it('an action does not also open the builder', async () => {
    api.exportWorkflowGraph.mockResolvedValue({ data: {} })
    const w = mountPage()
    await tick()
    await w.find('[aria-label="Export Flow 1"]').trigger('click')
    await tick()
    expect(api.exportWorkflowGraph).toHaveBeenCalledWith(1)
    expect(push).not.toHaveBeenCalled()
    await w.findAll('button.wf-card__main')[0].trigger('click')
    expect(push).toHaveBeenCalledWith('/dashboard/workflow-builder/1')
  })

  it('shows the actions on hover, on keyboard focus inside the card and always on touch', () => {
    expect(source).toMatch(/\.wf-card:focus-within \.wf-card__act/)
    expect(source).toMatch(/\.wf-card:hover \.wf-card__act/)
    expect(source).toMatch(/@media \(hover: none\), \(pointer: coarse\) \{\s*\.wf-card__act, \.wf-card__open \{ opacity: 1; \}/)
  })
})

describe('WorkflowsList — archive names a real control (F16)', () => {
  it('the archive confirmation names "Show archived", which exists on the page', async () => {
    const w = mountPage()
    await tick()
    await w.find('[aria-label="Archive Flow 1"]').trigger('click')
    await tick()
    const msg = confirmMock.mock.calls[0][0].message
    expect(msg).toContain('"Show archived"')
    expect(msg).not.toContain('Include archived')
    expect(w.find('label.wf-list__toggle').text()).toBe('Show archived')
    expect(api.deleteWorkflowGraph).toHaveBeenCalledWith(1)
    expect(w.findAll('article.wf-card')).toHaveLength(1)
  })

  it('Show archived asks the server for archived workflows, and Restore brings one back', async () => {
    const w = mountPage()
    await tick()
    expect(api.getWorkflowGraphs).toHaveBeenLastCalledWith({ limit: 30, offset: 0 })
    api.getWorkflowGraphs.mockResolvedValue(page([graph(1), graph(3, { is_active: false })]))
    await w.find('label.wf-list__toggle input').setValue(true)
    await tick()
    expect(api.getWorkflowGraphs).toHaveBeenLastCalledWith({ limit: 30, offset: 0, include_archived: 'true' })
    const archived = w.findAll('article.wf-card')[1]
    expect(archived.text()).toContain('archived')
    expect(archived.find('[aria-label="Archive Flow 3"]').exists()).toBe(false)
    await archived.find('[aria-label="Restore Flow 3"]').trigger('click')
    await tick()
    expect(api.saveWorkflowGraph).toHaveBeenCalledWith(3, { is_active: true })
    expect(w.findAll('article.wf-card')[1].find('[aria-label="Archive Flow 3"]').exists()).toBe(true)
  })
})

describe('WorkflowsList — templates dialog (F16)', () => {
  const dialog = () => document.body.querySelector('[role="dialog"]')

  it('opens as a labelled dialog, lists the templates, and Esc closes it', async () => {
    api.getWorkflowGraphTemplates.mockResolvedValue({ data: [
      { key: 'digest', name: 'Daily digest', description: 'Summarise', requires: { connections: ['gmail'] } },
    ] })
    const w = mountPage()
    await tick()
    await w.findAll('button').find((b) => b.text().includes('Templates')).trigger('click')
    await tick()
    const d = dialog()
    expect(d).not.toBeNull()
    expect(document.getElementById(d.getAttribute('aria-labelledby')).textContent).toBe('Start from a template')
    expect(d.textContent).toContain('Daily digest')
    expect(d.textContent).toContain('needs gmail')
    expect(d.querySelector('[aria-label="Close"]')).not.toBeNull()
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await tick()
    expect(dialog()).toBeNull()
  })

  it('a failed template load says so with Try again, never "No templates available"', async () => {
    api.getWorkflowGraphTemplates.mockRejectedValueOnce(new Error('down'))
    const w = mountPage()
    await tick()
    await w.findAll('button').find((b) => b.text().includes('Templates')).trigger('click')
    await tick()
    expect(dialog().textContent).toContain('Could not load the templates.')
    expect(dialog().textContent).not.toContain('No templates available')
    api.getWorkflowGraphTemplates.mockResolvedValueOnce({ data: [{ key: 'a', name: 'Alpha', description: '' }] })
    dialog().querySelector('[role="alert"] button').click()
    await tick()
    expect(dialog().textContent).toContain('Alpha')
  })
})

describe('WorkflowsList — theme tokens and icons (F2 / F15)', () => {
  it('uses no hard-coded light colours or fixed-colour utilities', () => {
    // White text on the brand-blue primary button is the one fixed colour (it is the same in both themes).
    const hexes = (source.match(/#[0-9a-fA-F]{3,8}\b/g) || []).filter((h) => h.toLowerCase() !== '#fff')
    expect(hexes).toEqual([])
    expect(source).not.toMatch(/\b(?:bg|text|border)-(?:slate|gray|amber|emerald|rose|red|indigo|white)\b/)
    expect(source).not.toMatch(/\btext-ink(?:-soft|-faint)?\b/)
  })

  it('has no glyphs standing in for icons', () => {
    const template = source.slice(0, source.indexOf('<script'))
    expect(template).not.toMatch(/[×←↻]/)
    expect(template).not.toMatch(/Open builder →/)
  })
})
