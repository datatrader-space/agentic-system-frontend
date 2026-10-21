// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
const confirmAsk = vi.hoisted(() => vi.fn())
const api = vi.hoisted(() => ({ getBudgetTargets: vi.fn() }))
vi.mock('../services/api', () => ({ default: api }))
vi.mock('../composables/useNotify', () => ({ useNotify: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('../composables/useConfirm', () => ({ useConfirm: () => confirmAsk }))
import BudgetsPage from './BudgetsPage.vue'
import { useBudgetStore } from '../stores/useBudgetStore'
let wrapper
const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
async function render(canManage, provide = {}) {
  const pinia = createPinia(); setActivePinia(pinia)
  const store = useBudgetStore()
  store.$patch({ loaded: true, canManage, hasBudget: true, organization: { id: 7, name: 'Synthetic team' }, selectedOrgId: 7,
    scopes: [{ budget_id: 1, scope_type: 'org', name: 'Team budget', monthly_limit_usd: 100, daily_limit_usd: 20, percent: 10, remaining: 90 }],
    budgets: [{ id: 1, scope_type: 'org', name: 'Team budget' }],
    approvals: [{ id: 4, scope_type: 'org', rule_type: 'monthly_cap', current_spend: 10, projected_spend: 12, limit_value: 100, requested_amount: 2 }],
  })
  for (const action of ['load', 'saveBudget', 'removeBudget', 'decideApproval']) vi.spyOn(store, action).mockResolvedValue(undefined)
  wrapper = mount(BudgetsPage, { props: { compact: true }, attachTo: document.body, global: { plugins: [pinia], provide, stubs: { Icon: { template: '<span />' }, RouterLink } } })
  await flushPromises()
  return { w: wrapper, store }
}
const tab = (w, label) => w.findAll('nav[aria-label="Budget sections"] button').find(button => button.text().includes(label))
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.clearAllMocks() })
describe('compact budgets', () => {
  it('keeps limits, rules, approvals, activity, presets and export reachable without writes on open', async () => {
    const { w, store } = await render(false)
    expect(w.find('.budget-table').exists()).toBe(true)
    expect(w.find('.chart-grid').exists()).toBe(false)
    expect(w.get('button[aria-label="Edit budget for Team budget"]').attributes('disabled')).toBeDefined()
    await tab(w, 'Approvals').trigger('click')
    expect(w.find('.budget-table').exists()).toBe(false)
    expect(w.get('.approve-actions .approve').attributes('disabled')).toBeDefined()
    await tab(w, 'Activity').trigger('click')
    expect(w.find('.events-panel').exists()).toBe(true)
    await tab(w, 'Presets').trigger('click')
    expect(w.find('.presets').exists()).toBe(true)
    expect(w.findAll('.presets button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(store.saveBudget).not.toHaveBeenCalled()
    expect(store.decideApproval).not.toHaveBeenCalled()
  })

  it('keeps destructive confirmation before removing limits', async () => {
    const { w, store } = await render(true)
    confirmAsk.mockResolvedValueOnce(false)
    await w.get('button[aria-label="Delete budget for Team budget"]').trigger('click')
    await flushPromises()
    expect(confirmAsk).toHaveBeenCalledWith(expect.objectContaining({ danger: true }))
    expect(store.removeBudget).not.toHaveBeenCalled()
    confirmAsk.mockResolvedValueOnce(true)
    await w.get('button[aria-label="Delete budget for Team budget"]').trigger('click')
    await flushPromises()
    expect(store.removeBudget).toHaveBeenCalledWith(1)
  })

  it('keeps the editor in the settings dialog host and uses the selected organization for scope targets', async () => {
    const host = document.createElement('div'); document.body.append(host)
    const active = vi.fn()
    api.getBudgetTargets.mockResolvedValue({ data: { targets: [{ id: 12, label: 'Synthetic workspace' }] } })
    const { w, store } = await render(true, { settingsDialogHost: ref(host), settingsOverlayActive: active })
    await w.get('.head-actions .primary').trigger('click')
    await flushPromises()
    const editor = new DOMWrapper(host.querySelector('[data-settings-owned-dialog]'))
    expect(editor.exists()).toBe(true)
    expect(active).toHaveBeenCalledWith(true)
    await editor.get('select').setValue('workspace')
    await flushPromises()
    expect(api.getBudgetTargets).toHaveBeenCalledWith(7, 'workspace')
    expect(editor.text()).toContain('Organization caps')
    expect(store.saveBudget).not.toHaveBeenCalled()
    await editor.get('.bm-x').trigger('click')
    await flushPromises()
    expect(active).toHaveBeenLastCalledWith(false)
  })
})
