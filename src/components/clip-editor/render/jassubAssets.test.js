// The text renderer's shipped files are JASSUB's, unmodified, at the pinned version, with their notices (plan P13).
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { JASSUB_VERSION } from './jassubAssets'

const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const dir = `public/vendor/jassub/${JASSUB_VERSION}`

describe('JASSUB files', () => {
  it('the pinned version is the installed one, exactly', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(pkg.dependencies.jassub).toBe(JASSUB_VERSION)
    expect(JSON.parse(readFileSync('node_modules/jassub/package.json', 'utf8')).version).toBe(JASSUB_VERSION)
  })
  it('the WebAssembly files and the Emscripten glue are the package\'s, byte for byte', () => {
    for (const f of ['jassub-worker.wasm', 'jassub-worker-modern.wasm', 'jassub-worker.js']) {
      expect(sha(`${dir}/${f}`), f).toBe(sha(`node_modules/jassub/dist/wasm/${f}`))
    }
  })
  it('the worker bundle is there and never contains GPL code', () => {
    const w = readFileSync(`${dir}/worker.js`, 'utf8')
    expect(w).toContain(`JASSUB ${JASSUB_VERSION} worker`)
    expect(w).not.toMatch(/rvfc|requestVideoFrameCallback polyfill/i)
  })
  it('the notices sit next to the files', () => {
    for (const f of ['NOTICE.txt', 'jassub-MIT.txt', 'libass-ISC.txt', 'fribidi-LGPL-2.1.txt', 'freetype-FTL.txt', 'harfbuzz-MIT.txt', 'brotli-MIT.txt', 'abslink-Apache-2.0.txt']) {
      expect(existsSync(`public/vendor/jassub/${f}`), f).toBe(true)
    }
  })
  it('the browser code never imports JASSUB\'s front module (it pulls in rvfc-polyfill, GPL-3.0)', () => {
    const src = readFileSync('src/components/clip-editor/render/textRenderer.js', 'utf8')
    expect(src).not.toMatch(/from 'jassub'|import\('jassub'\)/)
  })
})
