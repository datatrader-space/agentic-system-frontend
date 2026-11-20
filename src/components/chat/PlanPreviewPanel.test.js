// @vitest-environment jsdom
// The plan under review, read beside the chat (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md): the plan file rendered whole as safe
// markdown; the chat's dock carries it as a "Plan" tab that comes to the front when a plan is opened and closes with the
// dock's X.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PlanPreviewPanel from './PlanPreviewPanel.vue'
import ChatDock from './ChatDock.vue'
import { usePlanReviewStore } from '../../stores/usePlanReviewStore'
import { useChatStore } from '../../stores/useChatStore'

const planFile = (over = {}) => ({
  path: 'plans/run-9.md', run_id: 'run-9', plan_version_id: 'v1',
  content: '# Login page\n\nAdd **a form**.\n\n<img src=x onerror=alert(1)>',
  ...over,
})

describe('PlanPreviewPanel', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('renders the plan file whole as markdown, never raw HTML, with its path', () => {
    usePlanReviewStore().show(planFile(), 'c1')
    const w = mount(PlanPreviewPanel, { props: { conversationId: 'c1' }, global: { stubs: { Icon: true } } })
    const doc = w.find('[data-test="ppp-content"]')
    expect(doc.find('h1').text()).toBe('Login page')
    expect(doc.find('strong').text()).toBe('a form')
    expect(doc.find('img').exists()).toBe(false)
    expect(w.text()).toContain('plans/run-9.md')
  })

  it('never shows another conversation\'s plan', () => {
    usePlanReviewStore().show(planFile(), 'c1')
    const w = mount(PlanPreviewPanel, { props: { conversationId: 'c2' }, global: { stubs: { Icon: true } } })
    expect(w.find('[data-test="ppp-content"]').exists()).toBe(false)
    expect(w.text()).toContain('No plan to show yet')
  })

  it('a new version of the plan replaces the last one; the same plan again changes nothing; no path, nothing', () => {
    const plans = usePlanReviewStore()
    plans.show(planFile(), 'c1')
    const first = plans.review
    plans.show(planFile(), 'c1')
    expect(plans.review).toBe(first)
    plans.show(planFile({ plan_version_id: 'v2', content: '# v2' }), 'c1')
    expect(plans.review).toMatchObject({ runId: 'run-9', path: 'plans/run-9.md', content: '# v2' })
    plans.show({ content: 'x' }, 'c1')
    expect(plans.review.content).toBe('# v2')
  })
})

describe('the plan under review: opened by itself or asked for', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('a plan that opens by itself is not "asked for"; the file card is, and closing clears both', () => {
    // Let's Code shares one pane between the chat and the editor: only an asked-for plan takes it, so the chat stays.
    const plans = usePlanReviewStore()
    plans.show(planFile(), 'c1', { openPanel: true })
    expect([plans.open, plans.focus]).toEqual([true, false])
    plans.closePanel()
    plans.openPanel()
    expect([plans.open, plans.focus]).toEqual([true, true])
    plans.closePanel()
    expect([plans.open, plans.focus]).toEqual([false, false])
  })
})

describe('ChatDock — the Plan tab', () => {
  beforeEach(() => { setActivePinia(createPinia()) })
  const stubs = { CanvasShell: true, ArtifactsPanel: true, BrowserPanel: true, VideoPanel: true, Icon: true }

  it('comes to the front when the plan is opened, and the X closes it', async () => {
    useChatStore().conversationId = 'c1'
    const plans = usePlanReviewStore()
    plans.show(planFile(), 'c1', { openPanel: true })
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
    usePlanReviewStore().show(planFile(), 'c1', { openPanel: true })
    expect(mount(ChatDock, { global: { stubs } }).find('[data-test="dock-tab-plan"]').exists()).toBe(false)
  })
})
