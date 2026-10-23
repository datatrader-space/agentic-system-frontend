// @vitest-environment jsdom
import {it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
import StudioFirstVisit from './StudioFirstVisit.vue'
it('keeps the live steps and makes the planned-page hint explicit about availability', async()=>{
 const w=mount(StudioFirstVisit)
 expect(w.text()).toContain('Three steps to your first result')
 expect(w.findAll('li')).toHaveLength(3)
 await w.setProps({plannedPhase:'P2'})
 expect(w.text()).toContain('A preview of this workflow')
 expect(w.text()).toContain('while Phase P2 is being built')
 await w.get('button').trigger('click');expect(w.emitted('dismiss')).toHaveLength(1)
 await w.setProps({hidden:true});expect(w.find('aside').exists()).toBe(false);w.unmount()
})
