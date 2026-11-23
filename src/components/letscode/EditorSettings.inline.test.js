// @vitest-environment jsdom
// Inline suggestions in Editor settings (ADM-1316): off by default, turned on by the person, a daily limit they can
// change; read from and saved to the server (which enforces both), with today's spend and the model's name.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({ getInlineCompletionSettings: vi.fn(), saveInlineCompletionSettings: vi.fn() }))
vi.mock('@/services/inlineEditorApi', () => ({ default: api }))

import EditorSettings from './EditorSettings.vue'
import { _resetInlineSuggestions, stopInlineSuggestions, useInlineSuggestions } from '@/composables/useInlineSuggestions'

const SETTING = { enabled: false, daily_limit_usd: '1.00', spent_today_usd: '0.0042', resets_at: '2026-11-24T00:00:00+00:00',
  model: { name: 'Codestral 2508' } }

let w
async function open() {
  w = mount(EditorSettings, { props: { open: true, anchor: null }, attachTo: document.body, global: { stubs: { Icon: true } } })
  await flushPromises()
}
const $ = (sel) => document.querySelector(sel)

beforeEach(() => {
  _resetInlineSuggestions()
  api.getInlineCompletionSettings.mockResolvedValue({ data: { ...SETTING } })
  api.saveInlineCompletionSettings.mockImplementation(async (body) => ({ data: { ...SETTING, ...body,
    daily_limit_usd: body.daily_limit_usd ? Number(body.daily_limit_usd).toFixed(2) : SETTING.daily_limit_usd } }))
})
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })

describe('inline suggestions in Editor settings', () => {
  it('reads the setting from the server: off, $1.00 a day, today\'s spend and the model', async () => {
    await open()
    expect(api.getInlineCompletionSettings).toHaveBeenCalled()
    expect($('[data-test="es-inline-enabled"]').checked).toBe(false)
    expect($('[data-test="es-inline-limit"]').value).toBe('1.00')
    const note = $('#es-ic-note').textContent
    expect(note).toContain('Paid from your balance')
    expect(note).toContain('Usage')
    expect(note).toContain('under $0.01 of $1.00')
    expect(note).toContain('Codestral 2508')
    expect(note).not.toMatch(/credit/i)
  })

  it('turning it on saves it on the server and clears a stop', async () => {
    await open()
    stopInlineSuggestions('model_failed', 'The suggestion model failed.')
    const box = $('[data-test="es-inline-enabled"]')
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(api.saveInlineCompletionSettings).toHaveBeenCalledWith({ enabled: true })
    const { state } = useInlineSuggestions()
    expect(state.enabled).toBe(true)
    expect(state.stopped).toBeNull()
  })

  it('a new daily limit is saved on Enter; a refused one is said and put back', async () => {
    await open()
    const input = $('[data-test="es-inline-limit"]')
    input.value = '$2.5'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect(api.saveInlineCompletionSettings).toHaveBeenCalledWith({ daily_limit_usd: '2.5' })
    expect(input.value).toBe('2.50')

    api.saveInlineCompletionSettings.mockRejectedValueOnce({ response: { status: 400,
      data: { error: 'The daily limit must be between $0.10 and $100.00.', code: 'invalid' } } })
    input.value = '500'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await flushPromises()
    expect($('.es-error').textContent).toContain('between $0.10 and $100.00')
    expect($('.es-error').getAttribute('role')).toBe('alert')
    expect(input.value).toBe('2.50')
  })

  it('every control has a label', async () => {
    await open()
    expect($('[data-test="es-inline-enabled"]').closest('label').textContent).toContain('Suggest code as I type')
    expect(document.querySelector('label[for="es-ic-limit"]').textContent).toContain('Daily limit')
    expect($('[data-test="es-inline"] legend').textContent).toBe('Inline suggestions')
  })
})
