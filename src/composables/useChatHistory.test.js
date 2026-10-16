import { describe, expect, it } from 'vitest'
import { plainText, previewOf } from './useChatHistory'

describe('chat list preview', () => {
  it('shows an answer that starts in markdown as plain words', () => {
    const s = { last_message: { content: '- **Chat with Platform Super Agent** — ID: **2839**\n\nPINEAPPLE' } }
    expect(previewOf(s)).toBe('Chat with Platform Super Agent — ID: 2839 PINEAPPLE')
  })

  it('strips headings, links, code and emphasis', () => {
    expect(plainText('## Plan\n1. Read [the docs](https://x.test) and run `make` _now_ ~~later~~'))
      .toBe('Plan Read the docs and run make now later')
  })

  it('keeps ordinary text, including snake_case words and arithmetic', () => {
    expect(plainText('2 * 3 = 6 and my_var_name stays')).toBe('2 * 3 = 6 and my_var_name stays')
  })

  it('still summarizes a JSON answer', () => {
    expect(previewOf({ last_message: { content: '{"summary":"Done"}' } })).toBe('Done')
  })
})
