// ADM-1302 — the Work timeline's rows and how a tool row reads (pure).
import { describe, it, expect } from 'vitest'
import {
  workRows, toolDescription, toolName, ioText, outputText, diffLines, dotState, thoughtLabel, subagentChildren, compactIo,
  needsLoad, stripBase64, elapsedText, INLINE_IO_CHARS, PREVIEW_LINES,
} from './workRail'

const B64 = 'QUJD'.repeat(80)
const phase = (id, label) => ({ stepId: id, isPhase: true, phase: 'thinking', label, status: 'ok' })
const text = (id, t) => ({ stepId: id, isText: true, phase: 'text', text: t, status: 'ok' })
const tool = (id, over = {}) => ({ stepId: id, toolCallId: id, tool: 'CODE_READ_FILE', label: 'Reading a file', status: 'ok', ...over })

describe('workRows — every row in the order it happened', () => {
  const steps = [
    phase('p1', 'Getting ready'),
    { stepId: 'r1', phase: 'reasoning', isPhase: true, reasoningText: 'look first', status: 'ok', durationMs: 2100 },
    text('t1', 'I will read the file first.'),
    phase('p2', 'Generating response'),
    tool('c1', { input: { path: 'a.py' } }),
    { stepId: 's1', isSteer: true, label: 'also b.py', status: 'ok' },
    text('t2', 'Now the answer.'),
  ]

  it('narration sits between the tool rows, status phases are not rows', () => {
    expect(workRows(steps).map((r) => r.kind)).toEqual(['thought', 'text', 'tool', 'steer', 'text'])
  })

  it('once the turn has its answer, the answer is the last row in place of the round it is', () => {
    expect(workRows(steps, { finished: true, hasAnswer: true }).map((r) => r.kind))
      .toEqual(['thought', 'text', 'tool', 'steer', 'answer'])
  })

  it('a round that ended in tool calls stays narration; the answer comes after the last call', () => {
    const s = [text('t1', 'reading'), tool('c1')]
    expect(workRows(s, { finished: true, hasAnswer: true }).map((r) => r.kind)).toEqual(['text', 'tool', 'answer'])
  })

  it('a turn with no answer (an error) keeps its text and gets no answer row', () => {
    expect(workRows([text('t1', 'x'), tool('c1')], { finished: true, hasAnswer: false }).map((r) => r.kind))
      .toEqual(['text', 'tool'])
  })

  it('a subagent and a compaction are rows of their own; a plan step saved before 2026-11-19 is not drawn', () => {
    // A plan is reviewed on its card and followed on the task list (PLAN_REVIEW_LIKE_CLAUDE_PLAN.md).
    const s = [{ stepId: 'pl', isPlan: true, planId: 'P' }, tool('a', { tool: 'AGENT' }),
      { stepId: 'k', isCompaction: true, label: 'Earlier conversation summarized' }, { stepId: 'pl2', isPlan: true, planId: 'Q' }]
    expect(workRows(s).map((r) => r.kind)).toEqual(['subagent', 'compaction'])
  })
})

