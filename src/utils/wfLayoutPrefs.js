// Workflow Builder — resizable layout preferences (Phase 2C). localStorage ONLY; no backend.
// Pure + injectable storage so it's unit-testable. Persists panel sizes + collapse flags.

export const LAYOUT_KEY = 'wfb_layout_v1'

export const LAYOUT_DEFAULTS = {
  paletteW: 248, inspectorW: 330, logH: 200,
  paletteCollapsed: false, inspectorCollapsed: false, logOpen: false,
}

// [min, max] for the resizable dimensions.
export const LAYOUT_BOUNDS = {
  paletteW: [180, 420], inspectorW: [260, 560], logH: [120, 460],
}

function clampNum(v, [min, max], fallback) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Coerce an arbitrary object into a valid layout (clamped numbers + boolean flags + defaults).
export function clampLayout(p) {
  const o = p && typeof p === 'object' ? p : {}
  return {
    paletteW: clampNum(o.paletteW, LAYOUT_BOUNDS.paletteW, LAYOUT_DEFAULTS.paletteW),
    inspectorW: clampNum(o.inspectorW, LAYOUT_BOUNDS.inspectorW, LAYOUT_DEFAULTS.inspectorW),
    logH: clampNum(o.logH, LAYOUT_BOUNDS.logH, LAYOUT_DEFAULTS.logH),
    paletteCollapsed: !!o.paletteCollapsed,
    inspectorCollapsed: !!o.inspectorCollapsed,
    logOpen: !!o.logOpen,
  }
}

function _storage(s) {
  if (s) return s
  try { return globalThis.localStorage } catch { return null }
}

export function loadLayout(storage) {
  const st = _storage(storage)
  try {
    const raw = st && st.getItem(LAYOUT_KEY)
    return clampLayout({ ...LAYOUT_DEFAULTS, ...(raw ? JSON.parse(raw) : {}) })
  } catch {
    return { ...LAYOUT_DEFAULTS }
  }
}

export function saveLayout(p, storage) {
  const st = _storage(storage)
  try { st && st.setItem(LAYOUT_KEY, JSON.stringify(clampLayout(p))) } catch { /* ignore quota/SSR */ }
}
