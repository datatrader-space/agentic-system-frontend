// @vitest-environment jsdom
// The agent editor's steps — the behaviours that were wrong in each one, pinned.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, nextTick, computed } from 'vue'

afterEach(() => { vi.unstubAllGlobals() })

const api = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(),
  listAgentTemplates: vi.fn(),
  getAgentGuardrails: vi.fn(), getBudgets: vi.fn(), createBudget: vi.fn(), getAgentActionUsage: vi.fn(),
  getAgentMonitoring: vi.fn(), publishAgent: vi.fn(), rollbackAgent: vi.fn(),
  getAgentWebIntelligence: vi.fn(), getWebSearchModels: vi.fn(), probeWebSearchModel: vi.fn(),
  updateAgentWebIntelligence: vi.fn(),
  getAgentEffectivePolicy: vi.fn(), getMemorySettings: vi.fn(), getAgentMemoryDigest: vi.fn(), getAgentMemory: vi.fn(),
}))
const tenancyApi = vi.hoisted(() => ({ getAllWorkspaces: vi.fn() }))
const credentialsApi = vi.hoisted(() => ({ listGlobal: vi.fn(), assign: vi.fn(), detach: vi.fn() }))
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('../../services/api', () => ({ default: api }))
vi.mock('../../services/tenancyApi', () => ({ default: tenancyApi }))
vi.mock('../../services/toolsApi', () => ({ credentialsApi }))
vi.mock('@/composables/useNotify', () => ({ notify }))
vi.mock('@/composables/useConfirm', () => ({ confirm, useConfirm: () => confirm }))
vi.mock('vue-router', () => ({
  useRouter: () => router, useRoute: () => ({ params: {}, query: {}, path: '/' }),
  RouterLink: { template: '<a><slot/></a>' },
}))

import AgentIdentityStep from './AgentIdentityStep.vue'
import AutonomySafetyStep from './AutonomySafetyStep.vue'
import CredentialsStep from './CredentialsStep.vue'
import DefineBrainStep from './DefineBrainStep.vue'
import KnowledgeToolsStep from './KnowledgeToolsStep.vue'
import ScopeAssistantStep from './ScopeAssistantStep.vue'
import SkillsStep from './SkillsStep.vue'
import SubAgentsStep from './SubAgentsStep.vue'
import TestPublishMonitorStep from './TestPublishMonitorStep.vue'
import WebIntelligenceCard from './WebIntelligenceCard.vue'
import { provideEditorShell } from '../../composables/editorShell'

const stubs = {
  RouterLink: { template: '<a><slot/></a>' }, 'router-link': { template: '<a><slot/></a>' },
  ModelPicker: { template: '<div />' }, ContextProfilePicker: { template: '<div />' },
  AgentEmulator: { template: '<div />' }, Teleport: true,
}
const button = (w, text) => w.findAll('button').find(b => b.text().trim().startsWith(text))

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: [] })
  api.patch.mockResolvedValue({ data: {} })
  api.getAgentGuardrails.mockResolvedValue({ data: {} })
  api.getBudgets.mockResolvedValue({ data: [] })
  api.getAgentEffectivePolicy.mockResolvedValue({ data: {} })
  api.getMemorySettings.mockResolvedValue({ data: {} })
  api.getAgentMemoryDigest.mockResolvedValue({ data: null })
  api.getAgentMemory.mockResolvedValue({ data: { memories: [] } })
  api.getWebSearchModels.mockResolvedValue({ data: { models: [] } })
  api.getAgentWebIntelligence.mockResolvedValue({ data: { config: {}, effective: {}, editable: true } })
  tenancyApi.getAllWorkspaces.mockResolvedValue({ data: [] })
})

