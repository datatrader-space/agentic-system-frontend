// @vitest-environment jsdom
// The Let's Code chat is the SAME chat as the main agent chat (owner, 2026-11-06): the shared store streams it and
// ChatMessageList draws it. This panel only points the store at the project (its socket and the shared Coding
// Agent), sends through it, and adds a project turn's own lines under the answer: the files it changed (which open
// Source control) and the running app. There is no diff card: the person commits and pushes in Source control.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const chat = reactive({
  messages: [], hitlRequests: [], isBusy: false, connectionLost: false, conversationId: null,
  repoId: 0, newChatRepoId: null, selectedAgentId: '7', surfaceHandler: null, todos: [],
  reset: vi.fn(function () { chat.messages = [] }), setAgent: vi.fn((id) => { chat.selectedAgentId = id }),
  sendMessage: vi.fn(() => Promise.resolve(true)), sendRaw: vi.fn(), stop: vi.fn(), openConversation: vi.fn(),
  respondHitl: vi.fn(), dismissHitl: vi.fn(), skipHitl: vi.fn(),
  pendingAttachments: [], refreshRestorePoints: vi.fn(),
  addAttachments: vi.fn(function (files) { chat.pendingAttachments.push(...Array.from(files).map((f) => ({ name: f.name, file: f }))) }),
  removeAttachment: vi.fn(function (i) { chat.pendingAttachments.splice(i, 1) }),
})
vi.mock('@/stores/useChatStore', () => ({ useChatStore: () => chat }))
vi.mock('@/services/api', () => ({
  default: {
    unifiedConfig: vi.fn(() => Promise.resolve({ data: { agent_id: 3527 } })),
    getProjectPreview: vi.fn(() => Promise.resolve({ data: { url: 'https://3000-abcdefgh12345678.proxy.x' } })),
    getConversations: vi.fn(() => Promise.resolve({ data: [] })),
    restoreLetsCodeMessage: vi.fn(() => Promise.resolve({ data: { restored: true } })),
    getRepositoryFiles: vi.fn(() => Promise.resolve({ data: { entries: [
      { name: 'views.py', path: 'app/views.py', type: 'file' }, { name: 'app', path: 'app', type: 'directory' }] } })),
  },
}))
const confirmMock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock('@/composables/useConfirm', () => ({ confirm: confirmMock }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/composables/useVoiceInput', () => ({
  useVoiceInput: () => new Proxy({}, { get: (_t, k) => (k === 'toggle' ? () => {} : { value: false }) }),
}))

// The shared list, reduced to what this panel relies on: one row per message and the `after-message` slot.
const ChatMessageList = {
  setup: () => ({ chat }),
  template: `<div><div v-for="m in chat.messages" :key="m.id" class="row">{{ m.content }}<slot name="after-message" :message="m" /></div></div>`,
}
const stubs = { Icon: true, HITLModal: true, PermissionCard: true, AgentModelPicker: true, ChatMessageList }

async function mountChat() {
  const Chat = (await import('./UnifiedAgentChat.vue')).default
  const w = mount(Chat, { props: { systemId: 5, repoId: 14, crsReady: true }, global: { stubs } })
  await flushPromises()
  return w
}

beforeEach(() => {
  chat.messages = []; chat.repoId = 0; chat.selectedAgentId = '7'; chat.surfaceHandler = null; chat.pendingAttachments = []
  vi.clearAllMocks()
})

