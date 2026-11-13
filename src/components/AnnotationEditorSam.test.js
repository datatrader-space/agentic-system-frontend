// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AnnotationEditor from '../../training-data/src/components/AnnotationEditor.vue';
import { api } from '../../training-data/src/api/annotate.js';
vi.mock('../../training-data/src/api/annotate.js', async original=>({...(await original()),api:{editor:vi.fn(),comments:vi.fn(),segmentPoint:vi.fn(),saveLabel:vi.fn(),detect:vi.fn()}}));
const wrappers=[];
const classes=[{name:'product logo',color:'#2563eb',description:'Brand mark',trained:false}];
const initial=[{kind:'product logo',points:[[10,10],[80,10],[80,80]]}];
beforeEach(()=>{
  vi.clearAllMocks();localStorage.clear();
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:600,height:300,right:600,bottom:300});
  api.editor.mockResolvedValue({photo:{width:1200,height:800},shapes:initial,classes,tags:[],readonly:'',approving:false,
    detect:{sources:[{id:'sam3',point_selection:true,name:'SAM 3',maker:'Meta',family:'SAM 3',labels:'polygons',where:[],platform:true,detail:'Synthetic fixture'}],auto:'sam3'},started_from:'from_scratch'});
  api.comments.mockResolvedValue({comments:[]});
  api.segmentPoint.mockResolvedValue({state:'ready',source:'sam3',saved:false,shapes:[{kind:'product logo',points:[[500,300],[700,300],[700,500]]}]});
});
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();});
function render(){const state={live:true,ref:'~901',canChangeClasses:true,classes:[],batches:[],images:[{id:'image-1',name:'Synthetic photo',state:'Unlabeled',tags:[],shapes:[],url:'data:image/png;base64,AA=='}]};
const w=mount(AnnotationEditor,{props:{state},global:{stubs:{UiDialog:{props:['open'],template:'<div v-if="open"><slot/></div>'}}}});wrappers.push(w);return w;}
const button=(w,text)=>w.findAll('button').find(b=>b.text().trim()===text);
test('manual editor uses server classes and opening it never invokes automatic detection',async()=>{
  const w=render();await flushPromises();
  expect(w.get('[aria-label="Selected annotation class"]').element.value).toBe('product logo');
  expect(w.findAll('[aria-label="Selected annotation class"] option').map(x=>x.text())).toEqual(['product logo']);
  expect(api.detect).not.toHaveBeenCalled();expect(api.segmentPoint).not.toHaveBeenCalled();
});
test('click-object candidate appends to existing manual annotations only on Apply and supports Undo',async()=>{
  const w=render();await flushPromises();
  await w.get('[aria-label="SAM 3 click to label (A)"]').trigger('click');
  w.get('svg.annotation-overlay').element.dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:300,clientY:150,bubbles:true}));await flushPromises();
  expect(api.segmentPoint).toHaveBeenCalledWith('~901','image-1','product logo',{coords:[[600,400]],labels:[1]},'');
  expect(w.findAll('.shape-list button')).toHaveLength(1);
  expect(w.findAll('.sam-candidate polygon')).toHaveLength(1);
  await button(w,'Apply object outline').trigger('click');
  expect(w.findAll('.shape-list button')).toHaveLength(2);
  expect(api.saveLabel).not.toHaveBeenCalled();
  await w.get('[aria-label="Undo"]').trigger('click');
  expect(w.findAll('.shape-list button')).toHaveLength(1);
});
test('empty project does not silently draw a wall and point selection requires its own class',async()=>{
  api.editor.mockResolvedValue({photo:{width:1200,height:800},shapes:[],classes:[],tags:[],readonly:'',detect:null});
  const w=render();await flushPromises();
  expect(w.get('[aria-label="Selected annotation class"]').element.value).toBe('');
  expect(w.text()).toContain('No classes yet');
  await w.get('[aria-label="SAM 3 click to label (A)"]').trigger('click');
  w.get('svg.annotation-overlay').element.dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:300,clientY:150,bubbles:true}));await flushPromises();
  expect(api.segmentPoint).not.toHaveBeenCalled();expect(w.findAll('.shape-list button')).toHaveLength(0);
});

test('restored SAM disables point tool and keyboard while retaining automatic and manual tools', async()=>{
  const body = await api.editor(); body.detect.sources[0].point_selection=false; api.editor.mockResolvedValue(body); api.editor.mockClear();
  const w=render();await flushPromises();
  expect(w.get('[aria-label="SAM 3 click to label (A)"]').element.disabled).toBe(true);
  expect(w.text()).toContain('Mouse selection is temporarily unavailable');
  expect(w.get('[aria-label="Draw polygon (P)"]').element.disabled).toBe(false);
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}));
  w.get('svg.annotation-overlay').element.dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:300,clientY:150,bubbles:true}));await flushPromises();
  expect(api.segmentPoint).not.toHaveBeenCalled(); expect(api.detect).not.toHaveBeenCalled();
});