describe('AgentIdentityStep — templates', () => {
  const T = (id, extra = {}) => ({
    id, name: `T${id}`, template_description: `desc ${id}`, system_prompt_template: `prompt ${id}`,
    prompt_mode: 'replace', agent_rules: [`rule ${id}`], tools: [{ id: id * 10 }], ...extra,
  })
  const blank = () => reactive({ name: '', description: '', tool_ids: [], prompt_mode: 'append' })
  async function mountIdentity(agent, templates) {
    api.listAgentTemplates.mockResolvedValue({ data: templates })
    const w = mount(AgentIdentityStep, { props: { agent, isNew: true }, global: { stubs } })
    await flushPromises()
    return w
  }
  const card = (w, title) => w.findAll('button').find(b => b.text().includes(title))

  it('shows every template behind a toggle, only when there are more than three', async () => {
    const few = await mountIdentity(blank(), [T(1), T(2), T(3)])
    expect(button(few, 'Show all templates')).toBeUndefined()

    const many = await mountIdentity(blank(), [T(1), T(2), T(3), T(4), T(5)])
    expect(card(many, 'T5')).toBeUndefined()
    await button(many, 'Show all templates').trigger('click')
    expect(card(many, 'T5')).toBeDefined()
    await button(many, 'Show fewer').trigger('click')
    expect(card(many, 'T5')).toBeUndefined()
  })

  it('keeps the selected template on screen when the rest are folded away', async () => {
    const w = await mountIdentity(blank(), [T(1), T(2), T(3), T(4), T(5)])
    await button(w, 'Show all templates').trigger('click')
    await card(w, 'T5').trigger('click')
    await button(w, 'Show fewer').trigger('click')
    expect(card(w, 'T5')).toBeDefined()        // the chosen one
    expect(card(w, 'T4')).toBeUndefined()      // the rest are folded
  })

  it('a second template replaces the first, and blank puts everything back', async () => {
    const agent = blank()
    const w = await mountIdentity(agent, [T(1), T(2, { prompt_mode: '', agent_rules: null, tools: null })])

    await card(w, 'T1').trigger('click')
    expect(agent.system_prompt_template).toBe('prompt 1')
    expect(agent.tool_ids).toEqual([10])

    // T2 sets no mode, rules or tools of its own — T1's must not survive underneath it.
    await card(w, 'T2').trigger('click')
    expect(agent.system_prompt_template).toBe('prompt 2')
    expect(agent.description).toBe('desc 2')
    expect(agent.prompt_mode).toBe('append')
    expect(agent.agent_rules).toBeUndefined()
    expect(agent.tool_ids).toEqual([])

    await card(w, 'Start from blank').trigger('click')
    expect(agent).toEqual({ name: '', description: '', tool_ids: [], prompt_mode: 'append' })
  })

  it('never takes back a purpose the user typed', async () => {
    const agent = blank()
    const w = await mountIdentity(agent, [T(1), T(2)])
    await card(w, 'T1').trigger('click')
    agent.description = 'my own purpose'              // typed over the template's text
    await card(w, 'T2').trigger('click')
    expect(agent.description).toBe('my own purpose')
    await card(w, 'Start from blank').trigger('click')
    expect(agent.description).toBe('my own purpose')
    expect(agent.system_prompt_template).toBeUndefined()
  })
})

describe('rendering a step does not edit the draft', () => {
  it('DefineBrainStep leaves a missing agent_policy missing', async () => {
    const agent = reactive({ id: 1 })
    mount(DefineBrainStep, { props: { agent }, global: { stubs } })
    await flushPromises()
    expect('agent_policy' in agent).toBe(false)
  })

  it('AutonomySafetyStep leaves a missing agent_policy missing, and writes one on a real change', async () => {
    const agent = reactive({ id: 1 })
    const w = mount(AutonomySafetyStep, { props: { agent }, global: { stubs } })
    await flushPromises()
    expect('agent_policy' in agent).toBe(false)

    await w.find('select').setValue('low')               // "Require approval for actions above"
    expect(agent.agent_policy).toEqual({ risk_ceiling: 'low' })
  })
})

