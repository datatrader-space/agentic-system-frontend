// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Details from './StudioLookDetails.vue'
import { studioLooks } from '../../services/studioLooks'

describe('Every approved look is editable before it reaches the Agent', () => {
  it.each(studioLooks)('$id exposes its real variables and applies visible text without submitting', async look => {
    const w = mount(Details, {props:{look}})
    expect(w.findAll('input')).toHaveLength(look.variables.length)
    const changed = 'My personal direction for '+look.title
    await w.findAll('input')[0].setValue(changed)
    expect(w.text()).toContain(changed)
    expect(w.emitted('apply')).toBeUndefined()
    await w.get('button').trigger('click')
    const applied = w.emitted('apply')[0][0]
    expect(applied.id).toBe(look.id)
    expect(applied.clientOnly).toBe(true)
    expect(applied.promptTemplate).toContain(changed)
    expect(applied.promptTemplate).not.toMatch(/\{[^}]+\}/)
    w.unmount()
  })
  it('does not apply a look while the caller is busy', async () => {
    const w=mount(Details,{props:{look:studioLooks[0],disabled:true}})
    await w.get('button').trigger('click');expect(w.emitted('apply')).toBeUndefined();w.unmount()
  })
})
