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

// A completed timeline collapses to a one-line header; click it to reveal the step rows.
const expandRows = async (w) => {
  const head = w.find('.at-head')
  if (head.exists()) await head.trigger('click')
  return w
}

describe('AgentActivityTimeline', () => {
  it('renders the clean user-style timeline (label, duration) for any tier', async () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [builderStep], running: false, isComplete: true },
    })
    await expandRows(w)
    const txt = w.text()
    expect(txt).toContain('Checking Shopify')
    expect(txt).toContain('1.2s')
    // step.summary ('Found 3 orders') renders only in the builder/debug section, not the clean row.
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

  it('shows the builder/debug details section with raw tool name + args_preview when debug is on', async () => {
    const w = mount(AgentActivityTimeline, {
      props: { steps: [builderStep], debug: true, isComplete: true },
    })
    const txt = w.text()
    expect(txt).toContain('Debug details')
    expect(txt).toContain('SHOPIFY_GET_ORDERS')
    expect(txt).toContain('{"limit": 5}')
    // the clean timeline above must NOT inline the raw tool name (only the friendly label).
    // The rows are collapsed when complete — expand them before inspecting.
    await expandRows(w)
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
    // Normal completion with no summary.durationMs collapses to "Done"; the header shows the
    // step count ("· 1 step"), not a tool count (tool counts now live only in the debug section).
    expect(done.text()).toContain('Done')
    expect(done.text()).toContain('1 step')
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
      // The collapsed header (which carries the mapped label) renders only when there are steps.
      const internal = mount(AgentActivityTimeline, { props: { steps: [builderStep], summary, isComplete: true } })
      expect(internal.text()).toContain('Interrupted — connection lost') // doneLabel for interrupted, non-public
      const pub = mount(AgentActivityTimeline, { props: { steps: [builderStep], summary, publicSafe: true, isComplete: true } })
      expect(pub.text()).toContain('Completed') // public collapses interrupted to the neutral doneLabel
      expect(pub.text()).not.toContain('Interrupted') // raw internal label not shown publicly
    })
  })

  it('public failed summary uses safe customer copy (not "Failed safely")', () => {
    const summary = { finalStatus: 'failed', label: 'Failed safely' }
    // The collapsed header renders only when there are steps.
    const pub = mount(AgentActivityTimeline, { props: { steps: [builderStep], summary, publicSafe: true, isComplete: true } })
    expect(pub.text()).toContain('Could not complete') // public doneLabel for a failed turn
    expect(pub.text()).not.toContain('Failed safely')
  })

  describe('public tier (publicSafe)', () => {
    it('shows only friendly label + source names; hides summary text, duration, refs, and debug', async () => {
      const sources = [{ kind: 'knowledge_base', name: 'Knowledge Base', ref: 'doc/secret-7' }]
      const w = mount(AgentActivityTimeline, {
        props: { steps: [builderStep], sources, publicSafe: true, isComplete: true },
      })
      await expandRows(w)
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
          steps: [builderStep], // header (with the label) renders only when there are steps
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

// A Work run is many turns, and each one finishing is NOT the run finishing.
//
// REPORTED FROM A LIVE RUN: this panel read "Done - 20 steps" over five green plan steps while the
// line directly beneath it said "Iteration 1 of 12 - working". Two signals, opposite meanings, and
// the more emphatic one was wrong -- the user could not tell whether the agent had finished the job.
describe('a Work iteration finishing is not the run finishing', () => {
  const done = { finalStatus: 'ok', durationMs: 240000 }

  const head = (props) => mount(AgentActivityTimeline, {
    props: { steps: [builderStep], running: false, isComplete: true, summary: done, ...props },
  }).find('.at-head').text()

  it('names the iteration instead of claiming the work is done', () => {
    const t = head({ workIteration: { segment: 1, max: 12 } })
    expect(t).toContain('Iteration 1 of 12 complete')
    expect(t).not.toMatch(/\bDone\b/)
  })

  it('does not say "Thought for 4m" either', () => {
    // The duration headline reads just as much like the end of the work as "Done" does.
    expect(head({ workIteration: { segment: 2, max: 12 } })).not.toContain('Thought for')
  })

  it('still reports trouble within the iteration', () => {
    const t = head({ workIteration: { segment: 3, max: 12 }, hasFailures: true })
    expect(t).toContain('Iteration 3 of 12')
    expect(t).toContain('issues')
  })

  it('keeps an interrupted turn honest rather than relabelling it', () => {
    const t = head({ workIteration: { segment: 1, max: 12 },
                     summary: { finalStatus: 'interrupted' } })
    expect(t).toContain('Interrupted')
  })

  it('omits the total when the run does not declare one', () => {
    expect(head({ workIteration: { segment: 4, max: 0 } })).toContain('Iteration 4 complete')
  })

  it('leaves an ordinary chat turn saying what it always said', () => {
    // THE REGRESSION THAT MATTERS: this header renders on every assistant turn in the app.
    const t = head({})
    expect(t).toMatch(/Thought for|Done/)
    expect(t).not.toContain('Iteration')
  })
})
