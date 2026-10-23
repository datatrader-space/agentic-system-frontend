// Phase 5 item 10: icons are bundled offline, only the ones src/ names.
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { collectIconNames, subsetCollection, buildSubsetModule } from './vite-icon-subset.js'

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'icons-'))
  mkdirSync(path.join(dir, 'views'))
  writeFileSync(path.join(dir, 'views', 'A.vue'), '<Icon icon="lucide:bot" /><Icon :icon="x ? \'lucide:x\' : \'lucide:check\'" />')
  writeFileSync(path.join(dir, 'map.js'), "export const M = { py: 'logos:python', gh: 'simple-icons:github' }")
  writeFileSync(path.join(dir, 'A.test.js'), "'lucide:only-in-a-test'")
  return dir
}

describe('icon subset', () => {
  it('finds static AND data-driven names, ignoring test files', () => {
    const found = collectIconNames(fixture())
    expect([...found.get('lucide')].sort()).toEqual(['bot', 'check', 'x'])
    expect([...found.get('logos')]).toEqual(['python'])
    expect([...found.get('simple-icons')]).toEqual(['github'])
  })

  it('keeps only the named icons, following aliases to their parent', () => {
    const col = { prefix: 'p', width: 24, height: 24, icons: { a: { body: 'A' }, b: { body: 'B' } }, aliases: { c: { parent: 'a' } } }
    expect(subsetCollection(col, ['c'])).toEqual({ prefix: 'p', width: 24, height: 24, icons: { a: { body: 'A' } }, aliases: { c: { parent: 'a' } } })
    expect(Object.keys(subsetCollection(col, ['b', 'missing']).icons)).toEqual(['b'])
  })

  it('emits a module that registers the real icon bodies from the installed collections', () => {
    const code = buildSubsetModule(fixture())
    expect(code).toContain("import { addCollection } from '@iconify/vue'")
    expect(code).toContain('"prefix":"lucide"')
    expect(code).toContain('"bot"')
    expect(code).not.toContain('only-in-a-test')
    expect(code).toMatch(/export const iconCount = \d+/)
  })
})

describe('icon subset modules', () => {
  it('keeps brand logos out of the entry module', () => {
    const dir = fixture()
    const entry = buildSubsetModule(dir, ['lucide', 'simple-icons'])
    const logos = buildSubsetModule(dir, ['logos'])
    expect(entry).not.toContain('"prefix":"logos"')
    expect(logos).toContain('"prefix":"logos"')
    expect(logos).not.toContain('"prefix":"lucide"')
  })
})
