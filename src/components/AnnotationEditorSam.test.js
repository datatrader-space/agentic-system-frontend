// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AnnotationEditor from '../../training-data/src/components/AnnotationEditor.vue';
import { api } from '../../training-data/src/api/annotate.js';
vi.mock('../../training-data/src/api/annotate.js', async original=>({...(await original()),api:{editor:vi.fn(),comments:vi.fn(),segmentPoint:vi.fn(),saveLabel:vi.fn(),detect:vi.fn(),addClass:vi.fn(),updateClass:vi.fn(),detectPreference:vi.fn(),sendToUnannotated:vi.fn()}}));
const wrappers=[];
const classes=[{name:'product logo',color:'#2563eb',description:'Brand mark',geometry:''}];
const initial=[{kind:'product logo',points:[[10,10],[80,10],[80,80]]}];
beforeEach(()=>{
  vi.clearAllMocks();localStorage.clear();
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:600,height:300,right:600,bottom:300});
  api.editor.mockResolvedValue({photo:{width:1200,height:800},shapes:initial,classes,tags:[],readonly:'',approving:false,
    detect:{sources:[{id:'sam3',point_selection:true,name:'SAM 3',maker:'Meta',family:'SAM 3',labels:'polygons',where:[],platform:true,detail:'Synthetic fixture'}],auto:'sam3'},started_from:'from_scratch'});
  api.comments.mockResolvedValue({comments:[]});api.detectPreference.mockResolvedValue({preference:'sam3'});
  api.segmentPoint.mockResolvedValue({state:'ready',source:'sam3',saved:false,shapes:[{kind:'product logo',points:[[500,300],[700,300],[700,500]]}]});
});
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();});
function render(){const state={live:true,ref:'~901',canChangeClasses:true,classes:[],batches:[],images:[{id:'image-1',name:'Synthetic photo',state:'Unlabeled',tags:[],shapes:[],url:'data:image/png;base64,AA=='}]};
const w=mount(AnnotationEditor,{props:{state},global:{stubs:{UiDialog:{props:['open'],template:'<div v-if="open"><slot/></div>'}}}});wrappers.push(w);return w;}
const button=(w,text)=>w.findAll('button').find(b=>b.text().trim()===text);
const layers=async w=>{await button(w,'Layers').trigger('click');return w.findAll('.layer-row');};
test('manual editor uses server classes and opening it never invokes automatic detection',async()=>{
  const w=render();await flushPromises();
  expect(w.get('[aria-label="Selected annotation class"]').element.value).toBe('product logo');
  expect(w.findAll('[aria-label="Selected annotation class"] option').map(x=>x.text())).toEqual(['product logo']);
  expect(api.detect).not.toHaveBeenCalled();expect(api.segmentPoint).not.toHaveBeenCalled();
});
test('a Smart Select candidate is added beside the manual annotations only when kept, and Undo takes it back',async()=>{
  const w=render();await flushPromises();
  await w.get('[aria-label="Smart Select (S)"]').trigger('click');
  w.get('svg.annotation-overlay').element.dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:300,clientY:150,bubbles:true}));await flushPromises();
  expect(api.segmentPoint).toHaveBeenCalledWith('~901','image-1','product logo',{coords:[[600,400]],labels:[1]});
  expect(await layers(w)).toHaveLength(1);
  expect(w.findAll('.sam-candidate polygon')).toHaveLength(1);
  await button(w,'Keep outline (Enter)').trigger('click');
  expect(w.findAll('.layer-row')).toHaveLength(2);
  expect(api.saveLabel).not.toHaveBeenCalled();
  await w.get('[aria-label="Undo (Ctrl+Z)"]').trigger('click');
  expect(w.findAll('.layer-row')).toHaveLength(1);
});
test('empty project does not silently draw a wall and point selection requires its own class',async()=>{
  api.editor.mockResolvedValue({photo:{width:1200,height:800},shapes:[],classes:[],tags:[],readonly:'',detect:null});
  const w=render();await flushPromises();
  expect(w.get('[aria-label="Selected annotation class"]').element.value).toBe('');
  expect(w.text()).toContain('No classes yet');
  await w.get('[aria-label="Smart Select (S)"]').trigger('click');
  w.get('svg.annotation-overlay').element.dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:300,clientY:150,bubbles:true}));await flushPromises();
  expect(api.segmentPoint).not.toHaveBeenCalled();expect(await layers(w)).toHaveLength(0);
});

