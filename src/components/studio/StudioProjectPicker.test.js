// @vitest-environment jsdom
import { afterAll,beforeAll,afterEach,beforeEach,expect,it,vi } from 'vitest'
import { reactive,ref } from 'vue'
import { mount,flushPromises } from '@vue/test-utils'
const state=vi.hoisted(()=>({chat:null,video:null}))
const api=vi.hoisted(()=>({get:vi.fn(),post:vi.fn()}))
vi.mock('../../services/api',()=>({default:api}))
vi.mock('../../stores/useChatStore',()=>({useChatStore:()=>state.chat}))
vi.mock('../../stores/useVideoStore',()=>({useVideoStore:()=>state.video}))
vi.mock('../../composables/useNotify',()=>({notify:{success:vi.fn()}}))
import Picker from './StudioProjectPicker.vue'
let w,user
const modalMethods=['showModal','close'].map(name=>[name,Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,name)])
beforeAll(()=>{Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','')}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.removeAttribute('open');this.dispatchEvent(new Event('close'))}})})
afterAll(()=>{for(const [name,descriptor] of modalMethods){if(descriptor)Object.defineProperty(HTMLDialogElement.prototype,name,descriptor);else delete HTMLDialogElement.prototype[name]}})
beforeEach(()=>{vi.clearAllMocks();user=ref({id:'one'});state.chat=reactive({selectedAgentId:'studio',conversationId:'chat-one',isBusy:false,hitlRequests:[],ensureConversation:vi.fn().mockResolvedValue('chat-one')});state.video=reactive({busy:false,loadVersions:vi.fn(),project:null,conversationId:'chat-one'});api.get.mockResolvedValue({data:{projects:[{project_id:'owned-project',title:'Campaign'}]}});api.post.mockResolvedValue({data:{project_id:'owned-project',title:'Campaign'}})})
afterEach(()=>{w?.unmount();document.body.innerHTML=''})
async function open(){w=mount(Picker,{attachTo:document.body,global:{provide:{studioUser:user}}});await w.get('.spp-trigger').trigger('click');await flushPromises()}
it('lists existing projects without writing, and associates only on explicit confirmation',async()=>{
 await open();expect(api.post).not.toHaveBeenCalled();expect(state.chat.ensureConversation).not.toHaveBeenCalled()
 await w.get('select').setValue('owned-project');expect(api.post).not.toHaveBeenCalled()
 await w.get('footer button').trigger('click');await flushPromises()
 expect(api.post).toHaveBeenCalledExactlyOnceWith('/video/projects/owned-project/open/',{conversation_id:'chat-one'})
 expect(state.video.project.project_id).toBe('owned-project');expect(state.video.loadVersions).toHaveBeenCalledOnce()
})
it('blocks project changes while an approval is pending',async()=>{
 await open();await w.get('select').setValue('owned-project');state.chat.hitlRequests=[{id:'approval'}];await flushPromises()
 expect(w.get('footer button').attributes('disabled')).toBeDefined();await w.get('footer button').trigger('click');expect(api.post).not.toHaveBeenCalled()
})
it('discards a stale project list after an account switch',async()=>{
 let resolve;api.get.mockImplementationOnce(()=>new Promise(r=>resolve=r));await open();user.value={id:'two'};await flushPromises();resolve({data:{projects:[{project_id:'old',title:'Old account project'}]}});await flushPromises();expect(w.find('select').exists()).toBe(false);expect(api.post).not.toHaveBeenCalled()
})
it('does not apply a pending association response to a different signed-in account',async()=>{
 await open();await w.get('select').setValue('owned-project');let resolve;api.post.mockImplementationOnce(()=>new Promise(r=>resolve=r));await w.get('footer button').trigger('click');await flushPromises();user.value={id:'two'};await flushPromises();resolve({data:{project_id:'owned-project'}});await flushPromises();expect(state.video.project).toBeNull();expect(state.video.loadVersions).not.toHaveBeenCalled()
})
