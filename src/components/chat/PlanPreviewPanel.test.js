// @vitest-environment jsdom
// The plan under review, read beside the chat (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md): the plan file rendered whole as safe
// markdown, its steps when no file reached the page, its state; the chat's dock carries it as a "Plan" tab that comes
// to the front when a plan is ready and closes with the dock's X.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PlanPreviewPanel from './PlanPreviewPanel.vue'
import ChatDock from './ChatDock.vue'
import { usePlanReviewStore } from '../../stores/usePlanReviewStore'
import { useChatStore } from '../../stores/useChatStore'

const request = (over = {}) => ({
  request_id: 'pr1',
  payload: {
    kind: 'plan_approval', run_id: 'run-9',
    plan_file: { path: 'plans/run-9.md', content: '# Login page\n\nAdd **a form**.\n\n<img src=x onerror=alert(1)>' },
    steps: [{ id: 's1', description: 'Read the routes' }, { id: 's2', description: 'Add the form' }],
    ...over,
  },
})

describe('PlanPreviewPanel', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders the plan file whole as markdown, never raw HTML, with its path and state', () => {
    usePlanReviewStore().show(request(), 'c1')
    const w = mount(PlanPreviewPanel, { props: { conversationId: 'c1' }, global: { stubs: { Icon: true } } })
    const doc = w.find('[data-test="ppp-content"]')
    expect(doc.find('h1').text()).toBe('Login page')
    expect(doc.find('strong').text()).toBe('a form')
    expect(doc.find('img').exists()).toBe(false)
    expect(w.text()).toContain('plans/run-9.md')
    expect(w.find('[data-test="ppp-state"]').text()).toBe('Waiting for you')
    usePlanReviewStore().answered('pr1', 'Plan approved: ask me before risky changes')
    return w.vm.$nextTick().then(() => expect(w.find('[data-test="ppp-state"]').text()).toBe('Answered'))
  })

  it('shows the steps when no plan file reached the page', () => {
    usePlanReviewStore().show(request({ plan_file: {} }), 'c1')
    const w = mount(PlanPreviewPanel, { props: { conversationId: 'c1' }, global: { stubs: { Icon: true } } })
    expect(w.findAll('[data-test="ppp-steps"] li').map((l) => l.text())).toEqual(['Read the routes', 'Add the form'])
  })

  it('never shows another conversation\'s plan', () => {
    usePlanReviewStore().show(request(), 'c1')
    const w = mount(PlanPreviewPanel, { props: { conversationId: 'c2' }, global: { stubs: { Icon: true } } })
    expect(w.find('[data-test="ppp-content"]').exists()).toBe(false)
    expect(w.text()).toContain('No plan to show yet')
  })

  it('a new plan replaces the last one and clears its answer; the same request again changes nothing', () => {
    const plans = usePlanReviewStore()
    plans.show(request(), 'c1')
    plans.answered('pr1', 'Changes sent: the agent is planning again')
    plans.show(request(), 'c1')
    expect(plans.review.answer).toBe('Changes sent: the agent is planning again')
    plans.show({ request_id: 'pr2', payload: { plan_file: { path: 'plans/run-9.md', content: '# v2' } } }, 'c1')
    expect(plans.review).toMatchObject({ requestId: 'pr2', content: '# v2', answer: '' })
  })
})

describe('ChatDock — the Plan tab', () => {
  beforeEach(() => { setActivePinia(createPinia()) })
  const stubs = { CanvasShell: true, ArtifactsPanel: true, BrowserPanel: true, VideoPanel: true, Icon: true }

  it('comes to the front when the plan is opened, and the X closes it', async () => {
    useChatStore().conversationId = 'c1'
    const plans = usePlanReviewStore()
    plans.show(request(), 'c1', { openPanel: true })
    const w = mount(ChatDock, { global: { stubs } })
    const tab = w.find('[data-test="dock-tab-plan"]')
    expect(tab.exists()).toBe(true)
    expect(tab.attributes('aria-selected')).toBe('true')
    expect(w.find('[data-test="plan-preview"]').isVisible()).toBe(true)
    await w.find('.dock-x').trigger('click')
    expect(plans.open).toBe(false)
  })

  it('has no Plan tab for a plan of another chat, or when no plan is open', () => {
    useChatStore().conversationId = 'c2'
    usePlanReviewStore().show(request(), 'c1', { openPanel: true })
    expect(mount(ChatDock, { global: { stubs } }).find('[data-test="dock-tab-plan"]').exists()).toBe(false)
  })
})
