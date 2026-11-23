// The Let's Code editor's settings (ADM-1205, phase A): font size, tab size, word wrap, minimap, line numbers,
// whitespace and format on save (ADM-1319), autosave and vim keys (ADM-1322), as VS Code's most used editor settings.
// Kept in this browser; one set for every project.
import { reactive, watch } from 'vue'

export const EDITOR_SETTINGS_KEY = 'lets-code:editor-settings'

export const DEFAULTS = Object.freeze({
  fontSize: 14,
  tabSize: 'auto',          // 'auto' keeps each file's own indentation; 2 / 4 / 8 sets it
  wordWrap: true,
  minimap: true,
  lineNumbers: 'on',        // 'on' | 'relative' | 'off'
  whitespace: 'selection',  // 'none' | 'selection' | 'all'
  formatOnSave: false,      // Save formats a TypeScript, JavaScript or Python file first (ADM-1319)
  // Autosave (ADM-1322), VS Code's choices: 'off', 'afterDelay' (a pause in typing of autoSaveDelay ms) or
  // 'onFocusChange' (the editor loses the focus, another tab is shown, or the browser window is left). Always the
  // version-checked save: a file changed on disk is asked about, never overwritten.
  autoSave: 'off',
  autoSaveDelay: 1000,
  vim: false,               // vim keys in the editor (monaco-vim; ADM-1322)
})

export const CHOICES = Object.freeze({
  fontSize: [11, 12, 13, 14, 15, 16, 18, 20, 22, 24],
  tabSize: ['auto', 2, 4, 8],
  lineNumbers: ['on', 'relative', 'off'],
  whitespace: ['none', 'selection', 'all'],
  autoSave: ['off', 'afterDelay', 'onFocusChange'],
  autoSaveDelay: [500, 1000, 2000, 5000],
})

// Only known keys with allowed values are kept: a stale or edited store never reaches Monaco.
export function clean(raw) {
  const out = { ...DEFAULTS }
  if (!raw || typeof raw !== 'object') return out
  for (const k of ['fontSize', 'tabSize', 'lineNumbers', 'whitespace', 'autoSave', 'autoSaveDelay']) {
    if (CHOICES[k].includes(raw[k])) out[k] = raw[k]
  }
  for (const k of ['wordWrap', 'minimap', 'formatOnSave', 'vim']) if (typeof raw[k] === 'boolean') out[k] = raw[k]
  return out
}

function load() {
  try { return clean(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY) || 'null')) } catch { return { ...DEFAULTS } }
}

const settings = reactive(load())
watch(settings, (s) => {
  try { localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(s)) } catch { /* kept for this visit */ }
}, { deep: true })

export function useEditorSettings() {
  function reset() { Object.assign(settings, DEFAULTS) }
  return { settings, reset }
}

// Monaco's options for these settings (the editor's own options are merged over them).
export function monacoOptions(s) {
  return {
    fontSize: s.fontSize,
    wordWrap: s.wordWrap ? 'on' : 'off',
    minimap: { enabled: !!s.minimap },
    lineNumbers: s.lineNumbers,
    renderWhitespace: s.whitespace,
  }
}

// Tests: read the store again.
export function _reloadEditorSettings() { Object.assign(settings, load()) }
