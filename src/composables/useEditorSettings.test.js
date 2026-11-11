// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useEditorSettings, clean, monacoOptions, DEFAULTS, EDITOR_SETTINGS_KEY, _reloadEditorSettings } from './useEditorSettings'

beforeEach(() => { localStorage.clear(); _reloadEditorSettings() })

describe('useEditorSettings', () => {
  it('starts at the defaults and keeps a change in this browser', async () => {
    const { settings } = useEditorSettings()
    expect({ ...settings }).toEqual({ ...DEFAULTS })
    settings.fontSize = 16
    settings.minimap = false
    await nextTick()
    expect(JSON.parse(localStorage.getItem(EDITOR_SETTINGS_KEY))).toMatchObject({ fontSize: 16, minimap: false })
    _reloadEditorSettings()
    expect(useEditorSettings().settings.fontSize).toBe(16)
  })

  it('only known values are kept from the store', () => {
    expect(clean({ fontSize: 99, tabSize: 3, lineNumbers: 'interval', wordWrap: 'yes', minimap: false, evil: 1 }))
      .toEqual({ ...DEFAULTS, minimap: false })
    expect(clean(null)).toEqual({ ...DEFAULTS })
  })

  it('reset restores the defaults', () => {
    const { settings, reset } = useEditorSettings()
    settings.lineNumbers = 'off'
    reset()
    expect(settings.lineNumbers).toBe('on')
  })

  it("becomes Monaco's options", () => {
    expect(monacoOptions({ ...DEFAULTS, wordWrap: false, minimap: false, lineNumbers: 'relative', whitespace: 'all', fontSize: 12 }))
      .toEqual({ fontSize: 12, wordWrap: 'off', minimap: { enabled: false }, lineNumbers: 'relative', renderWhitespace: 'all' })
  })
})
