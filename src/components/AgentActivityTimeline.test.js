// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentActivityTimeline from './AgentActivityTimeline.vue'

const builderStep = {
  stepId: 'A',
  toolCallId: 'tc_1',
  phase: 'using_tools',
  tool: 'SHOPIFY_GET_ORDERS',
  argsPreview: '{"limit": 5}',
  label: 'Checking Shopify',
  status: 'ok',
  summary: 'Found 3 orders',
  durationMs: 1200,
  reason: '',
  nextAction: '',
}

describe('AgentActivityTimeline', () => {
  it('renders the clean user-style timeline (label, duration, summary) for any tier', () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [builderStep], running: false, isComplete: true },
    })
    const txt = w.text()
    expect(txt).toContain('Checking Shopify')
    expect(txt).toContain('1.2s')
    expect(txt).toContain('Found 3 orders')
  })

  it('hides builder/debug fields (raw tool name + args_preview) on the user tier (debug off)', () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [builderStep], debug: false, isComplete: true },
    })
    const txt = w.text()
    expect(txt).not.toContain('Debug details')
    expect(txt).not.toContain('SHOPIFY_GET_ORDERS')
    expect(txt).not.toContain('args')
  })

  it('shows the builder/debug details section with raw tool name + args_preview when debug is on', () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [builderStep], debug: true, isComplete: true },
    })
    const txt = w.text()
    expect(txt).toContain('Debug details')
    expect(txt).toContain('SHOPIFY_GET_ORDERS')
    expect(txt).toContain('{"limit": 5}')
    // the clean timeline above must NOT inline the raw tool name (only the friendly label)
    expect(w.find('.agent-steps').text()).not.toContain('SHOPIFY_GET_ORDERS')
  })

  it('shows source refs only in the debug section', () => {
    const sources = [{ kind: 'connector', name: 'GitHub', ref: 'repo/x#L1' }]
    const userTier = mount(AgentActivityTimeline, { props: { sources, debug: false } })
    expect(userTier.text()).toContain('GitHub')
    expect(userTier.text()).not.toContain('repo/x#L1') // ref hidden on user tier

    const builderTier = mount(AgentActivityTimeline, { props: { sources, debug: true } })
    expect(builderTier.text()).toContain('repo/x#L1') // ref visible in debug section
  })

  it('renders the live status line while running, then the turn summary when complete', () => {
    const running = mount(AgentActivityTimeline, {
      props: { statusLabel: 'Searching the knowledge base…', running: true, isComplete: false },
    })
    expect(running.text()).toContain('Searching the knowledge base…')

    const done = mount(AgentActivityTimeline, {
      props: {
        steps: [builderStep],
        summary: { finalStatus: 'completed', label: 'Completed', toolsUsedCount: 1, sourcesUsedCount: 0 },
        isComplete: true,
        running: false,
      },
    })
    expect(done.text()).toContain('Completed')
    expect(done.text()).toContain('1 tool')
  })

  it('renders nothing when there is no activity', () => {
    const w = mount(AgentActivityTimeline, { props: {} })
    expect(w.text()).toBe('')
  })

  it('does not render an empty "Sources used" footer when there are no sources', () => {
    const w = mount(AgentActivityTimeline, { props: { steps: [builderStep], isComplete: true } })
    expect(w.text()).not.toContain('Sources used')
  })

  describe('interrupted state', () => {
    const interruptedStep = {
      stepId: 'A', phase: 'using_tools', tool: 'SHOPIFY_GET_ORDERS', label: 'Checking Shopify',
      status: 'interrupted', summary: '', durationMs: null, reason: 'Connection lost.', nextAction: '',
    }

    it('shows an interrupted step without a spinner, and the reason on non-public tiers', () => {
      const w = mount(AgentActivityTimeline, { props: { steps: [interruptedStep] } })
      expect(w.find('.agent-spinner.sm').exists()).toBe(false) // not spinning
      expect(w.find('.icon-interrupted').exists()).toBe(true)
      expect(w.text()).toContain('Connection lost.')
    })

    it('hides the interrupted reason on the public tier', () => {
      const w = mount(AgentActivityTimeline, { props: { steps: [interruptedStep], publicSafe: true } })
      expect(w.text()).not.toContain('Connection lost.')
    })

    it('maps the interrupted turn-summary label per tier', () => {
      const summary = { finalStatus: 'interrupted', label: 'Interrupted' }
      const internal = mount(AgentActivityTimeline, { props: { summary, isComplete: true } })
      expect(internal.text()).toContain('Interrupted')
      const pub = mount(AgentActivityTimeline, { props: { summary, publicSafe: true, isComplete: true } })
      expect(pub.text()).toContain('The connection was interrupted. Please try again.')
      expect(pub.text()).not.toContain('Interrupted') // raw internal label not shown publicly
    })
  })

  it('public failed summary uses safe customer copy (not "Failed safely")', () => {
    const summary = { finalStatus: 'failed', label: 'Failed safely' }
    const pub = mount(AgentActivityTimeline, { props: { summary, publicSafe: true, isComplete: true } })
    expect(pub.text()).toContain('I could not complete that request right now.')
    expect(pub.text()).not.toContain('Failed safely')
  })

  describe('public tier (publicSafe)', () => {
    it('shows only friendly label + source names; hides summary text, duration, refs, and debug', () => {
      const sources = [{ kind: 'knowledge_base', name: 'Knowledge Base', ref: 'doc/secret-7' }]
      const w = mount(AgentActivityTimeline, {
        props: { steps: [builderStep], sources, publicSafe: true, isComplete: true },
      })
      const txt = w.text()
      // friendly label + source name visible
      expect(txt).toContain('Checking Shopify')
      expect(txt).toContain('Knowledge Base')
      // private/debug fields hidden
      expect(txt).not.toContain('SHOPIFY_GET_ORDERS') // raw tool name
      expect(txt).not.toContain('{"limit": 5}') // args_preview
      expect(txt).not.toContain('Found 3 orders') // step summary
      expect(txt).not.toContain('1.2s') // duration
      expect(txt).not.toContain('doc/secret-7') // source ref
      expect(txt).not.toContain('Debug details')
    })

    it('publicSafe wins over debug=true — no debug section, no private fields', () => {
      const w = mount(AgentActivityTimeline, {
        props: { steps: [builderStep], debug: true, publicSafe: true, isComplete: true },
      })
      const txt = w.text()
      expect(txt).not.toContain('Debug details')
      expect(txt).not.toContain('SHOPIFY_GET_ORDERS')
      expect(txt).not.toContain('{"limit": 5}')
    })

    it('shows a generic friendly message for a failed step (never the raw reason)', () => {
      const failed = {
        stepId: 'B', phase: 'using_tools', tool: 'SHOPIFY_GET_ORDERS', label: 'Checking Shopify',
        status: 'failed', summary: '', durationMs: null,
        reason: 'shopify oauth token expired: 401 unauthorized', nextAction: 'Reconnect the Shopify connector',
      }
      const w = mount(AgentActivityTimeline, { props: { steps: [failed], publicSafe: true } })
      const txt = w.text()
      expect(txt).toContain('I couldn’t complete this step.')
      expect(txt).not.toContain('oauth')
      expect(txt).not.toContain('401')
      expect(txt).not.toContain('Reconnect the Shopify connector')
    })

    it('hides turn-summary counts on the public tier', () => {
      const w = mount(AgentActivityTimeline, {
        props: {
          publicSafe: true,
          summary: { finalStatus: 'completed', label: 'Completed', toolsUsedCount: 3, sourcesUsedCount: 2 },
          isComplete: true,
        },
      })
      const txt = w.text()
      expect(txt).toContain('Completed')
      expect(txt).not.toContain('3 tool')
      expect(txt).not.toContain('2 source')
    })
  })
})