describe('AutonomySafetyStep', () => {
  it('confirms a saved spending limit (notify was used without being imported)', async () => {
    api.createBudget.mockResolvedValue({ data: { id: 4 } })
    const w = mount(AutonomySafetyStep, { props: { agent: reactive({ id: 1, name: 'A' }) }, global: { stubs } })
    await flushPromises()
    await button(w, 'Save limit').trigger('click')
    await flushPromises()
    expect(api.createBudget).toHaveBeenCalledTimes(1)
    expect(notify.success).toHaveBeenCalledWith('Spending limit saved')

    api.createBudget.mockRejectedValue({ response: { status: 403 } })
    await button(w, 'Save limit').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('You need budget-manage permission for this organization')
  })

  it('points its links at real destinations', async () => {
    const w = mount(AutonomySafetyStep, { props: { agent: reactive({ id: 1, tool_ids: [] }) }, global: { stubs } })
    await flushPromises()
    await button(w, 'View Autonomy Guide').trigger('click')
    expect(router.push).toHaveBeenLastCalledWith({ path: '/dashboard/help-center/docs', query: { area: 'Agents' } })
    // The Knowledge & Tools step is asked of the editor, not pushed as a URL (a push to the address the
    // editor is already on does nothing).
    await button(w, 'Knowledge & Tools').trigger('click')
    expect(w.emitted('open-step')).toEqual([['tools']])
  })
})

describe('steps that need a saved agent say so', () => {
  it('CredentialsStep — Attach on an unsaved agent warns instead of doing nothing', async () => {
    credentialsApi.listGlobal.mockResolvedValue({ data: { credentials: [{ id: 3, is_global: true, credential_name: 'Key' }] } })
    const w = mount(CredentialsStep, { props: { agent: reactive({}) }, global: { stubs } })
    await flushPromises()
    await button(w, 'Attach').trigger('click')
    expect(credentialsApi.assign).not.toHaveBeenCalled()
    expect(notify.info).toHaveBeenCalledWith('Save your agent first, then attach credentials.')
  })

  it('SkillsStep — "Create & assign" without an agent reports a created, unassigned skill', async () => {
    api.get.mockResolvedValue({ data: { results: [], next: null } })
    api.post.mockResolvedValue({ data: { id: 8, name: 'Playbook' } })
    const w = mount(SkillsStep, { props: { agent: reactive({}) }, global: { stubs } })
    await flushPromises()
    await button(w, 'New skill').trigger('click')
    await w.find('input[placeholder^="Skill name"]').setValue('Playbook')
    await button(w, 'Create & assign').trigger('click')
    await flushPromises()
    expect(api.patch).not.toHaveBeenCalled()
    expect(notify.success).toHaveBeenCalledTimes(1)
    expect(notify.success.mock.calls[0][0]).toBe('Created Playbook. Save your agent first, then assign it here.')
  })
})

describe('SkillsStep', () => {
  it('loads every page of skills, not only the first', async () => {
    const pageOf = (from, n) => Array.from({ length: n }, (_, i) => ({ id: from + i, name: `s${from + i}` }))
    api.get.mockImplementation((url, opts) => Promise.resolve({
      data: opts.params.page === 1 ? { results: pageOf(1, 100), next: 'x' } : { results: pageOf(101, 5), next: null },
    }))
    const w = mount(SkillsStep, { props: { agent: reactive({ id: 1, skills: [] }) }, global: { stubs } })
    await flushPromises()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(api.get).toHaveBeenNthCalledWith(1, '/skills/', { params: { page: 1, page_size: 100 } })
    expect(api.get).toHaveBeenNthCalledWith(2, '/skills/', { params: { page: 2, page_size: 100 } })
    expect(w.text()).toContain('Page 1 of 18')            // 105 skills, 6 a page
  })

  it('tells the editor what it saved', async () => {
    api.get.mockResolvedValue({ data: { results: [{ id: 8, name: 'Playbook', slug: 'p', description: 'd' }], next: null } })
    const agent = reactive({ id: 1, skills: [], skill_ids: [] })
    const w = mount(SkillsStep, { props: { agent }, global: { stubs } })
    await flushPromises()
    await button(w, 'Assign').trigger('click')
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/agents/1/', { skill_ids: [8] })
    expect(w.emitted('saved')).toEqual([[{ skill_ids: [8], skills: [{ id: 8, name: 'Playbook', slug: 'p', description: 'd' }] }]])
  })
})