describe('UnifiedAgentChat on the shared chat', () => {
  it('points the shared chat at the project and the shared Coding Agent, and gives it back on close', async () => {
    const w = await mountChat()
    expect(chat.repoId).toBe(14)
    expect(chat.newChatRepoId).toBe(14)
    expect(chat.setAgent).toHaveBeenCalledWith('3527')
    expect(typeof chat.surfaceHandler).toBe('function')
    w.unmount()
    expect(chat.surfaceHandler).toBe(null)
    expect(chat.repoId).toBe(0)
    expect(chat.newChatRepoId).toBe(null)
    expect(chat.selectedAgentId).toBe('7')
  })

  it('sends through the shared chat, with no mode of its own', async () => {
    const w = await mountChat()
    await w.find('textarea').setValue('fix the header')
    await w.find('button.send').trigger('click')
    await flushPromises()
    expect(chat.sendMessage).toHaveBeenCalledWith('fix the header')
    expect(w.text()).not.toContain('Ask')
    w.unmount()
  })

  it('puts the changed files and the running app under the answer they belong to, and leaves other frames to the chat', async () => {
    const w = await mountChat()
    chat.messages = [{ id: 'u1', role: 'user', content: 'run it' }, { id: 'a1', role: 'assistant', content: 'done' }]
    await flushPromises()
    const files = [{ path: 'app/page.tsx', status: 'modified' }, { path: 'app/new.tsx', status: 'added' }]
    expect(chat.surfaceHandler({ type: 'lets_code_changes', files, total: 2 })).toBe(true)
    expect(chat.surfaceHandler({ type: 'lets_code_preview', port: 3000 })).toBe(true)
    expect(chat.surfaceHandler({ type: 'assistant_message_chunk', chunk: 'x' })).toBe(false)
    expect(chat.surfaceHandler({ type: 'proposed_diff', proposed_diff_id: 9 })).toBe(false)
    await flushPromises()
    expect(w.find('.ai-changes-text').text()).toBe('Changed 2 files: page.tsx, new.tsx')
    expect(w.text()).toContain('The app is running on port 3000')
    expect(w.emitted('changes')).toHaveLength(1)
    w.unmount()
  })

  it('says when earlier changes are still waiting to be committed, and opens Source control on View changes', async () => {
    const w = await mountChat()
    chat.messages = [{ id: 'a1', role: 'assistant', content: 'done' }]
    chat.surfaceHandler({ type: 'lets_code_changes', files: [{ path: 'README.md', status: 'modified' }], total: 4 })
    await flushPromises()
    expect(w.find('.ai-changes-text').text()).toBe('Changed 1 file: README.md · 3 more changes not committed')
    await w.find('.ai-changes-open').trigger('click')
    expect(w.emitted('view-changes')).toHaveLength(1)
    w.unmount()
  })

  it('says a turn changed no files when it wrote nothing', async () => {
    const w = await mountChat()
    chat.messages = [{ id: 'a1', role: 'assistant', content: 'done' }]
    chat.surfaceHandler({ type: 'lets_code_changes', files: [], total: 0 })
    await flushPromises()
    expect(w.find('.ai-changes-text').text()).toBe('No files changed in this turn')
    w.unmount()
  })

  it('Open preview asks the page for its Preview tab on that port, never a sandbox link (ADM-1205 phase D)', async () => {
    const api = (await import('@/services/api')).default
    const w = await mountChat()
    chat.messages = [{ id: 'a1', role: 'assistant', content: 'done' }]
    chat.surfaceHandler({ type: 'lets_code_preview', port: 3000 })
    await flushPromises()
    const open = vi.spyOn(window, 'open')
    await w.find('.ai-preview-open').trigger('click')
    await flushPromises()
    expect(w.emitted('open-preview')).toEqual([[3000]])
    expect(open).not.toHaveBeenCalled()
    expect(api.getProjectPreview).not.toHaveBeenCalled()      // the Preview tab asks, each time it opens
    open.mockRestore()
    w.unmount()
  })

  // ADM-1185 / ADM-1200: only the end-of-turn card for a protected file's values runs the request again on Allow;
  // an action the agent is about to take pauses on the shared approval card and the same run goes on, never re-sent.
  it('runs the request again on Allow only for a protected file card, never for an action card', async () => {
    const w = await mountChat()
    await w.find('textarea').setValue('read the config')
    await w.find('button.send').trigger('click')
    await flushPromises()
    chat.sendMessage.mockClear()
    const card = w.findComponent({ name: 'PermissionCard' })
    card.vm.$emit('respond', { card: { capability: 'run_command', command: 'curl x' }, choice: 'allow_once' })
    await flushPromises()
    expect(chat.sendRaw).toHaveBeenCalledWith(expect.objectContaining({ type: 'permission_response' }))
    expect(chat.sendMessage).not.toHaveBeenCalled()
    card.vm.$emit('respond', { card: { capability: 'access_secret', path: '.env' }, choice: 'deny' })
    await flushPromises()
    expect(chat.sendMessage).not.toHaveBeenCalled()
    card.vm.$emit('respond', { card: { capability: 'access_secret', path: '.env' }, choice: 'allow_project' })
    await flushPromises()
    expect(chat.sendMessage).toHaveBeenCalledWith('read the config')
    w.unmount()
  })
})

