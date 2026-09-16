// @vitest-environment jsdom
//
// A WORK RUN READS START TO END, IN THE ORDER IT HAPPENED.
//
// Production conv 1578, recorded live: the rail drew every answer, then every verdict, so a run judged
// `not_met` and then `met` showed the yellow check for a moment and then erased it — the snapshot kept
// only the LATEST verdict — while attempt 2's answer replaced attempt 1's. The goal actions were a row
// of text buttons, and the token line and copy/feedback sat ABOVE the rail instead of at its end.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import RunTimeline from './RunTimeline.vue'
import { useRunTimeline } from '../../stores/useRunTimeline'
import { useChatStore } from '../../stores/useChatStore'

const RUN = 'run_1578'

const snapshot = (goal = {}, extra = {}) => ({
  run_id: RUN,
  run_status: 'completed',
  // What prod sends: the run's word. The goal's outcome must win over it.
  plan_status_label: 'Completed',
  steps: [{ step_id: 'op_1', title: 'Fetch the pages', status: 'completed', status_user: 'completed' }],
  work_goal: {
    state: 'ACHIEVED',
    last_verdict: 'met',
    last_findings: [],
    verdicts: [
      { segment: 1, verdict: 'not_met',
        findings: [{ observation: 'Only 3 of 4 versions found', repair_instruction: 'Fetch page 4' }] },
      { segment: 2, verdict: 'met', findings: [] },
    ],
    totals: { total_tokens: 71400, duration_ms: 31800, cost_usd: '0.26290746' },
    available_actions: ['resume', 'edit', 'clear'],
    ...goal,
  },
  ...extra,
})

function thread(chat) {
  chat.messages = [
    { id: 'u0', role: 'user', content: 'an older, unrelated question' },
    { id: 'a0', role: 'assistant', content: 'older answer', turnModeResolved: 'chat', runId: 'other' },
    { id: 'u1', role: 'user', content: 'Find the versions on these four pages' },
    { id: 'a1', role: 'assistant', content: 'Attempt one answer', runId: RUN, status: 'done',
      workIteration: { segment: 1, max: 3 } },
    { id: 's1', role: 'user', authoredBy: 'system', content: 'DO THE NEXT PIECE OF WORK' },
    { id: 'a2', role: 'assistant', content: 'Attempt two answer', runId: RUN, status: 'done',
      workIteration: { segment: 2, max: 3 } },
  ]
}