describe('KnowledgeToolsStep — attaching knowledge', () => {
  const kbStubs = { ...stubs, WebIntelligenceCard: true, ToolIcon: true, AddWebsiteSourceModal: true, WebSourcePagesModal: true, IntegrationHubModal: true }
  beforeEach(() => {
    api.listWebSources = vi.fn().mockResolvedValue({ data: [] })
    api.getLlmUsage = vi.fn().mockResolvedValue({ data: {} })
    api.getAgentKnowledgeAttachments = vi.fn().mockResolvedValue({ data: { attached: [] } })
    api.listKnowledgeSources = vi.fn().mockResolvedValue({ data: { sources: [] } })
    api.listKnowledge = vi.fn().mockResolvedValue({ data: { resources: [{ id: 5, name: 'Handbook', kind: 'file', chunk_count: 3 }] } })
    api.getConnectors = vi.fn().mockResolvedValue({ data: { connectors: [] } })
    // The step opens a live-indexing socket for a saved agent; nothing here needs it to connect.
    vi.stubGlobal('WebSocket', class { static OPEN = 1; close() {} })
  })

  it('warns on an unsaved agent instead of PATCHing /agents/undefined/', async () => {
    const w = mount(KnowledgeToolsStep, { props: { agent: reactive({}) }, global: { stubs: kbStubs } })
    await flushPromises()
    await button(w, 'Attach').trigger('click')
    await flushPromises()
    expect(api.patch).not.toHaveBeenCalled()
    expect(notify.info).toHaveBeenCalledWith('Save your agent first, then attach knowledge.')
  })

  it('tells the editor what it saved', async () => {
    const agent = reactive({ id: 1, knowledge_sources: [], knowledge_source_ids: [] })
    const w = mount(KnowledgeToolsStep, { props: { agent }, global: { stubs: kbStubs } })
    await flushPromises()
    await button(w, 'Attach').trigger('click')
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/agents/1/', { knowledge_source_ids: [5] })
    expect(w.emitted('saved')).toEqual([[{ knowledge_source_ids: [5] }]])
  })
})

describe('SubAgentsStep', () => {
  it('tells the editor what it saved', async () => {
    api.getAgents = vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'me' }, { id: 9, name: 'Helper', is_paused: false }] })
    const agent = reactive({ id: 1, sub_agents: [], sub_agent_ids: [] })
    const w = mount(SubAgentsStep, { props: { agent }, global: { stubs } })
    await flushPromises()
    await button(w, 'Add to team').trigger('click')
    await flushPromises()
    expect(api.patch).toHaveBeenCalledWith('/agents/1/', { sub_agent_ids: [9] })
    expect(w.emitted('saved')).toEqual([[{ sub_agent_ids: [9], sub_agents: [{ id: 9, name: 'Helper', is_paused: false }] }]])
  })
})

describe('ScopeAssistantStep', () => {
  it('does not send set_as_assistant once Enabled is unticked', async () => {
    const agent = reactive({ id: 1, is_builtin_agent: true, builtin_visibility: 'admin', builtin_key: 'helper', builtin_enabled: true })
    const w = mount(ScopeAssistantStep, { props: { agent }, global: { stubs } })
    const [enabled, assistant] = w.findAll('input[type="checkbox"]')
    await assistant.setValue(true)
    await enabled.setValue(false)
    await nextTick()
    expect(assistant.element.checked).toBe(false)         // reset, not merely disabled
    await button(w, 'Convert & apply').trigger('click')
    await flushPromises()
    expect(api.patch.mock.calls[0][1]).toMatchObject({ builtin_enabled: false, set_as_assistant: false })

    // Enabled again → the box is free but stays unticked until the user ticks it.
    await enabled.setValue(true)
    await assistant.setValue(true)
    await button(w, 'Convert & apply').trigger('click')
    await flushPromises()
    expect(api.patch.mock.calls[1][1]).toMatchObject({ builtin_enabled: true, set_as_assistant: true })
  })
})

