// @vitest-environment jsdom
// The sandbox platform is down (ADM-1206): the Files panel says so in plain words, offers Try again, and links to
// support. Live 2026-11-11 it showed ngrok's HTML page instead.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'

vi.mock('@/utils/lazyComponent', () => ({
  lazyComponent: () => ({ props: ['value', 'original', 'language'], template: '<div class="monaco-stub">{{ value }}</div>' }),
}))
vi.mock('../services/api', () => ({
  default: {
    getRepositoryFiles: vi.fn(),
    getFileContent: vi.fn(),
    getSourceControlStatus: vi.fn(),
    getSourceControlDiff: vi.fn(),
    saveFileContent: vi.fn(),
  },
}))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useConfirm', () => ({ confirm: vi.fn(() => Promise.resolve(true)) }))

import api from '../services/api'
import { projectCache } from '@/services/projectCache'

const DOWN = 'The sandbox (where code runs) is temporarily unavailable. This is on our side and our team has been notified. Please try again in a few minutes. If it keeps happening, contact support.'

async function browser() {
  const CodeBrowser = (await import('./CodeBrowser.vue')).default
  const w = mount(CodeBrowser, {
    props: { repositoryId: 4, systemId: 5, editable: true },
    global: { stubs: { Icon: true, RouterLink: RouterLinkStub, SourceControlPanel: { template: '<div />' } } },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  projectCache.clearAll()
  api.getSourceControlStatus.mockResolvedValue({ data: { branch: 'main', clean: true, changes: [], untracked: [] } })
})

describe('CodeBrowser: the sandbox platform is down', () => {
  it('says so plainly, offers Try again, and links to support', async () => {
    api.getRepositoryFiles.mockRejectedValue({ response: { status: 503, headers: { 'retry-after': '60' },
      data: { error: DOWN, sandbox_unavailable: true, code: 'SANDBOX_DOWN', retry_after_seconds: 60 } } })
    const w = await browser()
    const box = w.find('.tree-error')
    expect(box.text()).toContain('temporarily unavailable')
    expect(box.text()).not.toContain('<')
    expect(box.find('.tree-error-retry').text()).toContain('Try again')
    expect(box.findComponent(RouterLinkStub).props('to')).toBe('/dashboard/help-center/support')
  })

  it('another reason (a quota, a stopped sandbox) shows no support link, and Try again clears it', async () => {
    api.getRepositoryFiles.mockRejectedValueOnce({ response: { status: 503,
      data: { error: 'Total disk quota exceeded', sandbox_unavailable: true } } })
    const w = await browser()
    expect(w.find('.tree-error').text()).toContain('Total disk quota exceeded')
    expect(w.findComponent(RouterLinkStub).exists()).toBe(false)
    api.getRepositoryFiles.mockResolvedValue({ data: { entries: [{ name: 'a.txt', path: 'a.txt', type: 'file' }] } })
    await w.find('.tree-error-retry').trigger('click')
    await flushPromises()
    expect(w.find('.tree-error').exists()).toBe(false)
  })
})