describe('RunTimeline — the run in order', () => {
  let store, chat
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRunTimeline()
    chat = useChatStore()
    thread(chat)
  })

  const rail = (snap = snapshot()) => {
    store.ingestSnapshot(RUN, snap)
    return mount(RunTimeline, { props: { runId: RUN, goal: snap.work_goal },
                                global: { stubs: { SourcesList: true } } })
  }
  const order = (w) => w.findAll('[data-test^="rt-answer-a"], [data-test^="rt-verdict-"], [data-test="rt-terminal"]')
    .map((n) => n.attributes('data-test'))

  it('answer 1 → the check that rejected it → answer 2 → the end', () => {
    expect(order(rail())).toEqual(['rt-answer-a1', 'rt-verdict-verdict_s1', 'rt-answer-a2', 'rt-terminal'])
  })

  it('a met goal does not erase the rejection before it', () => {
    const v = rail().find('[data-test="rt-verdict-verdict_s1"]')
    expect(v.exists()).toBe(true)
    expect(v.text()).toContain('Only 3 of 4 versions found')
    expect(v.text()).toContain('Fetch page 4')
  })

  it('both attempts keep their own answer', () => {
    const w = rail()
    expect(w.find('[data-test="rt-answer-a1"]').text()).toContain('Attempt one answer')
    expect(w.find('[data-test="rt-answer-a2"]').text()).toContain('Attempt two answer')
  })

  it('draws no node for the `met` judgement — the end row says it, in a success tone', () => {
    const w = rail()
    expect(w.findAll('[data-test^="rt-verdict-"]')).toHaveLength(1)
    const pill = w.find('[data-test="rt-terminal-state"]')
    expect(pill.text()).toBe('Goal met')
    expect(pill.classes()).toContain('ok')
  })

  it('a run still going says the latest rejection is being retried', () => {
    const snap = snapshot({ state: 'ACTIVE', verdicts: [{ segment: 1, verdict: 'not_met', findings: [] }] },
                          { run_status: 'executing' })
    chat.messages = chat.messages.slice(0, 4)
    const w = rail(snap)
    expect(w.find('[data-test="rt-verdict-verdict_s1"]').text()).toContain('trying again')
    expect(w.find('[data-test="rt-terminal"]').exists()).toBe(false)
  })

  it('a goal that stopped unmet on a paused run still ends, in a warning tone', () => {
    const snap = snapshot({ state: 'EXHAUSTED', verdicts: [
      { segment: 1, verdict: 'not_met', findings: [] }, { segment: 2, verdict: 'not_met', findings: [] }] },
    { run_status: 'paused' })
    const w = rail(snap)
    const pill = w.find('[data-test="rt-terminal-state"]')
    expect(pill.exists()).toBe(true)
    expect(pill.classes()).toContain('warn')
    // The final rejection is not "trying again" — nothing is.
    expect(w.findAll('[data-test^="rt-verdict-"]').at(-1).text()).not.toContain('trying again')
  })

  it('opens on THIS run’s request, not the first message of the thread', () => {
    const req = rail().find('[data-test="rt-request"]')
    expect(req.text()).toContain('Find the versions on these four pages')
    expect(req.text()).not.toContain('older, unrelated')
  })

  it('goal actions are icon buttons with an accessible name, not text buttons', () => {
    const w = rail()
    for (const a of ['resume', 'edit', 'clear']) {
      const b = w.find(`[data-test="rt-action-${a}"]`)
      expect(b.exists()).toBe(true)
      expect(b.find('svg').exists()).toBe(true)
      expect(b.text()).toBe('')
      expect(b.attributes('aria-label')).toBeTruthy()
      expect(b.attributes('title')).toBe(b.attributes('aria-label'))
    }
  })

  it('tokens, feedback and copy sit at the END of the run', () => {
    const w = rail()
    const end = w.find('[data-test="rt-terminal"]')
    expect(end.text()).toContain('71.4k tokens')
    expect(end.text()).toContain('$0.26')
    expect(end.text()).not.toContain('0.26290746')
    expect(end.find('[data-test="rt-end-actions"]').exists()).toBe(true)
    expect(end.find('[data-test="rt-copy"]').exists()).toBe(true)
    expect(end.find('[data-test="rt-share"]').exists()).toBe(true)
    expect(end.find('[data-test="rt-regenerate"]').exists()).toBe(true)
  })

  it('a streaming answer is on the rail as it arrives', () => {
    chat.messages[5] = { ...chat.messages[5], status: 'streaming', content: 'Attempt two, half written' }
    const w = rail(snapshot({ state: 'ACTIVE', verdicts: [{ segment: 1, verdict: 'not_met', findings: [] }] },
                            { run_status: 'executing' }))
    const a = w.find('[data-test="rt-answer-a2"]')
    expect(a.text()).toContain('half written')
    expect(a.attributes('data-state')).toBe('active')
  })
})

