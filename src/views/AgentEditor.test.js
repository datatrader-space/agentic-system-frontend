// @vitest-environment jsdom
// The agent editor's save path, pinned.
//
// Each case below was a live defect in the wizard: opening a step re-sent a list nobody touched, tools
// picked before the first save were thrown away, a refused save said only "Failed to save", the header
// Save posted a nameless agent, and the stepper opened steps that then called /agents/undefined/….
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'

const api = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(),
  getCurrentUser: vi.fn(), publishAgent: vi.fn(), pauseAgent: vi.fn(), unpauseAgent: vi.fn(),
}))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const routeBox = vi.hoisted(() => ({ route: null }))

vi.mock('../services/api', () => ({ default: api }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('vue-router', () => ({ useRoute: () => routeBox.route, useRouter: () => router }))

import AgentEditor from './AgentEditor.vue'

// Every step is a stub that only receives the editor's agent — the steps have their own tests, and the
// stub is how a case edits the draft the way a real step would (by mutating the prop).
const step = (cls) => ({ props: ['agent', 'isNew', 'saveFirst'], template: `<div class="${cls}" />` })
const stubs = {
  AgentIdentityStep: step('s-identity'), DefineBrainStep: step('s-brain'), KnowledgeToolsStep: step('s-tools'),
  SubAgentsStep: step('s-team'), SkillsStep: step('s-skills'), CredentialsStep: step('s-credentials'),
  AutonomySafetyStep: step('s-autonomy'), ScopeAssistantStep: step('s-scope'), TestPublishMonitorStep: step('s-final'),
}

const SERVER_AGENT = {
  id: 7, name: 'Lead Intake', description: 'd', agent_policy: { risk_ceiling: 'high' },
  tools: [{ id: 1 }, { id: 2 }], knowledge_sources: [{ id: 5 }], sub_agents: [{ id: 9, name: 'x' }], skills: [{ id: 3 }],
  knowledge_files: [], web_intelligence: { mode: 'auto' }, updated_at: '2026-10-01T00:00:00Z',
}

async function mountEditor({ id = null, query = {}, path = null, staff = false } = {}) {
  routeBox.route = reactive({
    path: path || (id ? `/dashboard/agents/${id}/editor` : '/dashboard/agents/new'),
    params: id ? { id: String(id) } : {},
    query,
  })
  api.getCurrentUser.mockResolvedValue({ data: { user: { is_staff: staff } } })
  const w = mount(AgentEditor, { global: { stubs } })
  await flushPromises()
  return w
}

const button = (w, text) => w.findAll('button').find(b => b.text().trim().startsWith(text))
const draft = (w, cls) => w.findComponent(`.${cls}`).props('agent')
const onStep = (w, cls) => w.find(`.${cls}`).exists()

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: JSON.parse(JSON.stringify(SERVER_AGENT)) })
  api.patch.mockImplementation((url, body) => Promise.resolve({ data: { ...SERVER_AGENT, ...body } }))
})

