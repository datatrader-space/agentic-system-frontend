// @vitest-environment jsdom
import {it,expect} from 'vitest'
import {mount} from '@vue/test-utils'
import StudioFirstVisit from './StudioFirstVisit.vue'
it('shows the three steps to a first result and can be dismissed', async()=>{
 const w=mount(StudioFirstVisit)
 expect(w.text()).toContain('Three steps to your first result')
 expect(w.findAll('li')).toHaveLength(3)
 await w.get('button').trigger('click');expect(w.emitted('dismiss')).toHaveLength(1)
 await w.setProps({hidden:true});expect(w.find('aside').exists()).toBe(false);w.unmount()
})