describe('TestPublishMonitorStep', () => {
  async function mountFinal({ publishedAt = null, saveFirst, agent = { id: 1, publish_status: 'draft' } } = {}) {
    api.getAgentMonitoring.mockResolvedValue({ data: { publish: { published_at: publishedAt } } })
    api.publishAgent.mockResolvedValue({ data: { id: 1, publish_status: 'published' } })
    api.rollbackAgent.mockResolvedValue({ data: { id: 1 } })
    const w = mount(TestPublishMonitorStep, { props: { agent: reactive(agent), saveFirst }, global: { stubs } })
    await flushPromises()
    return w
  }

  it('saves pending edits before publishing, and does not publish when the save failed', async () => {
    const saveFirst = vi.fn().mockResolvedValue(false)
    const w = await mountFinal({ saveFirst })
    await button(w, 'Publish Configuration').trigger('click')
    await flushPromises()
    expect(saveFirst).toHaveBeenCalledTimes(1)
    expect(api.publishAgent).not.toHaveBeenCalled()

    saveFirst.mockResolvedValue(true)
    await button(w, 'Publish Configuration').trigger('click')
    await flushPromises()
    expect(api.publishAgent).toHaveBeenCalledWith(1)
    expect(w.emitted('published')).toHaveLength(1)
  })

  it('offers no rollback before the first publish', async () => {
    const w = await mountFinal({ publishedAt: null })
    const rb = button(w, 'Rollback')
    expect(rb.attributes('disabled')).toBeDefined()
    await rb.trigger('click')
    expect(confirm).not.toHaveBeenCalled()
    expect(api.rollbackAgent).not.toHaveBeenCalled()
  })

  it('asks before rolling back', async () => {
    const w = await mountFinal({ publishedAt: '2026-10-01T00:00:00Z', agent: { id: 1, publish_status: 'published' } })
    confirm.mockResolvedValueOnce(false)
    await button(w, 'Rollback').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0]).toMatchObject({ confirmText: 'Roll back', danger: true })
    expect(api.rollbackAgent).not.toHaveBeenCalled()

    confirm.mockResolvedValueOnce(true)
    await button(w, 'Rollback').trigger('click')
    await flushPromises()
    expect(api.rollbackAgent).toHaveBeenCalledWith(1)
  })
})

