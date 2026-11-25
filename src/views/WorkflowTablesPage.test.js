// @vitest-environment jsdom
// ADM-1367: "New table" did nothing on production - the page set `createOpen`, which its script never declared, and a
// production build drops that assignment silently. Clicking either button must open the New table dialog.
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/services/api', () => ({
  default: {
    getWorkflowTables: vi.fn().mockResolvedValue({ data: { tables: [], workspace: { id: 2, name: 'Default' }, can_create: true } }),
    getWorkflowTableUsage: vi.fn().mockResolvedValue({ data: null }),
  },
}))
vi.mock('@/composables/useBreadcrumbs', () => ({ setBreadcrumbLabel: vi.fn() }))

const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  PageLoader: true,
  TableUsageMeter: true,
  AppDialog: { props: ['open', 'title'], template: '<div v-if="open" role="dialog">{{ title }}<slot /><slot name="footer" /></div>' },
}

describe('WorkflowTablesPage (ADM-1367)', () => {
  it.each([0, 1])('opens the New table dialog from New table button %i', async (which) => {
    const { default: Page } = await import('./WorkflowTablesPage.vue')
    const w = mount(Page, { global: { stubs } })
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    const buttons = w.findAll('button').filter((b) => b.text().includes('New table'))
    expect(buttons.length).toBe(2)
    await buttons[which].trigger('click')
    expect(w.get('[role="dialog"]').text()).toContain('New table')
    w.unmount()
  }, 20000)   // the first import of the page is slow on a busy machine
})