describe('AgentEditor — an existing agent', () => {
  it('derives all four id lists on load, so a save with no edits sends nothing', async () => {
    const w = await mountEditor({ id: 7 })
    const a = draft(w, 's-identity')
    expect(a.tool_ids).toEqual([1, 2])
    expect(a.knowledge_source_ids).toEqual([5])
    expect(a.sub_agent_ids).toEqual([9])
    expect(a.skill_ids).toEqual([3])

    // What Team / Skills / Knowledge used to do on mount — it must no longer count as an edit.
    a.sub_agent_ids = a.sub_agents.map(s => s.id)
    a.skill_ids = a.skills.map(s => s.id)
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(api.patch).not.toHaveBeenCalled()
    expect(notify.success).toHaveBeenCalledWith('Saved')
  })

  it('never sends a key the server only returns', async () => {
    const w = await mountEditor({ id: 7 })
    const a = draft(w, 's-identity')
    a.name = 'Renamed'
    a.web_intelligence = { mode: 'engines_only' }       // WebIntelligenceCard writes this back
    a.sub_agents = [{ id: 9, name: 'renamed teammate' }]
    a.skills = []
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(api.patch).toHaveBeenCalledTimes(1)
    expect(api.patch).toHaveBeenCalledWith('/agents/7/', { name: 'Renamed' })
  })

  it('shows the server reason for a refused save', async () => {
    const w = await mountEditor({ id: 7 })
    draft(w, 's-identity').name = 'Taken'
    api.patch.mockRejectedValueOnce({ response: { status: 400, data: { name: ['An agent with this name already exists.'] } } })
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('An agent with this name already exists.')

    api.patch.mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Not your agent.' } } })
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenLastCalledWith('Not your agent.')

    api.patch.mockRejectedValueOnce({ response: { status: 400, data: { default_model: ['Invalid pk "9".'] } } })
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenLastCalledWith('default_model: Invalid pk "9".')

    api.patch.mockRejectedValueOnce(new Error('network'))
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenLastCalledWith('Failed to save')
  })

  it('names the footer button after the step that actually comes next', async () => {
    const w = await mountEditor({ id: 7, query: { step: 'tools' } })
    expect(button(w, 'Continue').text()).toContain('Continue to Team')

    const plain = await mountEditor({ id: 7, query: { step: 'autonomy' } })
    expect(button(plain, 'Continue').text()).toContain('Continue to Final')

    const staff = await mountEditor({ id: 7, query: { step: 'autonomy' }, staff: true })
    expect(button(staff, 'Continue').text()).toContain('Continue to Scope')
  })

  it('opens ?step=scope once the user is known to be staff', async () => {
    const w = await mountEditor({ id: 7, query: { step: 'scope' }, staff: true })
    expect(onStep(w, 's-scope')).toBe(true)

    const notStaff = await mountEditor({ id: 7, query: { step: 'scope' }, staff: false })
    expect(onStep(notStaff, 's-identity')).toBe(true)
  })

  it('keeps ?step= in the URL in step with the step on screen', async () => {
    // Opened at ?step=brain; it used to stay "brain" however far the user moved, so a refresh went back.
    const w = await mountEditor({ id: 7, query: { step: 'brain' } })
    expect(onStep(w, 's-brain')).toBe(true)
    expect(router.replace).not.toHaveBeenCalled()             // already says so — nothing to write
    await button(w, 'Continue').trigger('click')
    await flushPromises()
    expect(onStep(w, 's-tools')).toBe(true)
    expect(router.replace).toHaveBeenLastCalledWith({ path: '/dashboard/agents/7/editor', query: { step: 'tools' } })
  })

  it('records what a step saved for itself as server state, not as a pending edit', async () => {
    const w = await mountEditor({ id: 7, query: { step: 'team' } })
    const team = w.findComponent('.s-team')
    const a = team.props('agent')
    a.sub_agent_ids = [9, 11]
    a.sub_agents = [{ id: 9, name: 'x' }, { id: 11, name: 'y' }]
    team.vm.$emit('saved', { sub_agent_ids: a.sub_agent_ids, sub_agents: a.sub_agents })
    await nextTick()
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(api.patch).not.toHaveBeenCalled()
  })
})