describe('WebIntelligenceCard', () => {
  it('a failed "Test this model" keeps the unsaved form and refreshes only the model list', async () => {
    const model = (available) => ({
      provider: 'openai', provider_label: 'OpenAI', model_id: 'gpt-5.1', display_name: 'gpt-5.1',
      search_mode: 'native', search_mode_label: 'Native', mechanism: 'm', available,
    })
    api.getAgentWebIntelligence.mockResolvedValue({ data: {
      editable: true, config: {},
      effective: { enabled: true, mode: 'auto', search_model: { provider: 'openai', model_id: 'gpt-5.1' } },
    } })
    api.getWebSearchModels.mockResolvedValueOnce({ data: { models: [model(true)] } })
      .mockResolvedValueOnce({ data: { models: [model(false)] } })
    api.probeWebSearchModel.mockResolvedValue({ data: { status: 'failed', detail: 'no key' } })

    const w = mount(WebIntelligenceCard, { props: { agent: reactive({ id: 1 }) }, global: { stubs } })
    await flushPromises()
    const mode = w.findAll('select')[0]
    await mode.setValue('engines_only')                   // an edit the user has not saved
    expect(w.text()).toContain('Unsaved changes')

    await button(w, 'Test this model').trigger('click')
    await flushPromises()

    expect(api.getAgentWebIntelligence).toHaveBeenCalledTimes(1)   // the form was NOT reloaded
    expect(api.getWebSearchModels).toHaveBeenCalledTimes(2)        // only the list was
    expect(mode.element.value).toBe('engines_only')
    expect(w.text()).toContain('Unsaved changes')
    expect(w.text()).toContain('Failed — no key')
    expect(w.text()).toContain('(no credentials)')                 // the model's new availability shows
  })

  it('sends a model id that itself contains "::" whole', async () => {
    api.getAgentWebIntelligence.mockResolvedValue({ data: {
      editable: true, config: {},
      effective: { enabled: true, mode: 'auto', search_model: { provider: 'openrouter', model_id: 'vendor::model::v2' } },
    } })
    api.getWebSearchModels.mockResolvedValue({ data: { models: [{
      provider: 'openrouter', provider_label: 'OpenRouter', model_id: 'vendor::model::v2', display_name: 'x',
      search_mode: 'native', search_mode_label: 'Native', mechanism: 'm', available: true,
    }] } })
    api.updateAgentWebIntelligence.mockResolvedValue({ data: { config: {} } })
    const w = mount(WebIntelligenceCard, { props: { agent: reactive({ id: 1 }) }, global: { stubs } })
    await flushPromises()
    await w.findAll('select')[0].setValue('engines_only')
    await button(w, 'Save web settings').trigger('click')
    await flushPromises()
    expect(api.updateAgentWebIntelligence.mock.calls[0][1].search_model)
      .toEqual({ provider: 'openrouter', model_id: 'vendor::model::v2' })
  })
})

// The editor is mounted in the user dashboard AND in the admin dashboard. Its steps ask the editor which
// (composables/editorShell.js) instead of sending every link to /dashboard.
describe('editor steps in the admin shell', () => {
  // A stand-in for AgentEditor: provides the shell exactly as it does, then renders the step.
  function inAdminShell(Step, props) {
    const Host = {
      components: { Step },
      setup() {
        provideEditorShell({ isAdmin: computed(() => true), href: (to) => `/resolved${typeof to === 'string' ? to : to.path}` })
        return { props }
      },
      template: '<Step v-bind="props" />',
    }
    return mount(Host, { global: { stubs } })
  }

  it("keeps an agent's own pages inside the admin shell", async () => {
    const w = inAdminShell(AutonomySafetyStep, { agent: reactive({ id: 4, tool_ids: [] }) })
    await flushPromises()
    await button(w, 'Manage guardrails').trigger('click')
    expect(router.push).toHaveBeenLastCalledWith('/admin-dashboard/agents/4/guardrails')
    await button(w, 'Test these settings').trigger('click')
    expect(router.push).toHaveBeenLastCalledWith('/admin-dashboard/agents/4/monitor')
  })

  it('opens a user-dashboard page in a new tab instead of leaving the editor', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const w = inAdminShell(AutonomySafetyStep, { agent: reactive({ id: 4, tool_ids: [] }) })
    await flushPromises()
    await button(w, 'Budgets').trigger('click')
    expect(open).toHaveBeenCalledWith('/resolved/dashboard/budgets', '_blank', 'noopener')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('sends the built-in library link to the admin console', async () => {
    api.listAgentTemplates.mockResolvedValue({ data: [] })
    const w = inAdminShell(AgentIdentityStep, { agent: reactive({ name: '' }), isNew: true })
    await flushPromises()
    await button(w, 'View all built-in agents to clone').trigger('click')
    expect(router.push).toHaveBeenLastCalledWith({ name: 'admin-builtin-agents' })
  })

  it('a step with no editor above it still links into the user dashboard', async () => {
    const w = mount(AutonomySafetyStep, { props: { agent: reactive({ id: 4, tool_ids: [] }) }, global: { stubs } })
    await flushPromises()
    await button(w, 'Manage guardrails').trigger('click')
    expect(router.push).toHaveBeenLastCalledWith('/dashboard/agents/4/guardrails')
    await button(w, 'Budgets').trigger('click')
    expect(router.push).toHaveBeenLastCalledWith('/dashboard/budgets')
  })
})
