// @vitest-environment jsdom
//
// The run rail lists the sites the run is reading, while it reads them (prod conv 1738). A 10m45s
// research run that read 17 pages showed one row — "Got ready" — and the user asked whether it was
// stuck. The pages are fetched by delegated children on worker threads, so they now arrive as
// source_citation frames (agent/services/research_progress.py) and land here.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { getAgents: vi.fn(() => Promise.resolve({ data: [] })), startAgentChat: vi.fn() },
}))

import RunTimeline from './RunTimeline.vue'
import { useChatStore } from '../../stores/useChatStore'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const readComponentSource = () =>
  readFileSync(resolve(process.cwd(), 'src/components/plan/RunTimeline.vue'), 'utf8')

const RUN = 'run-1'

const mountRT = (props = {}) =>
  mount(RunTimeline, { props: { runId: RUN, nodes: [], ...props }, global: { stubs: { FileViewer: true } } })

const src = (name, ref) => ({ kind: 'web_page', name, ref })

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('RunTimeline — sources read', () => {
  it('says nothing until a page has been read', () => {
    expect(mountRT().find('[data-test="rt-sources"]').exists()).toBe(false)
  })

  it('lists each page with the site it came from and a link to it', async () => {
    const chat = useChatStore()
    chat.messages = [{
      id: 1, role: 'assistant', status: 'done', runId: RUN,
      timeline: { sources: [src('Download Python', 'https://www.python.org/downloads/')] },
    }]
    const w = mountRT()
    await w.vm.$nextTick()
    const panel = w.find('[data-test="rt-sources"]')
    expect(panel.exists()).toBe(true)
    expect(panel.text()).toContain('1 source')
    const row = w.find('[data-test="rt-source"]')
    expect(row.text()).toContain('python.org')
    expect(row.text()).toContain('Download Python')
    expect(row.find('a').attributes('href')).toBe('https://www.python.org/downloads/')
    expect(row.find('a').attributes('rel')).toContain('noopener')
  })

  it('the same page read by three sub-questions is one source, not three', async () => {
    const chat = useChatStore()
    const s = src('Node v26.9.0', 'https://nodejs.org/en/blog/release/v26.9.0/')
    chat.messages = [
      { id: 1, role: 'assistant', status: 'done', runId: RUN, timeline: { sources: [s] } },
      { id: 2, role: 'assistant', status: 'done', runId: RUN, timeline: { sources: [s, s] } },
    ]
    const w = mountRT()
    await w.vm.$nextTick()
    expect(w.find('[data-test="rt-sources"]').text()).toContain('1 source')
    expect(w.findAll('[data-test="rt-source"]')).toHaveLength(1)
  })

  it('shows the first six and opens the rest on demand', async () => {
    const chat = useChatStore()
    const many = Array.from({ length: 9 }, (_, i) => src(`Page ${i}`, `https://example${i}.com/a`))
    chat.messages = [{ id: 1, role: 'assistant', status: 'done', runId: RUN, timeline: { sources: many } }]
    const w = mountRT()
    await w.vm.$nextTick()
    expect(w.find('[data-test="rt-sources"]').text()).toContain('9 sources')
    expect(w.findAll('[data-test="rt-source"]')).toHaveLength(6)
    await w.find('[data-test="rt-sources-more"]').trigger('click')
    expect(w.findAll('[data-test="rt-source"]')).toHaveLength(9)
  })

  it('live citations follow the RUN, not a streaming bubble', async () => {
    // Keyed on a message with status === 'streaming', the panel was blank for the whole of a
    // fan-out: RESEARCH_IN_PARALLEL runs for minutes between model rounds and there is no
    // streaming message in that window, so a run that read nine pages through its children showed
    // none of them (live, conv 1760). A source pin, because the live half cannot be seeded from
    // outside the timeline composable.
    const text = readComponentSource()
    expect(text).toContain('if (!terminal.value) for (const x of (chat.liveSources')
    expect(text).not.toContain("m.status === 'streaming' && belongsToThisRun(m))")
  })

  it('a source with no URL still renders, without a dead link', async () => {
    const chat = useChatStore()
    chat.messages = [{
      id: 1, role: 'assistant', status: 'done', runId: RUN,
      timeline: { sources: [{ kind: 'knowledge_base', name: 'Pricing deck' }] },
    }]
    const w = mountRT()
    await w.vm.$nextTick()
    const row = w.find('[data-test="rt-source"]')
    expect(row.text()).toContain('Pricing deck')
    expect(row.text()).toContain('knowledge_base')
    expect(row.find('a').exists()).toBe(false)
  })

  it('another run\'s sources are not this run\'s', async () => {
    const chat = useChatStore()
    chat.messages = [{
      id: 1, role: 'assistant', status: 'done', runId: 'some-other-run',
      timeline: { sources: [src('Elsewhere', 'https://elsewhere.test/a')] },
    }]
    const w = mountRT()
    await w.vm.$nextTick()
    expect(w.find('[data-test="rt-sources"]').exists()).toBe(false)
  })
})