describe('RunTimeline — preparation, reasoning and labels live inside the rail', () => {
  let store, chat
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRunTimeline()
    chat = useChatStore()
  })

  const snap = (steps) => ({
    run_id: RUN, run_status: 'executing',
    steps, work_goal: { state: 'ACTIVE', verdicts: [], available_actions: [] },
  })
  const mountRail = (s) => {
    store.ingestSnapshot(RUN, s)
    return mount(RunTimeline, { props: { runId: RUN, goal: s.work_goal }, global: { stubs: { SourcesList: true } } })
  }

  it('what happened before the plan existed opens the rail as its first step, not a separate card', () => {
    chat.messages = [
      { id: 'u1', role: 'user', content: 'go' },
      { id: 'a1', role: 'assistant', content: 'done', runId: RUN, status: 'done', timeline: { steps: [
        { stepId: 'p1', label: 'Analyzing your request', status: 'ok', durationMs: 29 },
        { stepId: 'p2', label: 'Loading tools', status: 'ok', durationMs: 376 },
        { stepId: 't1', label: 'Searching the web', status: 'ok', planStepId: 'op_1', tool: 'WEB_SEARCH' },
      ] } },
    ]
    const w = mountRail(snap([{ step_id: 'op_1', title: 'Search Python release', status: 'completed', status_user: 'completed' }]))
    const nodes = w.findAll('.node').map((n) => n.attributes('data-test'))
    expect(nodes.indexOf('rt-prepare')).toBeLessThan(nodes.indexOf('rt-step-op_1'))
    const prep = w.find('[data-test="rt-prepare"]')
    expect(prep.text()).toContain('Analyzing your request')
    expect(prep.text()).toContain('Loading tools')
    expect(prep.text()).not.toContain('Searching the web')
    expect(w.find('[data-test="rt-step-op_1"]').text()).toContain('Searching the web')
    expect(w.text()).not.toContain('WEB_SEARCH')
  })

  it('the running step is open and streams the model’s reasoning inside it', () => {
    chat.messages = [
      { id: 'u1', role: 'user', content: 'go' },
      { id: 'a1', role: 'assistant', content: '', runId: RUN, status: 'streaming' },
    ]
    chat.liveSteps.splice(0, chat.liveSteps.length,
      { stepId: 'r1', phase: 'reasoning', label: 'Thinking', status: 'running', planStepId: 'op_1',
        reasoningText: 'The LTS line is 22.x, so check the release page' })
    const w = mountRail(snap([{ step_id: 'op_1', title: 'Search Node.js LTS', status: 'in_progress', status_user: 'in_progress' }]))
    const step = w.find('[data-test="rt-step-op_1"]')
    expect(step.attributes('data-open')).toBe('true')
    const think = step.find('[data-test="rt-reasoning-r1"]')
    expect(think.exists()).toBe(true)
    expect(think.text()).toContain('The LTS line is 22.x')
  })

  it('a step not yet run describes what it can use in words', () => {
    chat.messages = []
    const w = mountRail(snap([{ step_id: 'op_2', title: 'Search PostgreSQL', status: 'pending', status_user: 'pending',
      tool_hints: ['CREATE_DOCUMENT', 'FETCH_PAGE', 'WEB_SEARCH'],
      tool_labels: ['Writing a document', 'Reading a web page', 'Searching the web'] }]))
    const uses = w.find('[data-test="rt-uses-op_2"]')
    expect(uses.text()).toBe('Can use: Writing a document · Reading a web page · Searching the web')
    expect(w.text()).not.toMatch(/CREATE_DOCUMENT|FETCH_PAGE|WEB_SEARCH/)
  })

  it('a step that already ran never lists what it could have used (conv 1588)', () => {
    chat.messages = []
    const w = mountRail(snap([{ step_id: 'op_3', title: 'Generate coriander powder', status: 'completed',
      status_user: 'completed', tool_labels: ['Running a script', 'Reading a web page'] }]))
    expect(w.find('[data-test="rt-uses-op_3"]').exists()).toBe(false)
    expect(w.find('[data-test="rt-toggle-op_3"]').exists()).toBe(false)
  })

  it('a status row restating the step it sits in is not repeated inside it', () => {
    chat.messages = [
      { id: 'u1', role: 'user', content: 'go' },
      { id: 'a1', role: 'assistant', content: 'x', runId: RUN, status: 'done', timeline: { steps: [
        { stepId: 'p', isPhase: true, label: 'Step 2 of 4: Generate red chilli powder', status: 'ok', planStepId: 'op_2' },
        { stepId: 't', label: 'Generating an image', status: 'ok', planStepId: 'op_2' },
      ] } },
    ]
    const w = mountRail(snap([{ step_id: 'op_2', title: 'Generate red chilli powder', status: 'completed', status_user: 'completed' }]))
    const step = w.find('[data-test="rt-step-op_2"]')
    expect(step.text()).not.toContain('Step 2 of 4')
    expect(step.text()).toContain('Generating an image')
  })
})

