// Builds the Video Studio editor's text renderer files into public/vendor/jassub/<version>/ (ADM-1199, contract
// section 8, plan P13):
//   worker.js                  JASSUB's worker (MIT) with abslink (Apache-2.0) and lfa-ponyfill (MIT), bundled by esbuild
//   jassub-worker.wasm         copied UNMODIFIED from the npm package (libass, FriBiDi, FreeType, HarfBuzz, Brotli)
//   jassub-worker-modern.wasm  the same, the SIMD build
//   jassub-worker.js           Emscripten's glue, unmodified (loaded by libass threads when the page is cross-origin isolated)
// The licence notices sit next to them (public/vendor/jassub/). Run after changing the pinned jassub version:
//   node scripts/build-jassub-worker.mjs
// Why not Vite's ?worker import: the worker has a dynamic import, which Vite's default worker format (iife) refuses.
import { build } from 'esbuild'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const pkgDir = dirname(require.resolve('jassub/package.json'))
const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
const out = join(root, 'public', 'vendor', 'jassub', version)
mkdirSync(out, { recursive: true })

await build({
  entryPoints: [join(pkgDir, 'dist', 'worker', 'worker.js')], outfile: join(out, 'worker.js'), bundle: true, format: 'esm',
  platform: 'browser', target: 'es2022', minify: true, legalComments: 'inline', logLevel: 'warning',
  banner: { js: `/* JASSUB ${version} worker (MIT) with abslink (Apache-2.0) and lfa-ponyfill (MIT); notices: ../NOTICE.txt */` },
})
// jassub-worker.js is Emscripten's own glue, which its threads load next to the worker when the page is cross-origin isolated.
for (const f of ['jassub-worker.wasm', 'jassub-worker-modern.wasm', 'jassub-worker.js']) copyFileSync(join(pkgDir, 'dist', 'wasm', f), join(out, f))
console.log(`jassub ${version} -> ${out}`)
