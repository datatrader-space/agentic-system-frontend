// ADM-1342: an icon name that is not bundled is fetched from AADML's /api/iconify, never from api.iconify.design.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _api, loadIcon } from '@iconify/vue'
import { ICON_API, useAadmlIconApi } from './iconifyProvider'

const asked = []
function fakeFetch(url) {
  asked.push(url)
  const [, prefix, names] = url.match(/\/([a-z0-9-]+)\.json\?icons=(.*)$/)
  const icons = Object.fromEntries(decodeURIComponent(names).split(',').map((n) => [n, { body: '<path d="M0 0h1v1z"/>' }]))
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ prefix, icons }) })
}

beforeAll(() => {
  _api.setFetch(fakeFetch)
  useAadmlIconApi()
})

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(vue|js)$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(full)
  }
  return out
}

describe('Iconify API provider', () => {
  it('is AADML\'s own endpoint only: no api.iconify.design and none of its mirrors', () => {
    const { resources } = _api.getAPIConfig('')
    expect(resources).toEqual([ICON_API])
    expect(ICON_API).toBe('/api/iconify')
    expect(resources.join(' ')).not.toMatch(/iconify\.design|simplesvg|unisvg/)
  })

  it('asks /api/iconify for a runtime-only icon name, and nothing else', async () => {
    await loadIcon('selfhst:firecrawl')
    await loadIcon('logos:notion-icon')
    expect(asked.sort()).toEqual(['/api/iconify/logos.json?icons=notion-icon', '/api/iconify/selfhst.json?icons=firecrawl'])
  })

  it('every file that names a bundled logo imports the logos chunk, so that logo is never asked of the API', () => {
    const src = fileURLToPath(new URL('..', import.meta.url))
    const missing = sourceFiles(src).filter((file) => {
      const text = readFileSync(file, 'utf8')
      return /(?<![\w-])logos:[a-z0-9]/.test(text) && !text.includes("import 'virtual:icon-subset-logos'")
    }).map((file) => path.relative(src, file))
    expect(missing).toEqual([])
  })
})
