// @vitest-environment jsdom
// Plan mode's card (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md): where the run paused, it names the plan file and opens it BESIDE
// the chat (never repeating it or its steps); exactly the answers the server offered, with why "run on its own" is
// missing; "keep planning" needs the person's notes; once answered, the plan under review remembers the answer.
// HITLModal draws it for `kind: 'plan_approval'` (a Work turn's rail).
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PlanModeCard from './PlanModeCard.vue'
import HITLModal from '../HITLModal.vue'
import { usePlanReviewStore } from '../../stores/usePlanReviewStore'

const request = (over = {}) => ({
  request_id: 'pr1', conversation_id: 'c1', interaction_type: 'approval', response_type: 'choice', urgency: 'medium',
  payload: {
    kind: 'plan_approval', request_id: 'pr1', run_id: 'run-9', plan_version_id: 'pv-3', conversation_id: 'c1',
    plan_file: { path: '.aadml/plans/login.md', surface: 'lets_code', content: '# Login page\n\nAdd **a form**.\n\n<img src=x onerror=alert(1)>' },
    steps: [{ id: 's1', description: 'Read the routes' }, { id: 's2', description: 'Add the form' }],
    answers: [{ id: 'run_on_its_own', title: 'Run it on its own' }, { id: 'ask_before_each_change', title: 'Ask before each change' },
              { id: 'keep_planning', title: 'Keep planning' }],
    notes_answer: 'keep_planning', person_only: true,
    ...over,
  },
})
const mountCard = (r = request()) => mount(PlanModeCard, { props: { request: r }, global: { stubs: { Icon: true } } })

describe('PlanModeCard', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('says the run is paused, names the plan file and repeats neither the plan nor its steps', () => {
    const w = mountCard()
    expect(w.find('#pmc-title').text()).toBe('Plan ready for review')
    expect(w.text()).toContain('The run is paused')
    expect(w.find('[data-test="pmc-open-plan"]').text()).toContain('.aadml/plans/login.md')
    expect(w.find('[data-test="pmc-content"]').exists()).toBe(false)
    expect(w.find('[data-test="pmc-steps"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Read the routes')
  })

  it('"Open the plan" opens it beside the chat, for its own conversation', async () => {
    const w = mountCard()
    await w.find('[data-test="pmc-open-plan"]').trigger('click')
    const plans = usePlanReviewStore()
    expect(plans.open).toBe(true)
    expect(plans.forConversation('c1')).toMatchObject({ requestId: 'pr1', path: '.aadml/plans/login.md', runId: 'run-9' })
    expect(plans.forConversation('c2')).toBe(null)
  })

  it('says why "run on its own" is missing, and only when it is', () => {
    expect(mountCard().find('[data-test="pmc-no-autonomy"]').exists()).toBe(false)
    const w = mountCard(request({ answers: [{ id: 'ask_before_each_change', title: 'Yes, ask me before risky changes' },
                                           { id: 'keep_planning', title: 'No, keep planning' }] }))
    expect(w.find('[data-test="pmc-no-autonomy"]').text()).toContain('as its owner set it')
  })

  it('an answer is remembered for the line the card leaves behind', async () => {
    const w = mountCard(request({ answers: [{ id: 'ask_before_each_change', title: 'Yes, ask me before risky changes' },
                                           { id: 'keep_planning', title: 'No, keep planning' }] }))
    await w.find('[data-test="pmc-answer-ask_before_each_change"]').trigger('click')
    expect(usePlanReviewStore().forConversation('c1').answer).toBe('Plan approved: ask me before risky changes')
  })

  it('offers exactly the answers given, in their order', () => {
    const w = mountCard()
    expect(w.findAll('[data-test="pmc-answers"] button').map((b) => b.text()))
      .toEqual(['Run it on its own', 'Ask before each change', 'Keep planning'])
    const w2 = mountCard(request({ answers: [{ id: 'ask_before_each_change', title: 'Ask before each change' },
                                             { id: 'keep_planning', title: 'Keep planning' }] }))
    expect(w2.find('[data-test="pmc-answer-run_on_its_own"]').exists()).toBe(false)
  })

  it('an answer is sent once with its id and no notes', async () => {
    const w = mountCard()
    await w.find('[data-test="pmc-answer-ask_before_each_change"]').trigger('click')
    await w.find('[data-test="pmc-answer-run_on_its_own"]').trigger('click')
    expect(w.emitted('respond')).toEqual([[{ request_id: 'pr1', response_value: 'ask_before_each_change', feedback: '' }]])
  })

  it('"keep planning" needs notes: empty is refused with a message, written notes are sent as feedback', async () => {
    const w = mountCard()
    await w.find('[data-test="pmc-answer-keep_planning"]').trigger('click')
    expect(w.find('[data-test="pmc-notes"]').exists()).toBe(true)
    await w.find('form').trigger('submit')
    expect(w.emitted('respond')).toBeUndefined()
    expect(w.find('[role="alert"]').text()).toContain('Write what should change')
    await w.find('[data-test="pmc-notes"]').setValue('  Keep the old API working  ')
    await w.find('form').trigger('submit')
    expect(w.emitted('respond')).toEqual([[{ request_id: 'pr1', response_value: 'keep_planning', feedback: 'Keep the old API working' }]])
  })

  it('HITLModal draws a plan_approval request as this card and passes its answer on', async () => {
    const w = mount(HITLModal, { props: { requests: [request()] }, global: { stubs: { Icon: true, Teleport: true } } })
    expect(w.find('[data-test="plan-mode-card"]').exists()).toBe(true)
    expect(w.find('.hitl-modal').exists()).toBe(false)
    expect(w.find('.hitl-overlay--compact').exists()).toBe(true)        // a Work turn's rail mounts it inline
    await w.find('[data-test="pmc-answer-run_on_its_own"]').trigger('click')
    expect(w.emitted('respond')[0][0]).toEqual({ request_id: 'pr1', response_value: 'run_on_its_own', feedback: '' })
  })
})
