// @vitest-environment jsdom
// WfAgentBar (ADM-1333, plan §3.4): the agent bar talks to the Super Agent on the existing agent socket client
// (ChatConnection, mocked here), scopes every message to the workflow with an INTEGER graph_id, hands the proposal frame
// to the proposal, and shows the real reason when something fails.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { h, ref, nextTick } from 'vue'

// The REAL ChatConnection builds the frames (sendMessage); only its transport is replaced, so no WebSocket opens.
const conns = []
vi.mock('@/services/chatService', async (importOriginal) => {
  const actual = await importOriginal()
  class TestConnection extends actual.ChatConnection {
    constructor(conversationId, handlers) {
      super(conversationId, handlers)
      this.sent = []
      this.stop = vi.fn(() => super.stop())
      this.reconnectNow = vi.fn()
      this.setConversation = vi.fn()
      conns.push(this)
    }
    connect() { this.isOpen = true; this.handlers.onOpen?.() }
    _send(obj) { this.sent.push(obj) }
  }
  return { ...actual, ChatConnection: TestConnection }
})

const store = { ensureSuperAgent: vi.fn(async () => ({ id: 7, is_platform_super_agent: true })) }
vi.mock('@/stores/useChatStore', () => ({ useChatStore: () => store }))
vi.mock('@/components/agent/AgentModelPicker.vue', () => ({
  default: { name: 'AgentModelPicker', props: ['agentId'], render() { return h('span', { 'data-test': 'model-pill' }, `model of ${this.agentId}`) } },
}))

const { default: WfAgentBar } = await import('./WfAgentBar.vue')
const { browserTimeZone } = await import('@/services/chatService')

function fakeProposal() {
  return {
    hunks: ref([]), issues: ref([]), proposalId: ref(null), pendingCount: ref(0),
    receive: vi.fn(async () => true),
    accept: vi.fn(() => true), reject: vi.fn(() => true), acceptAll: vi.fn(() => 0), rejectAll: vi.fn(() => 0), clear: vi.fn(),
  }
}

function mountBar(props = {}) {
  const proposal = props.proposal || fakeProposal()
  const wrapper = mount(WfAgentBar, {
    props: { doc: {}, history: {}, proposal, graphId: 42, ...props },
    attachTo: document.body,
    global: { stubs: { 'router-link': RouterLinkStub, RouterLink: RouterLinkStub } },
  })
  return { wrapper, proposal }
}

async function sendText(wrapper, text = 'Add a Slack step') {
  await wrapper.get('[data-test="wfab-input"]').setValue(text)
  await wrapper.get('[data-test="wfab-form"]').trigger('submit')
  await flushPromises()
}
const conn = () => conns[conns.length - 1]
const frame = async (msg) => { conn().handlers.onEvent(msg); await flushPromises(); await nextTick() }

beforeEach(() => {
  conns.length = 0
  store.ensureSuperAgent.mockClear()
  store.ensureSuperAgent.mockImplementation(async () => ({ id: 7, is_platform_super_agent: true }))
})
afterEach(() => { document.body.innerHTML = '' })

