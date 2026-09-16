// @vitest-environment jsdom
// A work run's report renders as a report, not as markdown source.
//
// PRODUCTION conv 1564 (2026-09-16): the rail interpolated each answer as text, so the whole point of the
// run — a sourced comparison of Nginx, Caddy and HAProxy — arrived as literal `**Caddy – final statement:**`,
// `## 3. Consolidated table` and `| Project | Version (per fetched source) |` rows, while the same text in an
// ordinary chat bubble rendered as headings, bold and a table.
//
// It now goes through the bubble's own renderer, which is also a security boundary, so that half is pinned
// too: answer text quotes web pages and tool output, and must never become live markup here.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import RunTimeline from './RunTimeline.vue'
import { useRunTimeline } from '../../stores/useRunTimeline'
import { useChatStore } from '../../stores/useChatStore'

const RUN = 'run_1564'
const SNAPSHOT = {
  run_status: 'paused',
  plan_status_label: 'Paused',
  steps: [{ step_id: 'op_1', title: 'Research versions and licences', status: 'completed', status_user: 'completed' }],
}

const REPORT = [
  '## 3. Consolidated table (Nginx & Caddy)',
  '',
  '**Caddy – final statement:**',
  '',
  '- **Latest release:** `v2.11.4` on https://github.com/caddyserver/caddy/releases',
  '- **License:** **Apache License 2.0**',
  '',
  '| Project | Version | License |',
  '|---------|---------|---------|',
  '| Nginx | `nginx-1.30.5` | Simplified 2-clause BSD-like |',
  '| Caddy | `v2.11.4` | Apache License 2.0 |',
].join('\n')

describe('RunTimeline — answers render as markdown', () => {
  let store
  beforeEach(() => { setActivePinia(createPinia()); store = useRunTimeline() })

  const railWith = (content) => {
    const chat = useChatStore()
    chat.messages = [{ id: 'm1', role: 'assistant', content, runId: RUN }]
    store.ingestSnapshot(RUN, SNAPSHOT)
    return mount(RunTimeline, { props: { runId: RUN } })
  }
  const md = (w) => w.find('[data-test="rt-answer-md-m1"]')

  it('renders headings, bold, lists, inline code and tables — not their source', () => {
    const el = md(railWith(REPORT))
    expect(el.exists()).toBe(true)
    expect(el.find('h2').text()).toContain('Consolidated table')
    expect(el.find('strong').text()).toContain('Caddy – final statement:')
    expect(el.findAll('li')).toHaveLength(2)
    expect(el.find('code').text()).toBe('v2.11.4')
    expect(el.find('table').exists()).toBe(true)
    expect(el.findAll('tbody tr')).toHaveLength(2)
    expect(el.text()).not.toContain('**')
    expect(el.text()).not.toContain('## ')
    expect(el.text()).not.toContain('|---------|')
  })

  it('keeps the words, so the answer reads the same', () => {
    const t = md(railWith(REPORT)).text()
    expect(t).toContain('Apache License 2.0')
    expect(t).toContain('nginx-1.30.5')
  })

  it('escapes raw HTML quoted from a page — it is shown, never executed', () => {
    const el = md(railWith('Found on the page: <img src=x onerror="alert(1)"> and <script>alert(2)</script>'))
    expect(el.find('img').exists()).toBe(false)
    expect(el.find('script').exists()).toBe(false)
    expect(el.text()).toContain('<img src=x onerror="alert(1)">')
  })

  it('neutralises a javascript: link', () => {
    const el = md(railWith('[click me](javascript:alert(1))'))
    const a = el.find('a')
    expect(a.exists() ? (a.attributes('href') || '') : '').not.toMatch(/^javascript:/i)
  })

  it('still collapses a JSON answer instead of rendering it as prose', () => {
    const w = railWith(JSON.stringify({ status: 'needs_review', issues: ['a'] }))
    expect(md(w).exists()).toBe(false)
    expect(w.find('[data-test="rt-answer-toggle-m1"]').exists()).toBe(true)
  })
})
