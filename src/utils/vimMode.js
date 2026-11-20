// Vim keys in the Let's Code editor (ADM-1322; the editor's settings, off unless chosen). The keys are monaco-vim's
// (MIT, the CodeMirror vim keymap ported to Monaco), loaded only when someone turns vim on. Its mode (NORMAL, INSERT,
// VISUAL) and its ":" command line show in the bar under the editor.
//
// vite.config.js points `monaco-vim` at the library's ES module build: its package's "browser" entry is a UMD build
// with its own copy of Monaco code inside, made for monaco-editor 0.33.

let loading = null
let exDefined = false
// The ":w", ":q" and ":wq" commands act on the editor they are typed in; the CodeBrowser that turned vim on answers.
const handlers = new Map()        // Monaco editor → { write, quit }

function load() {
  if (!loading) loading = import('monaco-vim').catch((e) => { loading = null; throw e })
  return loading
}

function defineEx(VimMode) {
  const Vim = VimMode && VimMode.Vim
  if (exDefined || !Vim || typeof Vim.defineEx !== 'function') return
  exDefined = true
  const run = (name) => (cm) => {
    const h = handlers.get(cm && cm.editor)
    if (h && typeof h[name] === 'function') h[name]()
  }
  // ":w" is the keymap's own command, which saves through `commands.save` (as CodeMirror's).
  if (VimMode.commands) VimMode.commands.save = run('write')
  Vim.defineEx('quit', 'q', run('quit'))
  Vim.defineEx('wq', 'wq', (cm) => { run('write')(cm); run('quit')(cm) })
  Vim.defineEx('xit', 'x', (cm) => { run('write')(cm); run('quit')(cm) })
}

/**
 * Vim keys on one Monaco editor, its status shown in `statusEl`. `write` and `quit` are what ":w" and ":q" do.
 * Returns the function that turns them off again (the editor keeps working as before).
 */
export async function startVim(editor, statusEl, { write, quit } = {}) {
  const mod = await load()
  const { initVimMode, VimMode } = mod
  defineEx(VimMode)
  const vim = initVimMode(editor, statusEl || null)
  handlers.set(editor, { write, quit })
  return () => {
    handlers.delete(editor)
    try { vim.dispose() } catch { /* the editor went away first */ }
  }
}

// Tests.
export function _resetVimMode() { loading = null; exDefined = false; handlers.clear() }