describe('WfAgentBar', () => {
  it('shows the model and the balance hint, never credits', async () => {
    const { wrapper } = mountBar()
    await flushPromises()
    expect(wrapper.get('[data-test="model-pill"]').text()).toBe('model of 7')
    expect(wrapper.text()).toContain('Paid from your balance')
    expect(wrapper.text().toLowerCase()).not.toContain('credit')
  })

  it('sends a chat_message to the Super Agent with workflow_context.graph_id as a number', async () => {
    const { wrapper } = mountBar({ graphId: '42' })
    await sendText(wrapper)
    const sent = conn().sent
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ type: 'chat_message', message: 'Add a Slack step', agentId: '7', workflow_context: { graph_id: 42 } })
    expect(typeof sent[0].workflow_context.graph_id).toBe('number')
    expect(sent[0].timezone).toBe(browserTimeZone())
    expect(typeof sent[0].timezone).toBe('string')
    expect(sent[0].client_message_id).toMatch(/^c-/)
    expect(sent[0].conversation_id).toBeFalsy()
    expect(wrapper.get('[data-test="wfab-input"]').element.value).toBe('')
    expect(wrapper.find('[data-test="wfab-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="wfab-stop"]').exists()).toBe(true)

    // The server opens the conversation; the next message names it.
    await frame({ type: 'conversation_created', conversation_id: 901 })
    await frame({ type: 'assistant_message_chunk', chunk: 'Done' })
    await frame({ type: 'assistant_message_complete', full_message: 'Done, see the proposal.' })
    expect(wrapper.text()).toContain('Done, see the proposal.')
    expect(wrapper.get('[data-test="wfab-announce"]').text()).toContain('The agent replied')
    await sendText(wrapper, 'Also log it')
    expect(conn().sent[1]).toMatchObject({ type: 'chat_message', conversation_id: '901', workflow_context: { graph_id: 42 } })
    expect(conn().setConversation).not.toHaveBeenCalled()   // no `resume` raced against the message
    expect(conns).toHaveLength(1)   // one socket client, reused
  })

  it('hands a workflow_proposal frame for this workflow to the proposal, and nothing else', async () => {
    const { wrapper, proposal } = mountBar()
    await sendText(wrapper)
    await frame({ type: 'conversation_created', conversation_id: 5 })
    const f = { type: 'workflow_proposal', graph_id: 42, proposal_id: 'wfp_ab', operations: [{ op: 'remove_node', id: 'x' }], errors: [] }
    await frame(f)
    expect(proposal.receive).toHaveBeenCalledWith(f)
    await frame({ ...f, graph_id: 43, proposal_id: 'wfp_other_graph' })
    await frame({ ...f, conversation_id: 6, proposal_id: 'wfp_other_chat' })
    expect(proposal.receive).toHaveBeenCalledTimes(1)
  })

  it('lists hunks with per-hunk accept/reject, refused items with their message, and accept/reject all', async () => {
    const proposal = fakeProposal()
    proposal.hunks.value = [
      { index: 0, op: { op: 'update_node' }, target: { kind: 'node', id: 'a' }, mark: 'change', error: null, state: 'pending', summary: 'Change step “a”: label' },
      { index: 1, op: { op: 'update_node' }, target: { kind: 'node', id: 'b' }, mark: 'change', error: { message: 'contains a redaction marker' }, state: 'refused', summary: 'Change step “b”' },
    ]
    const { wrapper } = mountBar({ proposal })
    await wrapper.get('[data-test="wfab-toggle"]').trigger('click')
    expect(wrapper.get('[data-test="wfab-refused"]').text()).toContain('contains a redaction marker')
    expect(wrapper.find('[data-test="wfab-accept-1"]').exists()).toBe(false)
    const accept = wrapper.get('[data-test="wfab-accept-0"]')
    expect(accept.attributes('aria-label')).toBe('Accept: Change step “a”: label')
    await accept.trigger('click')
    expect(proposal.accept).toHaveBeenCalledWith(0)
    await wrapper.get('[data-test="wfab-reject-0"]').trigger('click')
    expect(proposal.reject).toHaveBeenCalledWith(0)
    await wrapper.get('[data-test="wfab-accept-all"]').trigger('click')
    await wrapper.get('[data-test="wfab-reject-all"]').trigger('click')
    expect(proposal.acceptAll).toHaveBeenCalled()
    expect(proposal.rejectAll).toHaveBeenCalled()
    for (const b of wrapper.findAll('button.wfab-icon-btn')) expect(b.attributes('aria-label')).toBeTruthy()
  })

  it('after an accept, says the draft is unsaved and offers to undo the agent change', async () => {
    const proposal = fakeProposal()
    proposal.hunks.value = [{ index: 0, op: { op: 'remove_node' }, target: { kind: 'node', id: 'a' }, mark: 'remove', error: null, state: 'accepted', summary: 'Remove step “a”' }]
    const history = { canUndo: ref(true), undoLabel: ref('Agent change'), undo: vi.fn(() => true) }
    const { wrapper } = mountBar({ proposal, history, doc: { dirty: ref(true) } })
    await wrapper.get('[data-test="wfab-toggle"]').trigger('click')
    expect(wrapper.get('[data-test="wfab-unsaved"]').text()).toContain('Save the workflow to keep them')
    await wrapper.get('[data-test="wfab-undo"]').trigger('click')
    expect(history.undo).toHaveBeenCalled()
  })

  it('shows a balance refusal with its reason and a top-up link', async () => {
    const { wrapper } = mountBar()
    await sendText(wrapper)
    await frame({ type: 'error', error: 'Your balance is $0.00. Top up to keep using paid models.', code: 'wallet_empty', retryable: false })
    expect(wrapper.get('[data-test="wfab-error"]').text()).toContain('Your balance is $0.00. Top up to keep using paid models.')
    expect(wrapper.find('[data-test="wfab-topup"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="wfab-send"]').exists()).toBe(true)   // the turn is over
  })

  it('shows an agent error as the server said it, and ignores a benign control rejection', async () => {
    const { wrapper } = mountBar()
    await sendText(wrapper)
    await frame({ type: 'error', error: 'Unknown message type: agent_prewarm' })
    expect(wrapper.find('[data-test="wfab-error"]').exists()).toBe(false)
    await frame({ type: 'error', error: 'The model provider refused the request: context too long.' })
    expect(wrapper.get('[data-test="wfab-error"]').text()).toContain('The model provider refused the request: context too long.')
    expect(wrapper.get('[data-test="wfab-error"]').attributes('role')).toBe('alert')
  })

  it('says when the socket is down and offers Reconnect now', async () => {
    const { wrapper } = mountBar()
    await sendText(wrapper)
    conn().handlers.onClose()
    await nextTick()
    expect(wrapper.get('[data-test="wfab-connection"]').text()).toContain('Reconnecting')
    conn().handlers.onConnectionState('lost')
    await nextTick()
    expect(wrapper.get('[data-test="wfab-connection"]').text()).toContain('Connection to the agent lost')
    await wrapper.get('[data-test="wfab-reconnect"]').trigger('click')
    expect(conn().reconnectNow).toHaveBeenCalled()
  })

  it('says why nothing was sent when the Super Agent cannot be loaded', async () => {
    store.ensureSuperAgent.mockImplementation(async () => null)
    const { wrapper } = mountBar()
    await sendText(wrapper)
    expect(conns).toHaveLength(0)
    expect(wrapper.get('[data-test="wfab-agent-error"]').text()).toContain('Super Agent could not be loaded')
    expect(wrapper.get('[data-test="wfab-input"]').element.value).toBe('Add a Slack step')   // the text is kept
  })

  it('stops the agent, and Esc closes the panel with focus back in the prompt', async () => {
    const { wrapper } = mountBar()
    await sendText(wrapper)
    await wrapper.get('[data-test="wfab-stop"]').trigger('click')
    expect(conn().stop).toHaveBeenCalled()
    expect(conn().sent.at(-1)).toEqual({ type: 'stop_execution', conversation_id: null })
    expect(wrapper.find('[data-test="wfab-send"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="wfab-panel"]').exists()).toBe(true)
    await wrapper.get('[data-test="wfab-close"]').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.find('[data-test="wfab-panel"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-test="wfab-input"]').element)
    expect(wrapper.get('[data-test="wfab-toggle"]').attributes('aria-expanded')).toBe('false')
  })
})
