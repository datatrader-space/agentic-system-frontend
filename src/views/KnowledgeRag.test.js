// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../services/api', () => ({
  default: { listKnowledge: vi.fn() },
}))
vi.mock('../composables/useNotify', () => ({ notify: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../composables/useConfirm', () => ({ confirm: vi.fn() }))

import api from '../services/api'
import KnowledgeRag from './KnowledgeRag.vue'

const website = {
  id: 1, name: 'Docs site', kind: 'website', status: 'partial', root_url: 'https://ex.com',
  chunk_count: 40, cost_usd: 0, assigned_agent_count: 0,
  discovered_count: 12, indexed_count: 9, failed_count: 3, error: '3 pages returned HTTP 403',
}
const file = {
  id: 2, name: 'handbook.pdf', kind: 'file', status: 'failed', chunk_count: 0, cost_usd: 0,
  assigned_agent_count: 0, error: 'PDF is password protected',
}
const healthy = {
  id: 3, name: 'notes.txt', kind: 'file', status: 'ready', chunk_count: 4, cost_usd: 0,
  assigned_agent_count: 1, error: '',
}

let wrapper
async function mountPage(resources) {
  api.listKnowledge.mockResolvedValue({ data: { resources, scope: 'user' } })
  wrapper = mount(KnowledgeRag, {
    global: { stubs: { AddWebsiteSourceModal: true, WebSourcePagesModal: true } },
  })
  await flushPromises()
  const rowFor = (name) => wrapper.findAll('tbody tr').find(tr => tr.text().includes(name))
  return { rowFor }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => wrapper?.unmount())

describe('KnowledgeRag — failure details', () => {
  it('shows why a source failed, with the full text on hover', async () => {
    const { rowFor } = await mountPage([file])
    const err = rowFor('handbook.pdf').find('[data-test="kb-error"]')
    expect(err.exists()).toBe(true)
    expect(err.text()).toBe('PDF is password protected')
    expect(err.attributes('title')).toBe('PDF is password protected')
  })

  it('shows no error line for a healthy source', async () => {
    const { rowFor } = await mountPage([healthy])
    expect(rowFor('notes.txt').find('[data-test="kb-error"]').exists()).toBe(false)
  })
})

describe('KnowledgeRag — indexed page count', () => {
  it('shows indexed / discovered pages for a website', async () => {
    const { rowFor } = await mountPage([website])
    const pages = rowFor('Docs site').find('[data-test="kb-pages"]')
    expect(pages.text().replace(/\s+/g, ' ')).toBe('9 / 12')
    expect(pages.attributes('title')).toBe('9 indexed · 12 discovered · 3 failed')
  })

  it('shows a dash for a file, which has no pages', async () => {
    const { rowFor } = await mountPage([healthy])
    expect(rowFor('notes.txt').find('[data-test="kb-pages"]').text()).toBe('—')
  })
})
