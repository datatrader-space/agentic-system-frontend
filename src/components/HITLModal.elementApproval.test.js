// @vitest-environment jsdom
//
// An Element the agent saved as a draft is approved IN THE CHAT, on the shared approval card (backend
// ADS_CHAT_FLOW_PLAN.md): the element, its files, the rights statement and basis choices, and for a real person the
// consent fields. Approve stays off until the statement is confirmed; the answer carries the person's own rights,
// which the server applies with the same approve() as the Elements page. Never "go to the Elements page".
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import HITLModal from './HITLModal.vue'

const RIGHTS = {
  statement: 'I confirm the basis I chose above.', statement_version: '2026-11-17',
  bases: [{ value: 'created', label: 'I created it' }, { value: 'owned', label: 'I own it' }],
}
const LIKENESS = { statement: 'I have the consent of the person shown.', statement_version: 'v1',
  bases: [{ value: 'self', label: 'This is me' }, { value: 'permission', label: 'I have their written permission' }] }

const card = (over = {}) => ({
  element_id: 'e1', name: 'Green Leaf', kind: 'brand', token: '@green_leaf', revision: 1, status: 'draft',
  files: [{ attachment_id: 'a1', media_type: 'image', title: 'logo', thumbnail_url: '/thumb/a1.png' }],
  needs_rights: true, rights_on_record: false, rights: RIGHTS,
  likeness: { ...LIKENESS, required: false, offered: false }, ...over,
})

const request = (c = card()) => ({
  request_id: 'r1', interaction_type: 'approval', response_type: 'binary', urgency: 'medium',
  summary: 'Approve running the tool “MANAGE_ELEMENT”?',
  payload: { kind: 'tool_approval', tool_name: 'MANAGE_ELEMENT', tool_label: 'Approving an element',
             session_approval: false, person_only: true,
             held_because: "only you can confirm your rights to 'Green Leaf' (a brand) before it is used",
             element_approval: c },
  timeout_at: new Date(Date.now() + 10 * 60_000).toISOString(),
})

const mountCard = (req = request(), props = {}) => mount(HITLModal, {
  props: { requests: [req], inline: true, ...props },
  global: { stubs: { teleport: true, transition: false } },
})

describe('an element approval card in the chat', () => {
  it('shows the element, its file and the rights statement, and no trip to another page', () => {
    const w = mountCard()
    const el = w.get('[data-test="element-approval"]')
    expect(el.text()).toContain('Green Leaf')
    expect(el.text()).toContain('Brand')
    expect(el.get('img').attributes('src')).toBe('/thumb/a1.png')
    expect(el.text()).toContain(RIGHTS.statement)
    expect(el.text()).toContain('I own it')
    expect(w.text()).not.toMatch(/Elements page/)
    // The plain Approve / Decline pair, the redirect field and "Always allow" are not offered on this card.
    expect(w.find('[data-test="hitl-approve"]').exists()).toBe(false)
    expect(w.find('[data-test="hitl-allow-session"]').exists()).toBe(false)
    expect(w.find('.instruction-input').exists()).toBe(false)
  })

  it('keeps Approve off until the basis is chosen and the statement confirmed, then sends the person\'s rights', async () => {
    const w = mountCard()
    const approve = w.get('[data-test="element-approve"]')
    expect(approve.attributes('disabled')).toBeDefined()
    expect(w.get('[data-test="element-approval-needs"]').text()).toMatch(/confirm the statement/)
    await w.get('[data-test="ea-basis-owned"]').setValue(true)
    expect(approve.attributes('disabled')).toBeDefined()
    await w.get('[data-test="ea-rights-confirm"]').setValue(true)
    expect(approve.attributes('disabled')).toBeUndefined()
    await approve.trigger('click')
    const [event] = w.emitted('respond').at(-1)
    expect(event.request_id).toBe('r1')
    expect(event.response_value).toEqual({ approved: true, rights: { basis: 'owned', confirmed: true } })
  })

  it('a real person in a character asks for their consent too', async () => {
    const w = mountCard(request(card({ kind: 'character', name: 'Nova', likeness: { ...LIKENESS, required: false, offered: true } })))
    await w.get('[data-test="ea-basis-created"]').setValue(true)
    await w.get('[data-test="ea-rights-confirm"]').setValue(true)
    await w.get('[data-test="ea-real-person"]').setValue(true)
    const approve = w.get('[data-test="element-approve"]')
    expect(approve.attributes('disabled')).toBeDefined()               // the consent fields are not filled yet
    await w.get('[data-test="ea-subject"]').setValue('Nova Lee')
    await w.find('input[value="self"]').setValue(true)
    await w.get('[data-test="ea-consent-confirm"]').setValue(true)
    await approve.trigger('click')
    const [event] = w.emitted('respond').at(-1)
    expect(event.response_value).toEqual({ approved: true, rights: { basis: 'created', confirmed: true },
      likeness: { real_person: true, subject_name: 'Nova Lee', basis: 'self', confirmed: true } })
  })

  it('Not now declines, and a refused approval shows the server\'s reason', async () => {
    const w = mountCard(request(card({ error: 'Choose the basis of your rights.' })))
    expect(w.get('[data-test="element-approval-error"]').text()).toBe('Choose the basis of your rights.')
    expect(w.get('[data-test="element-approval-error"]').attributes('role')).toBe('alert')
    await w.get('[data-test="element-decline"]').trigger('click')
    expect(w.emitted('respond').at(-1)[0].response_value).toBe(false)
  })

  it('an ordinary tool approval keeps its own buttons', () => {
    const plain = request()
    delete plain.payload.element_approval
    const w = mountCard(plain)
    expect(w.find('[data-test="element-approval"]').exists()).toBe(false)
    expect(w.get('[data-test="hitl-approve"]').text()).toBe('Approve')
  })
})
