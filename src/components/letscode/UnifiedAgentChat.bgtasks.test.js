// @vitest-environment jsdom
// The Let's Code chat's background-tasks pill (ADM-1360 release, CODING_AGENT_BACKGROUND_WORK_PLAN.md section 3), like
// Claude Code's footer: "2 background tasks · 1 running" above the composer, hidden at zero; it opens the list (a
// popover, a bottom sheet on a phone). The socket's `background_task` frames upsert by the task's UUID; the list is read
// from the (mocked) API when a chat opens and when the socket comes back.
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const chat = reactive({
  messages: [], hitlRequests: [], isBusy: false, connectionLost: false, conversationId: null,
  repoId: 0, newChatRepoId: null, selectedAgentId: '7', surfaceHandler: null, todos: [],
  parkedRuns: {}, parkedFrameHandler: null, keepRunsOnLeave: false,
  reset: vi.fn(function () { chat.messages = [] }), setAgent: vi.fn((id) => { chat.selectedAgentId = id }),
  sendMessage: vi.fn(() => Promise.resolve(true)), sendRaw: vi.fn(), stop: vi.fn(), openConversation: vi.fn(),
  respondHitl: vi.fn(), dismissHitl: vi.fn(), skipHitl: vi.fn(),
  pendingAttachments: [], refreshRestorePoints: vi.fn(),
  turnMode: 'chat',
  setTurnMode: vi.fn(function (m) { chat.turnMode = m }),
  addAttachments: vi.fn(function (files) { chat.pendingAttachments.push(...Array.from(files).map((f) => ({ name: f.name, file: f }))) }),
  removeAttachment: vi.fn(function (i) { chat.pendingAttachments.splice(i, 1) }),
})
vi.mock('@/stores/useChatStore', () => ({ useChatStore: () => chat }))
vi.mock('@/services/api', () => ({
  default: {
    unifiedConfig: vi.fn(() => Promise.resolve({ data: { agent_id: 3527 } })),
    getProjectPreview: vi.fn(() => Promise.resolve({ data: { url: 'https://3000-abcdefgh12345678.proxy.x' } })),
    getConversations: vi.fn(() => Promise.resolve({ data: [] })),
    getChatWorktrees: vi.fn(() => Promise.resolve({ data: { worktrees: [], count: 0, into: 'main' } })),
    restoreLetsCodeMessage: vi.fn(() => Promise.resolve({ data: { restored: true } })),
    getRepositoryFiles: vi.fn(() => Promise.resolve({ data: { entries: [
      { name: 'views.py', path: 'app/views.py', type: 'file' }, { name: 'app', path: 'app', type: 'directory' }] } })),
  },
}))
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmMock, confirmState: { open: false } }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }))
vi.mock('@/composables/useVoiceInput', () => ({
  useVoiceInput: () => new Proxy({}, { get: (_t, k) => (k === 'toggle' ? () => {} : { value: false }) }),
}))

// The shared list, reduced to what this panel relies on: one row per message and the `after-message` slot.
const ChatMessageList = {
  setup: () => ({ chat }),
  template: `<div><div v-for="m in chat.messages" :key="m.id" class="row">{{ m.content }}<slot name="after-message" :message="m" /></div></div>`,
}
const stubs = { Icon: true, HITLModal: true, PermissionCard: true, AgentModelPicker: true, ChatMessageList }

// The page's chat-tab controller (the editor draws its tabs); each mount gets a fresh one, as each page does.
let ctl = null
let bg = null
let bgApi = null
async function mountChat(tasks = []) {
  const Chat = (await import('./UnifiedAgentChat.vue')).default
  const { CODING_CHAT_TABS, createCodingChatTabs } = await import('@/stores/useCodingChatTabs')
  const { BACKGROUND_TASKS, createBackgroundTasks } = await import('@/stores/useBackgroundTasks')
  ctl = createCodingChatTabs()
  bgApi = { list: vi.fn(() => Promise.resolve({ data: { tasks } })), stop: vi.fn() }
  bg = createBackgroundTasks({ api: bgApi })
  const w = mount(Chat, { props: { systemId: 5, repoId: 14, crsReady: true }, attachTo: document.body,
                          global: { stubs, provide: { [CODING_CHAT_TABS]: ctl, [BACKGROUND_TASKS]: bg } } })
  await flushPromises()
  return w
}


beforeAll(async () => { await import('./UnifiedAgentChat.vue') }, 120000)

beforeEach(() => {
  chat.messages = []; chat.repoId = 0; chat.selectedAgentId = '7'; chat.surfaceHandler = null; chat.pendingAttachments = []
  chat.conversationId = null; chat.parkedFrameHandler = null; chat.connectionLost = false
  vi.clearAllMocks()
})

const U = (n) => `3f2a8c10-0000-4000-8000-00000000000${n}`
const running = { id: U(1), kind: 'command', name: 'npm test', state: 'running', status: '', started_at: '2026-11-24T10:00:00Z',
  tail_line: 'PASS a', open: { type: 'output', handle: 'h1' } }
