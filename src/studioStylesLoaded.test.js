// Every page that uses the Studio's shared form classes (st-field, st-input, st-button) loads their stylesheet itself:
// a page opened straight from a link has no other Studio page to load it first (the clip editor's start form showed as
// bare boxes on production, 2026-11-18).
import { describe, expect, it } from 'vitest'

const pages = import.meta.glob('./views/**/*.vue', { query: '?raw', import: 'default', eager: true })

describe('the Studio form styles load with every page that uses them', () => {
  it('a view using st- classes imports studio.css or renders inside StudioPage', () => {
    const missing = Object.entries(pages)
      .filter(([, src]) => /class="[^"]*\bst-(field|input|button)\b/.test(src))
      .filter(([, src]) => !src.includes('studio.css') && !/\bStudioPage\b/.test(src))
      .map(([path]) => path)
    expect(missing).toEqual([])
  })
})