test('without point selection Smart Select and Box to outline say why, and the keyboard cannot reach them either', async()=>{
  const body = await api.editor(); body.detect.sources[0].point_selection=false; api.editor.mockResolvedValue(body); api.editor.mockClear();
  const w=render();await flushPromises();
  // Focusable, so the hover card can say why; pressing it says so too.
  expect(w.get('[aria-label="Smart Select (S)"]').attributes('aria-disabled')).toBe('true');
  expect(w.get('[aria-label="Box to outline (O)"]').attributes('aria-disabled')).toBe('true');
  // Not "unavailable right now" (live, 2026-11-20: it read as an outage while SAM 3 was on): the release has no point
  // selection in its SAM 3 server (bb77016e), whether SAM 3 is on or not.
  await w.get('[aria-label="Smart Select (S)"]').trigger('click');
  expect(w.text()).toContain('Smart Select is not available yet: the SAM 3 that AADML runs now takes no clicks or boxes. Label Assist, Find Objects with AI and drawing by hand work.');
  expect(w.find('.sam-selection-panel').exists()).toBe(false);
  expect(w.get('[aria-label="Polygon (P)"]').attributes('aria-disabled')).toBeUndefined();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',bubbles:true}));
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'o',bubbles:true}));
  w.get('svg.annotation-overlay').element.dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:300,clientY:150,bubbles:true}));await flushPromises();
  expect(api.segmentPoint).not.toHaveBeenCalled(); expect(api.detect).not.toHaveBeenCalled();
});

// FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md section 12.2: a class is a wall by its geometry (Classes page), never by its name.
test('the corner type and the corner types sent follow the class geometry, never its name',async()=>{
  const two=[{name:'wall',color:'#ef4444',description:'',geometry:''},{name:'facade',color:'#0ea5e9',description:'',geometry:'wall'}];
  api.editor.mockResolvedValue({photo:{width:1200,height:800},classes:two,tags:[],readonly:'',approving:false,detect:null,started_from:'from_scratch',
    shapes:[{kind:'wall',points:[[0,0],[100,0],[100,100]],corner_types:['room','room','image_edge']},{kind:'facade',points:[[200,0],[300,0],[300,100]],corner_types:['room','image_edge','room']}]});
  api.saveLabel.mockResolvedValue({state:'draft'});
  const w=render();await flushPromises();
  const select=w.get('[aria-label="Selected annotation class"]');
  await select.setValue('wall');expect(w.text()).not.toContain('Corner type');
  await select.setValue('facade');expect(w.text()).toContain('Corner type');
  await button(w,'Save draft').trigger('click');await flushPromises();
  const sent=api.saveLabel.mock.calls[0][2].shapes;
  expect(sent[0].kind).toBe('wall');expect(sent[0].corner_types).toBeUndefined();
  expect(sent[1].kind).toBe('facade');expect(sent[1].corner_types).toEqual(['room','image_edge','room']);
});

test('a class added in the editor takes the next palette colour no class of the project has',async()=>{
  api.editor.mockResolvedValue({photo:{width:1200,height:800},shapes:[],classes:[{name:'wall',color:'#ef4444',description:'',geometry:''}],tags:[],readonly:'',approving:false,detect:null,started_from:'from_scratch'});
  api.addClass.mockResolvedValue({added:'sofa',classes:[{name:'wall',color:'#ef4444'},{name:'sofa',color:'#0ea5e9'}]});
  const w=render();await flushPromises();
  await button(w,'Add class').trigger('click');
  await w.get('input[placeholder="What do you want to label?"]').setValue('sofa');
  await w.get('input[placeholder="What do you want to label?"]').element.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await flushPromises();
  expect(api.addClass).toHaveBeenCalledWith('~901',{name:'sofa',color:'#0ea5e9'});   // not the red of "wall"
});

// Live, 2026-11-20: "Find Objects with AI" drew SAM 3's Masks like its Polygons, and seeing the other way meant Back and
// asking (and paying) again. The found shapes are drawn as the chosen way shows them, and the switch beside them only
// redraws the same answer.
test('the found shapes are drawn as Polygons or Masks show them, and switching never asks again',async()=>{
  const sam=(id,labels)=>({id,name:`SAM 3 (${labels==='masks'?'Masks':'Polygons'})`,maker:'Meta',family:'SAM 3',labels,where:[],platform:true,detail:'Synthetic fixture'});
  api.editor.mockResolvedValue({photo:{width:1200,height:800},shapes:[],classes,tags:[],readonly:'',approving:false,
    detect:{sources:[sam('sam3','polygons'),sam('sam3-masks','masks')],preference:'sam3'},started_from:'from_scratch'});
  api.detect.mockResolvedValue({name:'SAM 3 (Polygons)',started_model:'sam3',find:'product logo',tidy:false,
    shapes:[{kind:'product logo',points:[[100,100],[300,100],[300,300]],score:0.9}]});
  const w=render();await flushPromises();
  await w.get('button.find-ai').trigger('click');await flushPromises();
  await w.get('#find-class-name').setValue('product logo');
  await w.get('form.find-ask').trigger('submit');await flushPromises();   // Find Objects submits the card's form
  expect(api.detect).toHaveBeenCalledTimes(1);
  const found=()=>w.get('polygon[stroke-dasharray="6 4"]').attributes('fill-opacity');
  expect(found()).toBe('0.25');
  const way=name=>w.findAll('.find-card .source-ways button').find(b=>b.text().includes(name));
  await way('Masks').trigger('click');await flushPromises();
  expect(found()).toBe('0.55');                                            // the same shape, filled
  await way('Polygons').trigger('click');await flushPromises();
  expect(found()).toBe('0.25');
  expect(api.detect).toHaveBeenCalledTimes(1);                             // never asked again
});
