// The activity card follows the theme: its colours are tokens (var(--vm-*)), never a fixed light utility, which
// compiled to a fixed grey that stayed light in dark mode (ADM-1205).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = join(dirname(fileURLToPath(import.meta.url)), 'AgentActivityTimeline.vue')
const css = readFileSync(file, 'utf8').split('<style scoped>')[1].split('</style>')[0].replace(/\/\*[\s\S]*?\*\//g, '')   // comments may name the old utilities

describe('AgentActivityTimeline colours', () => {
  it('uses no fixed colour utility in its styles', () => {
    const fixed = css.match(/(?:text|bg|border|decoration|ring)-(?:gray|slate|zinc|neutral|blue|indigo|green|emerald|red|amber)-\d{2,3}/g) || []
    expect(fixed).toEqual([])
    expect(css).toContain('var(--vm-ink-soft)')
  })
})
