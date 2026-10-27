// @vitest-environment jsdom
// Partner API guide page (ADM-1082): endpoints read from the guide's own table, grouped; search; copy.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getPartnerDocs: vi.fn() }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../composables/useNotify', () => ({ notify }))
vi.mock('vue-router', () => ({ useRoute: () => ({ hash: '' }) }))

import AdminPartnerGuide from './AdminPartnerGuide.vue'

const MD = `# Partner Agent API — Integration Guide

Intro.

## 1. Concepts

Agents and keys.

## 4. Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| \`GET\` | \`/api/partner/agents/\` | List all agents in your account. |
| \`POST\` | \`/api/partner/agents/\` | **Create** a new agent. |
| \`GET\` | \`/api/partner/agents/{id}/connections/\` | Connectors for this agent. |
| \`POST\` | \`/api/partner/agents/{id}/connections/connect/\` | Connect one for this agent. |
| \`GET\` | \`/api/partner/agents/{id}/usage/\` | Usage & cost stats. |
| \`WS\` | \`/ws/chat/agent/?token=<agent_api_key>\` | Talk to a created agent. |

### Each agent's own connections

Use \`return_url\`.

\`\`\`bash
curl https://<host>/api/partner/agents/501/connections/
\`\`\`
`

const mountPage = async () => {
  api.getPartnerDocs.mockResolvedValue({ data: { content_md: MD, base_url: '/api/partner/agents/' } })
  const w = mount(AdminPartnerGuide, {
    attachTo: document.body,
    global: { stubs: { RouterLink: { props: ['to'], template: '<a class="rl"><slot/></a>' } } },
  })
  await flushPromises()
  return w
}

beforeEach(() => { vi.clearAllMocks() })

describe('Partner API guide page', () => {
  it('groups the endpoints from the guide table', async () => {
    const w = await mountPage()
    expect(w.findAll('.pg-group h3').map(h => h.text())).toEqual(['Agents', 'Connections', 'Usage and cost', 'Chat'])
    expect(w.findAll('.pg-endpoint')).toHaveLength(6)
    expect(w.get('.pg-endpoint .pg-method').text()).toBe('GET')
  })

  it('search narrows the endpoints and the contents', async () => {
    const w = await mountPage()
    await w.get('input[type="search"]').setValue('connect')
    expect(w.findAll('.pg-endpoint').map(e => e.get('.pg-path').text())).toEqual([
      '/api/partner/agents/{id}/connections/', '/api/partner/agents/{id}/connections/connect/'])
    expect(w.findAll('.pg-toc-list a').map(a => a.text())).toContain("Each agent's own connections")
    expect(w.findAll('.pg-toc-list a').map(a => a.text())).not.toContain('1. Concepts')
    await w.get('input[type="search"]').setValue('nothing-like-this')
    expect(w.text()).toContain('No endpoint matches')
  })

  it('copies an endpoint as a full address, and every example has a copy button', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = await mountPage()
    await w.findAll('.pg-endpoint')[3].get('button').trigger('click')
    expect(writeText).toHaveBeenCalledWith(`POST ${window.location.origin}/api/partner/agents/{id}/connections/connect/`)
    const codeCopy = w.get('.pg-md pre .pg-code-copy')
    await codeCopy.trigger('click')
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('/connections/'))
    w.unmount()
  })

  it('shows the guide once, without repeating its own title, with linkable sections', async () => {
    const w = await mountPage()
    expect(w.get('h1').text()).toBe('Partner API guide')
    expect(w.get('.pg-md').text()).not.toContain('Integration Guide')
    expect(w.find(".pg-md h3[id='each-agents-own-connections']").exists()).toBe(true)
  })

  it('says why when the guide cannot be loaded', async () => {
    api.getPartnerDocs.mockRejectedValue({ message: 'Network Error' })
    const w = mount(AdminPartnerGuide, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('Network Error')
  })
})
