// JASSUB's worker and WebAssembly files (jassub 2.5.23, pinned in package.json), served from
// public/vendor/jassub/2.5.23/ next to their licence notices (public/vendor/jassub/). The wasm files are the npm
// package's, unmodified, loaded on their own only when the first text item is drawn (plan P13: FriBiDi inside them is
// LGPL-2.1). scripts/build-jassub-worker.mjs makes the folder; jassubAssets.test.js checks it matches the package.
export const JASSUB_VERSION = '2.5.23'
const base = `${(import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/')}vendor/jassub/${JASSUB_VERSION}/`
export const workerUrl = `${base}worker.js`
export const wasmUrl = `${base}jassub-worker.wasm`
export const modernWasmUrl = `${base}jassub-worker-modern.wasm`
