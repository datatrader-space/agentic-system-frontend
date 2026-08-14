import { describe, expect, it } from 'vitest'
import { stripThinkBlocks, ThinkStreamFilter } from './thinkFilter'

describe('stripThinkBlocks', () => {
  it('removes complete and unclosed private reasoning', () => {
    expect(stripThinkBlocks('<think>secret</think>Hello')).toBe('Hello')
    expect(stripThinkBlocks('Answer<think>unfinished')).toBe('Answer')
  })

  it('preserves ordinary angle-bracket text', () => {
    expect(stripThinkBlocks('Use <div> and compare a < b')).toBe('Use <div> and compare a < b')
  })
})

describe('ThinkStreamFilter', () => {
  it('suppresses tags and reasoning split across chunks', () => {
    const filter = new ThinkStreamFilter()
    const chunks = ['<thi', 'nk>private ', 'reasoning</thi', 'nk>Hi there']
    expect(chunks.map((chunk) => filter.feed(chunk)).join('') + filter.flush()).toBe('Hi there')
  })

  it('never flushes an unclosed reasoning block', () => {
    const filter = new ThinkStreamFilter()
    expect(filter.feed('Visible<think>private')).toBe('Visible')
    expect(filter.flush()).toBe('')
  })
})
