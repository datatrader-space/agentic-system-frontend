// Smoke: resizable-layout preference read/write + clamping (Phase 2C). localStorage only.
// Uses a fake in-memory storage so it runs in Node. Run: node scripts/wf_layout_prefs_smoke.mjs
import { loadLayout, saveLayout, clampLayout, LAYOUT_DEFAULTS, LAYOUT_BOUNDS, LAYOUT_KEY } from '../src/utils/wfLayoutPrefs.js'

let failures = 0
const ok = (c, m) => { if (!c) { console.error('  ✗', m); failures++ } else { console.log('  ✓', m) } }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m } }

console.log('defaults + clamp:')
ok(eq(clampLayout({}), LAYOUT_DEFAULTS), 'empty → defaults')
ok(clampLayout({ paletteW: 9999 }).paletteW === LAYOUT_BOUNDS.paletteW[1], 'paletteW clamps to max')
ok(clampLayout({ paletteW: 10 }).paletteW === LAYOUT_BOUNDS.paletteW[0], 'paletteW clamps to min')
ok(clampLayout({ inspectorW: 'abc' }).inspectorW === LAYOUT_DEFAULTS.inspectorW, 'non-numeric → default')
ok(clampLayout({ logH: 300 }).logH === 300, 'in-range value kept')
ok(clampLayout({ paletteCollapsed: 1, logOpen: 'x' }).paletteCollapsed === true, 'flags coerced to boolean')

console.log('round-trip read/write:')
const st = fakeStorage()
ok(eq(loadLayout(st), LAYOUT_DEFAULTS), 'load with empty storage → defaults')
saveLayout({ paletteW: 300, inspectorW: 400, logH: 250, paletteCollapsed: true, inspectorCollapsed: false, logOpen: true }, st)
ok(!!st._m.get(LAYOUT_KEY), 'saveLayout persisted under the key')
const got = loadLayout(st)
ok(got.paletteW === 300 && got.inspectorW === 400 && got.logH === 250, 'sizes round-trip')
ok(got.paletteCollapsed === true && got.logOpen === true, 'flags round-trip')

console.log('persist clamps out-of-range before writing:')
saveLayout({ paletteW: 9999, inspectorW: 5, logH: 99999 }, st)
const clamped = loadLayout(st)
ok(clamped.paletteW === LAYOUT_BOUNDS.paletteW[1] && clamped.inspectorW === LAYOUT_BOUNDS.inspectorW[0] && clamped.logH === LAYOUT_BOUNDS.logH[1], 'saved values are clamped on read')

console.log('corrupt storage is safe:')
const bad = fakeStorage(); bad.setItem(LAYOUT_KEY, '{not json')
ok(eq(loadLayout(bad), LAYOUT_DEFAULTS), 'invalid JSON → defaults (no throw)')

console.log(failures ? `\nFAILED (${failures})` : '\nALL PASS')
process.exit(failures ? 1 : 0)
