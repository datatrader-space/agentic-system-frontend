/**
 * The line a returning user reads while a turn runs somewhere they cannot see.
 *
 * The bar every case here is held to: it must distinguish a working run from a stuck one. "Reconnected —
 * the agent is still working…" satisfied neither, which is what made conversation 1319 unreadable.
 */
import { describe, it, expect } from 'vitest'
import { resumeStatusLine, formatElapsed, RESUME_FALLBACK } from './resumeStatus'

describe('formatElapsed', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [60, '1m'],
    [245, '4m'],
    [3600, '1h'],
    [3700, '1h 1m'],
  ])('%is → %s', (secs, expected) => {
    expect(formatElapsed(secs)).toBe(expected)
  })

  it('never renders a negative or non-numeric elapsed', () => {
    expect(formatElapsed(-10)).toBe('0s')
    expect(formatElapsed(undefined)).toBe('0s')
    expect(formatElapsed('abc')).toBe('0s')
  })
})

describe('resumeStatusLine', () => {
  it('uses the run\'s own label and appends elapsed time', () => {
    expect(resumeStatusLine({ label: 'Step 2 of 3: add products', step: 2, total: 3, elapsed_seconds: 245 }))
      .toBe('Step 2 of 3: add products · 4m')
  })

  it('does not stutter the step when the label already carries one', () => {
    // The backend writes "Step 2 of 3: …" into the label itself, so prefixing would read
    // "Step 2 of 3: Step 2 of 3: …".
    const out = resumeStatusLine({ label: 'Step 2 of 3: add products', step: 2, total: 3 })
    expect(out.match(/Step 2 of 3/g)).toHaveLength(1)
  })

  it('names the running tool when no status label was ever emitted', () => {
    // Signal and webhook runs frequently emit no agent_status at all.
    expect(resumeStatusLine({ label: '', tool: 'ANALYZE_MEDIA', elapsed_seconds: 12 }))
      .toBe('Running ANALYZE_MEDIA · 12s')
  })

  it('counts the step it is WORKING on, not the ones completed', () => {
    // `step` is the COMPLETED count, so 1 of 4 done means step 2 is in flight.
    expect(resumeStatusLine({ label: 'Reading the image', step: 1, total: 4 }))
      .toBe('Step 2 of 4: Reading the image')
  })

  it('caps the step at the total rather than reporting "Step 5 of 4"', () => {
    expect(resumeStatusLine({ label: 'wrapping up', step: 4, total: 4 })).toBe('Step 4 of 4: wrapping up')
  })

  it('falls back to a completed-tool count when nothing is named', () => {
    expect(resumeStatusLine({ tools_done: 3, elapsed_seconds: 65 })).toBe('Working — 3 steps done · 1m')
  })

  it('says "1 step done" rather than "1 steps done"', () => {
    expect(resumeStatusLine({ tools_done: 1 })).toBe('Working — 1 step done')
  })

  it('appends the tool alongside a label that does not already mention it', () => {
    expect(resumeStatusLine({ label: 'Building the page', tool: 'CREATE_PRODUCT', elapsed_seconds: 120 }))
      .toBe('Building the page · running CREATE_PRODUCT · 2m')
  })

  it('honours a legacy status string from a backend that sends no snapshot', () => {
    expect(resumeStatusLine(null, 'Thinking about it')).toBe('Thinking about it')
  })

  it('falls back to the generic line only when there is genuinely nothing to say', () => {
    expect(resumeStatusLine({})).toBe(RESUME_FALLBACK)
    expect(resumeStatusLine(null)).toBe(RESUME_FALLBACK)
    expect(resumeStatusLine(undefined, '')).toBe(RESUME_FALLBACK)
  })

  it('never throws on a malformed snapshot', () => {
    // This renders on the reconnect path; a bad payload must degrade, not blank the chat.
    for (const bad of ['nope', 42, [], { step: 'x', total: 'y', elapsed_seconds: {} }]) {
      expect(() => resumeStatusLine(bad)).not.toThrow()
    }
  })
})