describe('RunTimeline — parallel steps run side by side, each with its own result', () => {
  let store, chat
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useRunTimeline()
    chat = useChatStore()
  })

  const IMG = ['Turmeric', 'Chilli', 'Coriander', 'Pepper']

  it('four steps in progress together, each showing the image its own call produced', () => {
    chat.messages = [
      { id: 'u1', role: 'user', content: 'make 4 images' },
      { id: 'a1', role: 'assistant', content: '', runId: RUN, status: 'streaming' },
    ]
    chat.liveSteps.splice(0, chat.liveSteps.length, ...IMG.map((n, i) => ({
      stepId: `step_c${i}`, toolCallId: `c${i}`, planStepId: `op_${i + 1}`, label: 'Generating an image',
      status: i < 2 ? 'ok' : 'running',
      media: i < 2 ? [{ url: `/media/${n}.png`, type: 'image' }] : [],
    })))
    const s = {
      run_id: RUN, run_status: 'executing',
      steps: IMG.map((n, i) => ({ step_id: `op_${i + 1}`, title: `Generate ${n}`,
        status: i < 2 ? 'completed' : 'in_progress', status_user: i < 2 ? 'completed' : 'in_progress' })),
      work_goal: { state: 'ACTIVE', verdicts: [], available_actions: [] },
    }
    store.ingestSnapshot(RUN, s)
    const w = mount(RunTimeline, { props: { runId: RUN, goal: s.work_goal }, global: { stubs: { SourcesList: true } } })
    expect(w.findAll('.node[data-state="active"][data-test^="rt-step-"]')).toHaveLength(2)
    for (let i = 0; i < 4; i++) {
      const step = w.find(`[data-test="rt-step-op_${i + 1}"]`)
      expect(step.attributes('data-open')).toBe('true')
      expect(step.text()).toContain('Generating an image')
      const imgs = step.findAll('img')
      expect(imgs.map((x) => x.attributes('src'))).toEqual(i < 2 ? [`/media/${IMG[i]}.png`] : [])
    }
    // No answer yet: the final response comes after the steps, not while they run.
    expect(w.findAll('[data-test^="rt-answer-"]')).toHaveLength(0)
  })

  it('once the run ends every step folds back to its title, leaving the final answer open', async () => {
    chat.messages = [
      { id: 'u1', role: 'user', content: 'make 4 images' },
      { id: 'a1', role: 'assistant', content: 'All 4 images are ready.', runId: RUN, status: 'done',
        timeline: { steps: IMG.map((n, i) => ({ stepId: `s${i}`, planStepId: `op_${i + 1}`, label: 'Generating an image',
          status: 'ok', media: [{ url: `/media/${n}.png`, type: 'image' }] })).concat(
          [{ stepId: 'p', label: 'Analyzing your request', status: 'ok' }]) } },
    ]
    const running = {
      run_id: RUN, run_status: 'executing',
      steps: IMG.map((n, i) => ({ step_id: `op_${i + 1}`, title: `Generate ${n}`, status: 'in_progress', status_user: 'in_progress' })),
      work_goal: { state: 'ACTIVE', verdicts: [], available_actions: [] },
    }
    store.ingestSnapshot(RUN, running)
    const w = mount(RunTimeline, { props: { runId: RUN, goal: running.work_goal }, global: { stubs: { SourcesList: true } } })
    expect(w.find('[data-test="rt-step-op_2"]').attributes('data-open')).toBe('true')
    const ended = { ...running, run_status: 'completed',
      steps: running.steps.map((x) => ({ ...x, status: 'completed', status_user: 'completed' })),
      work_goal: { ...running.work_goal, state: 'ACHIEVED' } }
    store.ingestSnapshot(RUN, ended)
    await w.setProps({ goal: ended.work_goal })
    for (let i = 1; i <= 4; i++) expect(w.find(`[data-test="rt-step-op_${i}"]`).attributes('data-open')).toBe('false')
    expect(w.find('[data-test="rt-answer-a1"]').text()).toContain('All 4 images are ready.')
    // Still one click away.
    await w.find('[data-test="rt-toggle-op_3"]').trigger('click')
    expect(w.find('[data-test="rt-step-op_3"]').attributes('data-open')).toBe('true')
  })

  it('narration streamed while steps run is not drawn as the answer; the answer streams once they finish', async () => {
    chat.messages = [
      { id: 'u1', role: 'user', content: 'make 4 images' },
      { id: 'a1', role: 'assistant', content: 'I will generate the four images now.', runId: RUN, status: 'streaming' },
    ]
    const running = {
      run_id: RUN, run_status: 'executing',
      steps: [{ step_id: 'op_1', title: 'Generate Turmeric', status: 'in_progress', status_user: 'in_progress' }],
      work_goal: { state: 'ACTIVE', verdicts: [], available_actions: [] },
    }
    store.ingestSnapshot(RUN, running)
    const w = mount(RunTimeline, { props: { runId: RUN, goal: running.work_goal }, global: { stubs: { SourcesList: true } } })
    expect(w.find('[data-test="rt-answer-a1"]').exists()).toBe(false)
    store.ingestSnapshot(RUN, { ...running, steps: [{ ...running.steps[0], status: 'completed', status_user: 'completed' }] })
    chat.messages[1].content = 'All 4 images are ready.'
    await w.vm.$nextTick()
    expect(w.find('[data-test="rt-answer-a1"]').text()).toContain('All 4 images are ready.')
  })
})

