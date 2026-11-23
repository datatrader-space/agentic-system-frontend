// Vim keys (ADM-1322): monaco-vim is loaded when turned on; ":w" saves and ":q" closes the tab of the editor they
// were typed in; turning them off disposes them.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ ex: {}, adapters: [] }))
vi.mock('monaco-vim', () => {
  const VimMode = {
    commands: {},
    Vim: { defineEx: vi.fn((name, prefix, fn) => { state.ex[prefix] = fn }) },
  }
  return {
    VimMode,
    initVimMode: vi.fn((editor, statusEl) => {
      const a = { editor, statusEl, dispose: vi.fn() }
      state.adapters.push(a)
      return a
    }),
  }
})

import { initVimMode, VimMode } from 'monaco-vim'
import { startVim, _resetVimMode } from './vimMode'

beforeEach(() => { _resetVimMode(); state.ex = {}; state.adapters = []; vi.clearAllMocks() })

describe('startVim', () => {
  it('turns vim keys on with the status bar, and off again', async () => {
    const editor = {}
    const bar = {}
    const stop = await startVim(editor, bar, {})
    expect(initVimMode).toHaveBeenCalledWith(editor, bar)
    stop()
    expect(state.adapters[0].dispose).toHaveBeenCalled()
  })

  it(':w saves and :q closes in the editor they were typed in, never another', async () => {
    const a = { write: vi.fn(), quit: vi.fn() }
    const b = { write: vi.fn(), quit: vi.fn() }
    const edA = {}
    const edB = {}
    await startVim(edA, null, a)
    const stopB = await startVim(edB, null, b)
    VimMode.commands.save({ editor: edA })                       // the keymap's own :w
    state.ex.q({ editor: edB })
    state.ex.wq({ editor: edA })
    expect(a.write).toHaveBeenCalledTimes(2)
    expect(a.quit).toHaveBeenCalledTimes(1)
    expect(b.quit).toHaveBeenCalledTimes(1)
    expect(b.write).not.toHaveBeenCalled()
    stopB()
    state.ex.q({ editor: edB })                                  // turned off: nothing answers for it
    expect(b.quit).toHaveBeenCalledTimes(1)
    expect(VimMode.Vim.defineEx).toHaveBeenCalledTimes(3)        // q, wq, x: defined once for every editor
  })
})