describe('UnifiedAgentChat: reopening a project continues its last chat (ADM-1209)', () => {
  // Each open used to start a blank chat, so every page load made a new conversation (2026-11-11).
  const open = async () => (await import('@/services/api')).default

  beforeEach(() => { chat.conversationId = null; chat.isBusy = false })

  it('opens the newest of this project\'s chats', async () => {
    const api = await open()
    api.getConversations.mockResolvedValueOnce({ data: [{ id: 88 }, { id: 70 }] })
    const w = await mountChat()
    expect(api.getConversations).toHaveBeenCalledWith({ repository: 14 })
    expect(chat.openConversation).toHaveBeenCalledWith(88)
    expect(chat.repoId).toBe(14)                     // the chat stays on this project's socket
    w.unmount()
  })

  it('a project with no chat yet starts blank', async () => {
    const api = await open()
    api.getConversations.mockResolvedValueOnce({ data: { results: [] } })
    const w = await mountChat()
    expect(chat.openConversation).not.toHaveBeenCalled()
    w.unmount()
  })

  it('never replaces a chat already begun, or a New chat pressed while the last one loads', async () => {
    const api = await open()
    let resolve
    api.getConversations.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const w = await mountChat()
    await w.find('button[aria-label="New chat"]').trigger('click')
    resolve({ data: [{ id: 88 }] })
    await flushPromises()
    expect(chat.openConversation).not.toHaveBeenCalled()
    w.unmount()

    api.getConversations.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    const w2 = await mountChat()
    chat.messages = [{ id: 1, role: 'user', content: 'hi' }]        // the person already sent something
    resolve({ data: [{ id: 88 }] })
    await flushPromises()
    expect(chat.openConversation).not.toHaveBeenCalled()
    w2.unmount()
  })

  it('a failed history read leaves the blank chat', async () => {
    const api = await open()
    api.getConversations.mockRejectedValueOnce(new Error('offline'))
    const w = await mountChat()
    expect(chat.openConversation).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('UnifiedAgentChat: restore to before a message (AGENT_ENGINE_CAPABILITIES_PLAN.md section 9)', () => {
  const apiOf = async () => (await import('@/services/api')).default
  const notifyOf = async () => (await import('@/composables/useNotify')).notify
  const thread = () => [
    { id: 'u1', serverId: 501, role: 'user', content: 'add a route', restoreCheckpointId: 'cp-1' },
    { id: 'a1', serverId: 502, role: 'assistant', content: 'Added.' },
    { id: 'u2', serverId: 503, role: 'user', content: 'thanks' },
  ]

  beforeEach(() => { chat.conversationId = null; chat.isBusy = false; chat.todos = [] })

  it('offers it only on a user message that has a restore point', async () => {
    const w = await mountChat()
    chat.messages = thread()
    await flushPromises()
    const buttons = w.findAll('[data-test="restore-message"]')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].text()).toBe('Restore to before this message')
    w.unmount()
  })

  it('asks first, and does nothing when the person cancels', async () => {
    const api = await apiOf()
    confirmMock.mockResolvedValueOnce(false)
    const w = await mountChat()
    chat.messages = thread()
    await flushPromises()
    await w.get('[data-test="restore-message"]').trigger('click')
    await flushPromises()
    expect(confirmMock).toHaveBeenCalledOnce()
    expect(confirmMock.mock.calls[0][0].message).toBe(
      "Restore the project's files to how they were before this message? Changes made after it are discarded. Files that git ignores are not touched.")
    expect(api.restoreLetsCodeMessage).not.toHaveBeenCalled()
    expect(w.emitted('changes')).toBeUndefined()
    w.unmount()
  })

  it('on confirm restores through the server, says Restored and refreshes the files and Source control', async () => {
    const api = await apiOf()
    const notify = await notifyOf()
    confirmMock.mockResolvedValueOnce(true)
    const w = await mountChat()
    chat.messages = thread()
    await flushPromises()
    await w.get('[data-test="restore-message"]').trigger('click')
    await flushPromises()
    expect(api.restoreLetsCodeMessage).toHaveBeenCalledExactlyOnceWith(14, 501)
    expect(notify.success).toHaveBeenCalledWith('Restored')
    expect(w.emitted('changes')).toHaveLength(1)        // LetsCode.vue's onChanges: codeBrowser.refresh()
    w.unmount()
  })

  it("shows the server's error text when the restore fails", async () => {
    const api = await apiOf()
    const notify = await notifyOf()
    confirmMock.mockResolvedValueOnce(true)
    api.restoreLetsCodeMessage.mockRejectedValueOnce({ response: { data: { error: 'That checkpoint is gone.' } } })
    const w = await mountChat()
    chat.messages = thread()
    await flushPromises()
    await w.get('[data-test="restore-message"]').trigger('click')
    await flushPromises()
    expect(notify.error).toHaveBeenCalledWith('That checkpoint is gone.')
    expect(notify.success).not.toHaveBeenCalled()
    expect(w.emitted('changes')).toBeUndefined()
    w.unmount()
  })

  it('waits while the agent is working', async () => {
    const w = await mountChat()
    chat.messages = thread()
    chat.isBusy = true
    await flushPromises()
    expect(w.get('[data-test="restore-message"]').attributes('disabled')).toBeDefined()
    w.unmount()
  })
})

describe('UnifiedAgentChat: the task list (AGENT_ENGINE_CAPABILITIES_PLAN.md section 7)', () => {
  beforeEach(() => { chat.conversationId = null; chat.isBusy = false; chat.todos = [] })

  it("shows the shared chat's task list above the composer, and follows it live", async () => {
    const w = await mountChat()
    expect(w.find('[data-test="task-list"]').exists()).toBe(false)
    chat.todos = [
      { content: 'Read the router', status: 'completed', activeForm: '' },
      { content: 'Add the route', status: 'in_progress', activeForm: 'Adding the route' },
    ]
    await flushPromises()
    expect(w.get('[data-test="task-count"]').text()).toBe('1 of 2 done')
    expect(w.get('.ctl-now').text()).toBe('Adding the route')
    chat.todos = [{ content: 'Read the router', status: 'completed', activeForm: '' }, { content: 'Add the route', status: 'completed', activeForm: '' }]
    await flushPromises()
    expect(w.get('[data-test="task-count"]').text()).toBe('2 of 2 done')
    w.unmount()
  })
})

describe('UnifiedAgentChat: files and images go with a message (ADM-1205 phase E)', () => {
  beforeEach(() => { chat.conversationId = null; chat.isBusy = false; chat.todos = [] })

  it('the paperclip, a drop and the chips use the main chat store; files alone can be sent', async () => {
    const w = await mountChat()
    const input = w.get('input[type="file"]')
    const f = new File(['img'], 'screen.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [f], configurable: true })
    await input.trigger('change')
    expect(chat.addAttachments).toHaveBeenCalledWith([f])
    expect(w.findAll('.attach-chip').map((c) => c.text())).toEqual([expect.stringContaining('screen.png')])
    const send = w.get('[aria-label="Send"]')
    expect(send.attributes('disabled')).toBeUndefined()
    await send.trigger('click')
    await flushPromises()
    expect(chat.sendMessage).toHaveBeenCalledWith('')

    const doc = new File(['d'], 'spec.pdf', { type: 'application/pdf' })
    await w.get('.uac-box').trigger('drop', { dataTransfer: { types: ['Files'], files: [doc] } })
    expect(chat.addAttachments).toHaveBeenLastCalledWith([doc])
    await w.get('[aria-label="Remove spec.pdf"]').trigger('click')
    expect(chat.removeAttachment).toHaveBeenCalled()
    w.unmount()
  })

  it('nothing is attached while the agent is working', async () => {
    chat.isBusy = true
    const w = await mountChat()
    expect(w.get('[data-test="uac-attach"]').attributes('disabled')).toBeDefined()
    await w.get('.uac-box').trigger('drop', { dataTransfer: { types: ['Files'], files: [new File(['x'], 'a.txt')] } })
    expect(chat.addAttachments).not.toHaveBeenCalled()
    w.unmount()
  })
})

describe('UnifiedAgentChat: @ mentions and the selection reach the agent as code context (ADM-1205 phase E)', () => {
  beforeEach(() => { chat.conversationId = null; chat.isBusy = false; chat.todos = []; localStorage.clear() })

  const typeInBox = async (w, text) => {
    const box = w.get('#uac-input')
    box.element.value = text
    box.element.selectionStart = box.element.selectionEnd = text.length
    await box.trigger('input')
  }

  it('@ searches the project like Go to file; Enter picks (never sends); the file goes with the message', async () => {
    const api = (await import('@/services/api')).default
    const w = await mountChat()
    await typeInBox(w, 'explain @views')
    expect(w.find('[data-test="uac-mention"]').exists()).toBe(true)
    await new Promise((r) => setTimeout(r, 160))
    await flushPromises()
    expect(api.getRepositoryFiles).toHaveBeenCalledWith(5, 14, { search: 'views' })
    expect(w.findAll('.fr-item').map((li) => li.text())).toEqual([expect.stringContaining('views.py')])
    await w.get('#uac-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(chat.sendMessage).not.toHaveBeenCalled()
    expect(w.get('#uac-input').element.value).toBe('explain @app/views.py ')
    expect(w.find('[data-test="uac-mention"]').exists()).toBe(false)
    await w.get('#uac-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(chat.sendMessage).toHaveBeenCalledWith('explain @app/views.py', { codeContext: { files: ['app/views.py'], selection: undefined } })
    w.unmount()
  })

  it('a mention deleted from the text is not sent; Escape closes the list', async () => {
    const w = await mountChat()
    await typeInBox(w, '@vie')
    await w.get('#uac-input').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-test="uac-mention"]').exists()).toBe(false)
    await typeInBox(w, 'just text')
    await w.get('#uac-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(chat.sendMessage).toHaveBeenCalledWith('just text')
    w.unmount()
  })

  it('the editor selection shows as a chip and is sent with the next message, then cleared', async () => {
    const w = await mountChat()
    w.vm.addSelection({ path: 'app/views.py', start_line: 10, end_line: 24, text: 'def index(request):' })
    await flushPromises()
    expect(w.get('[data-test="uac-selection"]').text()).toContain('views.py:10-24')
    await typeInBox(w, 'why is this slow?')
    await w.get('#uac-input').trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(chat.sendMessage).toHaveBeenCalledWith('why is this slow?', { codeContext: { files: [], selection: {
      path: 'app/views.py', start_line: 10, end_line: 24, text: 'def index(request):' } } })
    expect(w.find('[data-test="uac-selection"]').exists()).toBe(false)
    w.unmount()
  })
})
