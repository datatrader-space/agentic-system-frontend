// @vitest-environment node
// ADM-1367: every radio group of the database dialog has its own name, so the arrow keys move within the group.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(fileURLToPath(new URL('./DatabaseConnectionDialog.vue', import.meta.url)), 'utf8')

describe('DatabaseConnectionDialog radios (ADM-1367)', () => {
  it('names every radio input by its group', () => {
    const radios = source.match(/<input[^>]*type="radio"[^>]*>/g) || []
    expect(radios.length).toBeGreaterThan(0)
    for (const r of radios) expect(r).toMatch(/:name="`\$\{formId\}-[a-z-]+`"/)
  })
})