describe('AgentEditor — a new agent', () => {
  it('does not POST a nameless agent from the header Save', async () => {
    const w = await mountEditor()
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(api.post).not.toHaveBeenCalled()
    expect(notify.warning).toHaveBeenCalledWith('Please name your agent first.')
  })

  it('does not open a later step before the agent exists', async () => {
    const w = await mountEditor()
    await w.findAll('nav button')[2].trigger('click')        // Knowledge & Tools
    expect(onStep(w, 's-identity')).toBe(true)
    expect(notify.warning).toHaveBeenCalledTimes(1)
    expect(api.get).not.toHaveBeenCalled()

    // …and a ?step= on the "new" URL is ignored for the same reason.
    const deep = await mountEditor({ query: { step: 'tools' } })
    expect(onStep(deep, 's-identity')).toBe(true)
  })

  it('creates without tool_ids, then sends the picked tools, and carries the next step in the URL', async () => {
    const w = await mountEditor()
    const a = draft(w, 's-identity')
    a.name = 'Fresh'
    a.tool_ids = [4, 6]                                       // a template's tools
    api.post.mockResolvedValue({ data: { id: 12, name: 'Fresh', tools: [], knowledge_sources: [], sub_agents: [], skills: [] } })
    api.patch.mockResolvedValue({ data: { id: 12, name: 'Fresh', tools: [{ id: 4 }, { id: 6 }] } })

    await button(w, 'Create Agent').trigger('click')
    await flushPromises()

    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post.mock.calls[0][0]).toBe('/agents/')
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('tool_ids')
    expect(api.patch).toHaveBeenCalledWith('/agents/12/', { tool_ids: [4, 6] })
    expect(router.replace).toHaveBeenCalledWith({ path: '/dashboard/agents/12/editor', query: { step: 'brain' } })
    expect(onStep(w, 's-brain')).toBe(true)
    expect(draft(w, 's-brain').tool_ids).toEqual([4, 6])
    expect(notify.warning).not.toHaveBeenCalled()
  })

  it('keeps the created agent and says so when its tools cannot be added', async () => {
    const w = await mountEditor()
    const a = draft(w, 's-identity')
    a.name = 'Fresh'
    a.tool_ids = [4, 6]
    api.post.mockResolvedValue({ data: { id: 12, name: 'Fresh', tools: [] } })
    api.patch.mockRejectedValue({ response: { status: 400, data: { tool_ids: ['nope'] } } })

    await button(w, 'Create Agent').trigger('click')
    await flushPromises()

    expect(onStep(w, 's-brain')).toBe(true)
    const created = draft(w, 's-brain')
    expect(created.id).toBe(12)
    expect(created.tool_ids).toEqual([])                      // the server's list, not the lost picks
    expect(notify.warning).toHaveBeenCalledTimes(1)
    expect(notify.warning.mock.calls[0][0]).toMatch(/created.*tools could not be added.*Knowledge & Tools/)
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('a plain Save on a new agent stays on the step it was pressed on', async () => {
    const w = await mountEditor()
    draft(w, 's-identity').name = 'Fresh'
    api.post.mockResolvedValue({ data: { id: 12, name: 'Fresh', tools: [] } })
    await button(w, 'Save').trigger('click')
    await flushPromises()
    expect(api.patch).not.toHaveBeenCalled()                  // no tools were picked
    expect(router.replace).toHaveBeenCalledWith({ path: '/dashboard/agents/12/editor', query: { step: 'identity' } })
    expect(onStep(w, 's-identity')).toBe(true)
  })

  it('publishes a new agent before moving to its own URL', async () => {
    // "Configure / Publish" on a brand-new agent: the route replace rebuilds the editor, and the rebuilt
    // one loads the agent as it is THEN — so the publish has to land first, or it shows Draft.
    const w = await mountEditor()
    draft(w, 's-identity').name = 'Fresh'
    api.post.mockResolvedValue({ data: { id: 31, name: 'Fresh', tools: [] } })
    const order = []
    api.publishAgent.mockImplementation(async () => { order.push('publish'); return { data: { publish_status: 'published' } } })
    router.replace.mockImplementation(() => { order.push('route') })
    await button(w, 'Configure / Publish').trigger('click')
    await flushPromises()
    expect(api.publishAgent).toHaveBeenCalledWith(31)
    expect(order).toEqual(['publish', 'route'])
    expect(router.replace).toHaveBeenCalledWith({ path: '/dashboard/agents/31/editor', query: { step: 'identity' } })
  })

  it('opens on the carried step when the shell rebuilds the editor after create', async () => {
    // What the dashboard shell does: the replaced path is a new key, so a brand-new editor mounts on it.
    const w = await mountEditor({ id: 12, query: { step: 'brain' } })
    expect(onStep(w, 's-brain')).toBe(true)
    expect(api.get).toHaveBeenCalledWith('/agents/12/')
  })

  it('stays inside the admin shell', async () => {
    const w = await mountEditor({ path: '/admin-dashboard/agents/new' })
    draft(w, 's-identity').name = 'Sys'
    api.post.mockResolvedValue({ data: { id: 30, name: 'Sys', tools: [] } })
    await button(w, 'Create Agent').trigger('click')
    await flushPromises()
    expect(router.replace).toHaveBeenCalledWith({ path: '/admin-dashboard/agents/30/editor', query: { step: 'brain' } })
  })
})