describe('a tool row', () => {
  it('reads its name and the one line of what it did', () => {
    // The bold name is the server's short name (`title`), never the raw tool name.
    expect(toolName(tool('c1', { title: 'Read' }))).toBe('Read')
    expect(toolName(tool('c1'))).toBe('Tool')
    expect(toolDescription(tool('c1', { input: { path: 'src/app.py' } }))).toBe('src/app.py')
    expect(toolDescription(tool('c1', { input: { command: 'npm   test\n --watch' } }))).toBe('npm test --watch')
    expect(toolDescription(tool('c1', { input: null }))).toBe('Reading a file')
    expect(toolDescription(tool('a', { tool: 'AGENT', input: { subagent_type: 'Explore', prompt: 'find the bug' } })))
      .toBe('Explore: find the bug')
  })

  it('prints IN and OUT whole, JSON line by line, base64 as <base64>', () => {
    const long = 'x '.repeat(20000)
    expect(ioText(long)).toBe(long)                                  // never cut
    expect(ioText('{"a":1,"b":[2]}')).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}')
    expect(ioText({ path: 'a.py' })).toBe('{\n  "path": "a.py"\n}')
    expect(ioText(`img ${B64} end`)).toBe('img <base64> end')
    expect(stripBase64(`data:image/png;base64,${B64}`)).toBe('<base64>')
  })

  it('shows a file edit as its diff', () => {
    const patch = tool('c1', { tool: 'CODE_PATCH_FILE', input: { path: 'a.py', edits: [{ find: 'x = 1', replace: 'x = 2\ny = 3' }] } })
    expect(diffLines(patch)).toEqual([{ sign: '-', text: 'x = 1' }, { sign: '+', text: 'x = 2' }, { sign: '+', text: 'y = 3' }])
    const ap = tool('c2', { tool: 'CODE_APPLY_PATCH', input: { patch: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n same' } })
    expect(diffLines(ap).map((d) => d.sign)).toEqual(['@', '@', '@', '-', '+', ' '])
    expect(diffLines(tool('c3', { input: { path: 'a.py' } }))).toEqual([])
  })

  it('its dot says how it went', () => {
    expect(['running', 'ok', 'failed', 'held', 'interrupted', 'waiting'].map((s) => dotState({ status: s })))
      .toEqual(['running', 'done', 'failed', 'notrun', 'notrun', 'waiting'])
    expect(thoughtLabel({ status: 'ok', durationMs: 4200 })).toBe('Thought for 4.2s')
    expect(thoughtLabel({ status: 'running' })).toBe('Thinking')
  })

  it('a subagent nests the tools it used', () => {
    const row = tool('a', { tool: 'AGENT', usedTitles: ['Search', 'Read'],
      output: JSON.stringify({ tools_used: ['CODE_GREP', { name: 'CODE_READ_FILE', ok: false }] }) })
    expect(subagentChildren(row).map((c) => [c.name, c.failed])).toEqual([['Search', false], ['Read', true]])
    // Without the server's names, never the raw ones.
    expect(subagentChildren({ ...row, usedTitles: undefined }).map((c) => c.name)).toEqual(['Tool', 'Tool'])
    expect(subagentChildren(tool('b'))).toEqual([])
  })
})

describe('the saved snapshot of a row', () => {
  it('keeps a short IN and OUT, and a long one as its ref and length', () => {
    const short = compactIo(tool('c1', { input: { path: 'a' }, output: 'ok', ioRef: 'step:1' }))
    expect(short.output).toBe('ok')
    const big = 'y'.repeat(INLINE_IO_CHARS + 1)
    const kept = compactIo(tool('c1', { input: { content: big }, output: big, ioRef: 'step:1' }))
    expect(kept.output).toBeUndefined()
    expect(kept.input).toBeUndefined()
    expect(kept.outputChars).toBe(big.length)
    expect(needsLoad(kept)).toBe(true)
  })

  it("a long one keeps its first lines as the closed row's preview (the whole loads by the ref)", () => {
    const NL = String.fromCharCode(10)
    const lines = Array.from({ length: 400 }, (_, i) => `line ${i} ${'z'.repeat(20)}`).join(NL)
    const kept = compactIo(tool('c1', { input: { command: 'npm test' }, output: lines, ioRef: 'step:1' }))
    expect(kept.output).toBeUndefined()
    expect(kept.outputHead.split(NL)).toEqual(lines.split(NL).slice(0, PREVIEW_LINES + 1))
  })

  it('a long one without a ref is kept whole (nothing to load it again from)', () => {
    const big = 'y'.repeat(INLINE_IO_CHARS * 3)
    expect(compactIo(tool('c1', { output: big })).output).toBe(big)
  })

  it('elapsed time reads like Claude Code\'s', () => {
    expect(elapsedText(12400)).toBe('12s')
    expect(elapsedText(65000)).toBe('1m 05s')
  })
})

describe('outputText: what a tool produced, not the model\'s header line (phase 8 live, 2026-11-19)', () => {
  const head = (o) => JSON.stringify(o)
  it('a command that succeeded shows what it printed, with no ids or handles', () => {
    const out = `${head({ ok: true, exit_code: 0, status: 'succeeded', handle: 'h1', lease_id: 'lease_1', risky: false })}\n--- stdout ---\nv25.9.0`
    expect(outputText(out)).toBe('v25.9.0')
    expect(outputText(out)).not.toContain('lease_')
  })
  it('a command that failed leads with its error and exit code', () => {
    const out = `${head({ ok: false, error: 'the command failed', exit_code: 2 })}\n--- stdout ---\nnpm ERR! missing script`
    expect(outputText(out)).toBe('the command failed\nExit code 2\nnpm ERR! missing script')
  })
  it('a command that printed nothing says so', () => {
    expect(outputText(head({ ok: true, exit_code: 0 }))).toBe('(No output)')
  })
  it('a result with no payload keeps its small fields', () => {
    expect(outputText(head({ ok: true, path: 'a.txt', bytes: 3 }))).toBe(ioText(head({ ok: true, path: 'a.txt', bytes: 3 })))
  })
  it('printed output that looks like a marker stays output', () => {
    const out = `${head({ ok: true, exit_code: 0 })}\n--- stdout ---\nline 1\n--- content ---\nline 2`
    expect(outputText(out)).toBe('line 1\n--- content ---\nline 2')        // content comes before stdout: not a section
  })
  it('two payloads are each named', () => {
    const out = `${head({ ok: true })}\n--- stdout ---\nbuilt\n--- logs ---\nwarn x`
    expect(outputText(out)).toBe('stdout:\nbuilt\n\nlogs:\nwarn x')
  })
  it('anything else reads as ioText does', () => {
    expect(outputText('plain words')).toBe('plain words')
    expect(outputText('{"a": 1}')).toBe(ioText('{"a": 1}'))
    expect(outputText({ a: 1 })).toBe(ioText({ a: 1 }))
  })
})
