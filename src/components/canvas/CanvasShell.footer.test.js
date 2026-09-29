// @vitest-environment jsdom
//
// The footer names what was built. A served project has no single document, so the static card's
// "index.html · HTML Document" was untrue of it -- a Next.js app read that way (conv 2106, 2026-09-29).
import { describe, it, expect, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

import CanvasShell from './CanvasShell.vue'
import { useCanvasStore } from '../../stores/useCanvasStore'

beforeEach(() => { setActivePinia(createPinia()) })

const mountShell = () => shallowMount(CanvasShell, { global: { stubs: { teleport: true } } })

describe('the Canvas footer', () => {
  it('describes a served Next.js project as one', () => {
    const canvas = useCanvasStore()
    canvas.provider = 'sandbox'
    canvas.activeRevision = 3
    canvas.project = { type: 'node', framework: 'Next.js', fileCount: 6, port: 3000 }
    const w = mountShell()
    const foot = w.find('[data-test="cv-foot-project"]')
    expect(foot.exists()).toBe(true)
    expect(foot.text()).toContain('Next.js app')
    expect(foot.text()).toContain('6 files')
    expect(foot.text()).toContain('port 3000')
    expect(w.text()).not.toContain('index.html')
  })

  it('a static page still shows its document', () => {
    const canvas = useCanvasStore()
    canvas.provider = 'static'
    const w = mountShell()
    expect(w.find('[data-test="cv-foot-project"]').exists()).toBe(false)
    expect(w.text()).toContain('index.html')
  })
})
