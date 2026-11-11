// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useIdeTheme, IDE_THEME_KEY, _resetIdeTheme } from './useIdeTheme'
import { useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  _resetIdeTheme()
  useTheme().setTheme?.('light')
})

describe('useIdeTheme', () => {
  it('follows the app until the person picks, then keeps the pick', () => {
    const app = useTheme()
    const ide = useIdeTheme()
    expect(ide.theme.value).toBe('light')
    app.setTheme('dark')
    expect(ide.theme.value).toBe('dark')
    ide.toggle()                                              // the pick: light, while the app is dark
    expect(ide.theme.value).toBe('light')
    expect(localStorage.getItem(IDE_THEME_KEY)).toBe('light')
    app.setTheme('light')
    app.setTheme('dark')
    expect(ide.theme.value).toBe('light')                     // the app changing does not undo the pick
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')   // and the pick never changes the app
  })

  it('a pick is remembered by the next visit and shared by every part of the editor', () => {
    localStorage.setItem(IDE_THEME_KEY, 'dark')
    _resetIdeTheme()
    const a = useIdeTheme()
    const b = useIdeTheme()
    expect([a.isDark.value, b.isDark.value]).toEqual([true, true])
    a.toggle()
    expect(b.theme.value).toBe('light')
  })

  it('blocked storage: the editor still switches for this visit', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const ide = useIdeTheme()
    ide.toggle()
    expect(ide.theme.value).toBe('dark')
    set.mockRestore()
  })
})