const ended = { id: U(2), kind: 'subagent', name: 'Explore', state: 'finished', status: 'succeeded', started_at: '2026-11-24T09:00:00Z',
  open: { type: 'conversation', conversation_id: '901' } }
const settle = async () => { for (let i = 0; i < 4; i++) { await flushPromises(); await new Promise((r) => setTimeout(r, 0)) } }

describe('the background-tasks pill above the composer (ADM-1360 release)', () => {
  it("is hidden with no tasks, and reads the chat on screen's list when a chat opens", async () => {
    const w = await mountChat([running, ended])
    expect(w.find('[data-test="uac-bg-pill"]').exists()).toBe(false)
    chat.conversationId = 77
    await settle()
    expect(bgApi.list).toHaveBeenCalledWith('77')
    const pill = w.find('[data-test="uac-bg-pill"]')
    expect(pill.text()).toBe('2 background tasks · 1 running')
    expect(pill.attributes('aria-expanded')).toBe('false')
    w.unmount()
  })

  it('socket frames upsert by the task UUID and are not drawn in the chat', async () => {
    const w = await mountChat([])
    chat.conversationId = 77
    await settle()
    expect(w.find('[data-test="uac-bg-pill"]').exists()).toBe(false)
    expect(chat.surfaceHandler({ type: 'background_task', conversation_id: 77, event: 'started', task: running })).toBe(true)
    await settle()
    expect(w.find('[data-test="uac-bg-pill"]').text()).toBe('1 background task · 1 running')
    expect(w.find('[data-test="uac-bg-live"]').text()).toBe('npm test started.')
    chat.surfaceHandler({ type: 'background_task', conversation_id: 77, event: 'ended',
      task: { ...running, state: 'finished', status: 'failed', exit_code: 1 } })
    await settle()
    expect(w.find('[data-test="uac-bg-pill"]').text()).toBe('1 background task')
    expect(w.find('[data-test="uac-bg-live"]').text()).toBe('npm test failed.')
    expect(w.find('[data-test="uac-bg-live"]').attributes('aria-live')).toBe('polite')
    // A chat left running in its tab: its frame goes to its own list, not the one on screen.
    chat.parkedFrameHandler('12', { type: 'background_task', conversation_id: 12, task: { ...running, id: U(5) } })
    expect(bg.listFor('12')).toHaveLength(1)
    expect(bg.listFor('77')).toHaveLength(1)
    w.unmount()
  })

  it('pressing the pill opens the list; Esc closes it and the focus goes back to the pill', { timeout: 60000 }, async () => {
    const w = await mountChat([running, ended])
    chat.conversationId = 77
    await settle()
    const pill = w.find('[data-test="uac-bg-pill"]')
    await pill.trigger('click')
    await settle()
    expect(pill.attributes('aria-expanded')).toBe('true')
    await vi.waitFor(() => expect(w.find('[data-test="bgs"]').exists()).toBe(true), { timeout: 20000 })
    await settle()
    const sheet = w.find('[data-test="bgs"]')
    expect(sheet.exists()).toBe(true)
    expect(sheet.find('#bgs-title').text()).toBe('Background tasks')
    expect(sheet.findAll('li')).toHaveLength(1)                         // Running; Finished 1 is closed
    expect(sheet.find('[data-test="bgt-finished-toggle"]').text()).toBe('Finished 1')
    expect(document.activeElement).toBe(w.find('[data-test="bgs-close"]').element)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await settle()
    expect(w.find('[data-test="bgs"]').exists()).toBe(false)
    expect(document.activeElement).toBe(w.find('[data-test="uac-bg-pill"]').element)
    w.unmount()
  })

  it('Open on a row closes the list and opens the drawer; another chat clears the list and reads its own', { timeout: 60000 }, async () => {
    const w = await mountChat([running])
    chat.conversationId = 77
    await settle()
    await w.find('[data-test="uac-bg-pill"]').trigger('click')
    await vi.waitFor(() => expect(w.find('[data-test="bgc-open"]').exists()).toBe(true), { timeout: 20000 })
    await w.find('[data-test="bgc-open"]').trigger('click')
    await settle()
    expect(bg.sheetOpen).toBe(false)
    expect(bg.opened.id).toBe(U(1))
    await vi.waitFor(() => expect(document.body.querySelector('[data-test="bgd"]')).not.toBe(null), { timeout: 20000 })
    chat.conversationId = 78
    await settle()
    expect(bg.opened).toBe(null)
    expect(bgApi.list).toHaveBeenLastCalledWith('78')
    w.unmount()
  })

  it("a task that starts gets a live card under the turn's answer, updated by its frames, opening it on press", { timeout: 60000 }, async () => {
    const w = await mountChat([])
    chat.conversationId = 77
    chat.messages = [{ id: 'm1', role: 'user', content: 'run both waves' }, { id: 'm2', role: 'assistant', content: 'Starting both.' }]
    await settle()
    const wf = { id: U(7), kind: 'workflow', name: 'wave5-cache-eval-and-frontier', state: 'running', status: '', agents: 8,
      started_at: new Date(Date.now() - 82000).toISOString(), open: { type: 'workflow_run', workflow_run_id: 41 },
      progress: { phases: [{ title: 'Build', done: 1, total: 3, items: [{ label: 'a', state: 'done' }, { label: 'b', state: 'running' }, { label: 'c', state: 'pending' }] }] } }
    chat.surfaceHandler({ type: 'background_task', conversation_id: 77, event: 'started', task: wf })
    await vi.waitFor(() => expect(w.find('[data-test="uac-bg-started"] [data-test="bgc-open"]').exists()).toBe(true), { timeout: 20000 })
    const started = w.find('[data-test="uac-bg-started"]')
    expect(w.findAll('.row')[1].find('[data-test="uac-bg-started"]').exists()).toBe(true)   // under the answer
    expect(started.find('[data-test="bgc-open"]').text()).toBe('wave5-cache-eval-and-frontier')
    expect(started.find('[data-test="bgc-meta"]').text()).toMatch(/^Workflow 8 agents 1m 2\ds$/)
    expect(started.find('[data-test="bgc-squares"]').attributes('aria-label')).toBe('Progress: 1 of 3 done, 1 running')
    expect(started.find('a[data-test="bgc-open"]').attributes('href')).toBe('/dashboard/workflow-runs?run=41')
    chat.surfaceHandler({ type: 'background_task', conversation_id: 77, event: 'progress',
      task: { ...wf, progress: { phases: [{ ...wf.progress.phases[0], done: 2, items: [{ label: 'a', state: 'done' }, { label: 'b', state: 'done' }, { label: 'c', state: 'running' }] }] } } })
    await settle()
    expect(w.find('[data-test="uac-bg-started"] [data-test="bgc-squares"]').attributes('aria-label')).toBe('Progress: 2 of 3 done, 1 running')
    // A second frame of the same task never adds a second card.
    chat.surfaceHandler({ type: 'background_task', conversation_id: 77, event: 'started', task: wf })
    await settle()
    expect(w.findAll('[data-test="uac-bg-started"] [data-test="bgc-open"]')).toHaveLength(1)
    w.unmount()
  })

  it("after a reload the start card is under the answer whose runId is the task's started_in; null has none", { timeout: 60000 }, async () => {
    const RUN = 'run_9f3c2a'
    const wf = { id: U(8), kind: 'workflow', name: 'wave6-adversarial-audit', state: 'running', status: '', agents: 7, started_in: RUN,
      started_at: '2026-11-24T10:00:00Z', open: { type: 'workflow_run', workflow_run_id: 42 } }
    const noStart = { ...running, id: U(9), name: 'no start card', started_in: null }
    const w = await mountChat([wf, noStart])
    chat.messages = [{ id: 'm1', role: 'user', content: 'go' }, { id: 'm2', role: 'assistant', content: 'Started.', runId: RUN },
      { id: 'm3', role: 'assistant', content: 'Later.', runId: 'run_other' }]
    chat.conversationId = 77
    await vi.waitFor(() => expect(w.find('[data-test="uac-bg-started"] [data-test="bgc-open"]').exists()).toBe(true), { timeout: 20000 })
    const rows = w.findAll('.row')
    expect(rows[1].findAll('[data-test="bgc-open"]').map((x) => x.text())).toEqual(['wave6-adversarial-audit'])
    expect(rows[2].find('[data-test="uac-bg-started"]').exists()).toBe(false)
    expect(w.text()).not.toContain('no start card')
    w.unmount()
  })

  it('live, then the history is read again: one card, moved under the answer of its run', { timeout: 60000 }, async () => {
    const RUN = 'run_live1'
    const w = await mountChat([])
    chat.conversationId = 77
    chat.messages = [{ id: 'm1', role: 'user', content: 'go' }, { id: 'm2', role: 'assistant', content: 'Starting…' }]
    await settle()
    const t1 = { ...running, id: U(6), name: 'npm run e2e', started_in: RUN }
    chat.surfaceHandler({ type: 'background_task', conversation_id: 77, event: 'started', task: t1 })
    await vi.waitFor(() => expect(w.find('[data-test="uac-bg-started"]').exists()).toBe(true), { timeout: 20000 })
    // The answer is saved, the history is read again (ids kept), and a newer answer follows.
    chat.messages = [{ id: 'm1', role: 'user', content: 'go' }, { id: 'm2', role: 'assistant', content: 'Started.', runId: RUN },
      { id: 'm4', role: 'assistant', content: 'Next.', runId: 'run_next' }]
    await settle()
    expect(w.findAll('[data-test="uac-bg-started"] [data-test="bgc-open"]')).toHaveLength(1)
    expect(w.findAll('.row')[1].find('[data-test="uac-bg-started"]').exists()).toBe(true)
    w.unmount()
  })

  it('reads the list again when the socket comes back', async () => {
    const w = await mountChat([running])
    chat.conversationId = 77
    await settle()
    chat.connectionLost = true
    await settle()
    chat.connectionLost = false
    await settle()
    expect(bgApi.list).toHaveBeenCalledTimes(2)
    w.unmount()
  })
})
