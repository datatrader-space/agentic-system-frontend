// @vitest-environment jsdom
//
// An INLINE card sits in its page's flow, never as a fixed overlay (release check S-02, 2026-11-23).
//
// On the Sessions page "Answer" opened the question card inside a row that uses `content-visibility: auto`; the
// card kept the full-screen fixed overlay, the row's containment clipped it, and only "Cancel this step" showed.
// The inline layout now lives in HITLModal itself, after the docked (compact) rules, so every inline host gets it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HITLModal from './HITLModal.vue'

const sfc = readFileSync(resolve(__dirname, 'HITLModal.vue'), 'utf8')
const style = sfc.slice(sfc.indexOf('<style'))

const question = {
  id: 'q1', interaction_type: 'question', response_type: 'choice', urgency: 'medium', status: 'pending',
  summary: 'Which season is your favourite?', options: [{ label: 'Spring' }, { label: 'Summer' }],
  payload: {}, metadata: {},
}

describe('HITLModal inline', () => {
  it('renders in place, not teleported to the body, with the inline class', () => {
    setActivePinia(createPinia())
    const host = document.createElement('div')
    document.body.appendChild(host)
    const w = mount(HITLModal, { attachTo: host, props: { inline: true, requests: [question] } })
    const overlay = host.querySelector('.hitl-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay.classList.contains('hitl-overlay--inline')).toBe(true)
    w.unmount()
    host.remove()
  })

  it('has its own static layout, placed after the docked rules so it wins over them', () => {
    const inline = style.indexOf('.hitl-overlay--inline {')
    const compact = style.indexOf('.hitl-overlay--compact {')
    expect(inline).toBeGreaterThan(-1)
    expect(compact).toBeGreaterThan(-1)
    expect(inline).toBeGreaterThan(compact)
    const rule = style.slice(inline, style.indexOf('}', inline))
    expect(rule).toMatch(/position:\s*static/)
    expect(rule).toMatch(/pointer-events:\s*auto/)
    expect(rule).toMatch(/padding:\s*0/)
  })
})

describe('HITLModal — one question is shown once', () => {
  const ask = (questions, summary) => ({
    id: 'a1', interaction_type: 'question', response_type: 'text', urgency: 'medium', status: 'pending', summary,
    payload: { kind: 'ask_user', questions }, metadata: {},
  })
  const q = (question) => ({ question, header: 'Location', options: [{ label: 'City', description: '' }, { label: 'Region', description: '' }] })

  it('drops the summary when it only repeats the single question', () => {
    setActivePinia(createPinia())
    const w = mount(HITLModal, { props: { inline: true, requests: [ask([q('Which city?')], 'Which city?')] } })
    expect(w.find('.summary').exists()).toBe(false)
    expect((w.text().match(/Which city\?/g) || []).length).toBe(1)
  })

  it('keeps the summary for several questions', () => {
    setActivePinia(createPinia())
    const w = mount(HITLModal, { props: { inline: true, requests: [ask([q('Which city?'), q('Which region?')], 'The agent has 2 questions for you')] } })
    expect(w.find('.summary').text()).toBe('The agent has 2 questions for you')
  })
})
