// @vitest-environment jsdom
// Cloning a repository from the list names no branch (2026-11-18, Hamza's project 22): GitHub's listing says
// "main" even for an empty repository, and a clone of that named branch failed with "Remote branch main not found".
// The server reads the default branch from the remote itself.
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, params: {} }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}))
vi.mock('../services/api', () => {
  const calls = {}
  const repo = { full_name: 'acme/empty', name: 'empty', clone_url: 'https://github.com/acme/empty.git',
                 default_branch: 'main', private: false }
  const api = new Proxy(calls, {
    get(t, k) {
      if (k === 'githubListRepos') {
        return (t[k] ||= vi.fn(() => Promise.resolve({ data: { success: true, repositories: [repo], account: 'ana' } })))
      }
      if (k === 'createProject') return (t[k] ||= vi.fn(() => Promise.resolve({ data: { repo_id: 7, name: 'empty' } })))
      return (t[k] ||= vi.fn(() => Promise.resolve({ data: {} })))
    },
  })
  return { default: api }
})

import api from '../services/api'
import LetsCode from './LetsCode.vue'

describe('Clone from the repository list', () => {
  it('sends the repository and no branch', async () => {
    const w = mount(LetsCode, { global: { stubs: {
      Icon: true, CodeBrowser: true, UnifiedAgentChat: true, BottomPanel: true, DeployButton: true, ProjectCommands: true,
      ProjectEnv: true, PipelineStepper: true, StatusPill: true, 'router-link': true,
    } } })
    await flushPromises()
    await w.find('button[aria-label="Clone acme/empty"]').trigger('click')
    await flushPromises()
    expect(api.createProject).toHaveBeenCalledTimes(1)
    const sent = api.createProject.mock.calls[0][0]
    expect(sent).toEqual({ github_url: 'https://github.com/acme/empty.git', name: 'empty' })
    expect('branch' in sent).toBe(false)
    w.unmount()
  })
})
