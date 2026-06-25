// @vitest-environment node
// Guard test: the per-turn "Tool shortlist" Agent Builder control was removed (it conflicted with
// cache-stable tool tiering). This proves the setting no longer appears in the UI. [migration req 12]
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

describe('Agent Builder — per-turn tool shortlist control removed', () => {
  it('AgentBuilder.vue no longer renders the "Tool shortlist" control or binds tool_shortlist_mode', () => {
    const src = read('./AgentBuilder.vue')
    expect(src).not.toContain('Tool shortlist')
    expect(src).not.toContain('tool_shortlist_mode')
  })

  it('AgentBuilderCanvas.vue blankAgent() no longer seeds tool_shortlist_mode', () => {
    const src = read('../views/AgentBuilderCanvas.vue')
    expect(src).not.toContain('tool_shortlist_mode')
  })
})