describe('RunTimeline — a goal check with the next attempt running is alive, not an ending', () => {
  let store, chat
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline(); chat = useChatStore() })

  const snap = (state, runStatus) => ({
    run_id: RUN, run_status: runStatus,
    steps: [{ step_id: 'op_1', title: 'Find versions', status: 'in_progress', status_user: 'in_progress' }],
    work_goal: { state, available_actions: [],
      verdicts: [{ segment: 1, verdict: 'not_met', findings: [{ observation: 'Node.js date missing' }] }] },
  })

  it('pulses and shows attempt 2 starting beneath it (conv 1599)', () => {
    chat.messages = [
      { id: 'u1', role: 'user', content: 'research' },
      { id: 'a1', role: 'assistant', content: 'first answer', runId: RUN, status: 'done', workIteration: { segment: 1 } },
      { id: 'a2', role: 'assistant', content: '', runId: RUN, status: 'streaming', workIteration: { segment: 2 } },
    ]
    chat.liveSteps.splice(0, chat.liveSteps.length,
      { stepId: 's1', isPhase: true, label: 'Step 1 of 3: Find versions', status: 'ok' },
      { stepId: 's2', label: 'Reading a web page', status: 'running' })
    const s = snap('ACTIVE', 'executing')
    store.ingestSnapshot(RUN, s)
    const w = mount(RunTimeline, { props: { runId: RUN, goal: s.work_goal }, global: { stubs: { SourcesList: true } } })
    const v = w.find('[data-test="rt-verdict-verdict_s1"]')
    expect(v.attributes('data-live')).toBe('true')
    const live = w.find('[data-test="rt-retry-live-verdict_s1"]')
    expect(live.text()).toContain('Attempt 2 is running')
    expect(live.text()).toContain('Reading a web page')
    expect(live.text()).not.toContain('Step 1 of 3')
  })

  it('is still once the run has ended', () => {
    chat.messages = [{ id: 'a1', role: 'assistant', content: 'answer', runId: RUN, status: 'done' }]
    const s = snap('EXHAUSTED', 'paused')
    store.ingestSnapshot(RUN, s)
    const w = mount(RunTimeline, { props: { runId: RUN, goal: s.work_goal }, global: { stubs: { SourcesList: true } } })
    expect(w.find('[data-test="rt-verdict-verdict_s1"]').attributes('data-live')).toBe('false')
    expect(w.find('[data-test="rt-retry-live-verdict_s1"]').exists()).toBe(false)
  })
})
