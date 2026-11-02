// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WelcomeModal from './WelcomeModal.vue'

// The starting credit is Gmail only, after the email is verified (owner, 2026-11-02): the welcome promises it only
// when the wallet API says this person gets it, and never "$1 to start" to everyone.
describe('WelcomeModal — the starting credit line', () => {
  const step = (note) => {
    const w = mount(WelcomeModal, { props: { show: true, creditNote: note }, attachTo: document.body })
    const text = document.body.querySelector('.wm-steps li')?.textContent || ''
    w.unmount()
    return text.replace(/\s+/g, ' ').trim()
  }

  it('says when a Gmail address gets it', () => {
    expect(step('$1 after you verify your email'))
      .toBe('1 Your balance pays for what you use ($1 after you verify your email)')
  })

  it('names no credit for an address that gets none', () => {
    expect(step('')).toBe('1 Your balance pays for what you use')
  })
})
