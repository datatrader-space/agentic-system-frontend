// @vitest-environment jsdom
// Masks in the labeling editor (agentic-docs/LABEL_EDITOR_TOOLS_PLAN.md 2.1, contracts C2, C3, C4, C8): drawn by the
// mask layer under the SVG, picked by a click, listed in Layers, saved back as they came; Brush and Eraser strokes as
// one step of Undo each; a wall / window / door class refused in words; Convert to mask and Convert to polygon; a Masks
// answer kept as masks. A small synthetic photo (120 x 80) keeps the masks fast.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AnnotationEditor from '../../training-data/src/components/AnnotationEditor.vue';
import { api } from '../../training-data/src/api/annotate.js';
import { decode, encode } from '../../training-data/src/rle.js';
vi.mock('../../training-data/src/api/annotate.js', async original=>({...(await original()),api:{editor:vi.fn(),comments:vi.fn(),segmentPoint:vi.fn(),saveLabel:vi.fn(),detect:vi.fn(),addClass:vi.fn(),updateClass:vi.fn(),detectPreference:vi.fn(),sendToUnannotated:vi.fn()}}));

const W=120,H=80;
// A rectangle mask: x 10..39, y 10..29.
function rectMask(x0,y0,x1,y1){const data=new Uint8Array(W*H);for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)data[y*W+x]=1;return encode(data,H,W);}
const sofa=rectMask(10,10,40,30);
const classes=[{name:'sofa',color:'#ef4444',description:'',geometry:''},{name:'wall',color:'#0ea5e9',description:'',geometry:'wall'}];
const source=(id,labels)=>({id,name:`SAM 3 (${labels})`,maker:'Meta',family:'SAM 3',labels,platform:true,point_selection:true,tab:'ai',where:[],detail:'Synthetic fixture',hosted:{state:'on',price:'$0.002 an image'}});
const wrappers=[];
beforeEach(()=>{
  vi.clearAllMocks();localStorage.clear();
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:600,height:300,right:600,bottom:300});
  api.editor.mockResolvedValue({photo:{width:W,height:H},classes,tags:[],readonly:'',approving:false,started_from:'from_scratch',
    shapes:[{kind:'sofa',mask:sofa},{kind:'sofa',points:[[60,40],[100,40],[100,70],[60,70]]}],detect:{sources:[source('sam3','polygons'),source('sam3-masks','masks')],preference:'sam3'}});
  api.comments.mockResolvedValue({comments:[]});api.detectPreference.mockResolvedValue({preference:'sam3'});api.saveLabel.mockResolvedValue({state:'draft'});
});
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());vi.restoreAllMocks();vi.unstubAllGlobals();});
function render(){const state={live:true,ref:'~902',canChangeClasses:true,classes:[],batches:[],images:[{id:'p1',name:'Synthetic room',state:'Unlabeled',tags:[],shapes:[],url:'data:image/png;base64,AA=='}]};
  const w=mount(AnnotationEditor,{props:{state},global:{stubs:{UiDialog:{props:['open'],template:'<div v-if="open"><slot/></div>'}}}});wrappers.push(w);return w;}
const button=(w,text)=>w.findAll('button').filter(b=>b.text().trim()===text).at(-1);
const key=(k,extra={})=>window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,...extra}));
const svg=w=>w.get('svg.annotation-overlay').element;
// Stage units (600 x 300) are photo pixels x 5 across and x 3.75 down for a 120 x 80 photo.
const at=(x,y)=>({clientX:x*5,clientY:y*300/H});
const fire=(w,type,x,y,extra={})=>svg(w).dispatchEvent(new MouseEvent(type,{button:0,bubbles:true,...at(x,y),...extra}));
const stroke=(w,from,to)=>{fire(w,'pointerdown',...from);fire(w,'pointermove',...to);fire(w,'pointerup',...to);};
const layers=async w=>{await button(w,'Layers').trigger('click');return w.findAll('.layer-name').map(b=>b.text());};
const saved=async w=>{await button(w,'Save draft').trigger('click');await flushPromises();return api.saveLabel.mock.calls.at(-1)[2].shapes;};

test('a mask from the server is drawn by the mask layer, listed in Layers, has no corner handles, and is saved back as it came', async()=>{
  const w=render();await flushPromises();
  expect(w.find('.canvas-stage .mask-layer').exists()).toBe(true);
  expect(w.findAll('polygon.shape')).toHaveLength(1);                     // the polygon only: the mask is not SVG
  expect(await layers(w)).toEqual(['sofa 24 points','sofa 1mask']);
  key('v');await flushPromises();
  expect(w.findAll('ellipse.vertex')).toHaveLength(4);                    // the polygon's corners; a mask has none
  const sent=await saved(w);
  expect(sent[0]).toEqual({kind:'sofa',mask:sofa});
  expect(sent[1].points).toEqual([[60,40],[100,40],[100,70],[60,70]]);
});

test('a click on a mask picks it: its class panel opens and Delete removes it', async()=>{
  const w=render();await flushPromises();
  key('v');await flushPromises();
  fire(w,'pointerdown',20,20);await flushPromises();
  expect(w.find('.class-pop').exists()).toBe(true);
  expect(w.get('.class-pop input').element.value).toBe('sofa');
  await button(w,'Delete').trigger('click');
  expect(await layers(w)).toEqual(['sofa 14 points']);
});

test('a Brush stroke paints a new mask of the chosen class as one step of Undo; the Eraser takes pixels away', async()=>{
  const w=render();await flushPromises();
  key('r');await flushPromises();
  expect(w.get('.editor-toolbar [aria-label="Brush (R)"]').attributes('aria-pressed')).toBe('true');
  expect(w.text()).toContain('Painting starts a new sofa mask.');
  fire(w,'pointermove',60,20);await flushPromises();
  expect(w.find('.brush-cursor').exists()).toBe(true);
  stroke(w,[60,15],[90,15]);await flushPromises();
  let names=await layers(w);
  expect(names).toEqual(['sofa 3mask','sofa 24 points','sofa 1mask']);
  // The new mask is selected: the next stroke adds to it, and the Eraser takes from it.
  key('e');await flushPromises();
  expect(w.get('.editor-toolbar [aria-label="Brush (R)"]').attributes('aria-pressed')).toBe('true');
  expect(w.text()).toContain('Erasing from the selected sofa mask.');
  const before=(await saved(w))[2].mask;
  stroke(w,[60,15],[62,15]);await flushPromises();
  const after=(await saved(w))[2].mask;
  expect(after.counts).not.toBe(before.counts);
  expect(decode(after).reduce((a,b)=>a+b,0)).toBeLessThan(decode(before).reduce((a,b)=>a+b,0));
  await w.get('.editor-toolbar [aria-label="Undo (Ctrl+Z)"]').trigger('click');
  expect((await saved(w))[2].mask).toEqual(before);                       // one stroke, one step
  await w.get('.editor-toolbar [aria-label="Undo (Ctrl+Z)"]').trigger('click');
  expect(await saved(w)).toHaveLength(2);                                 // the painted mask is gone
});

test('[ and ] change the brush size; Esc drops a stroke while it is drawn', async()=>{
  const w=render();await flushPromises();
  key('r');await flushPromises();
  const size=()=>Number(w.get('.brush-panel .sam-selection-heading span').text().replace(' px',''));
  const start=size();key(']');await flushPromises();expect(size()).toBeGreaterThan(start);
  key('[');key('[');await flushPromises();expect(size()).toBeLessThan(start);
  fire(w,'pointerdown',60,15);fire(w,'pointermove',90,15);key('Escape');fire(w,'pointerup',90,15);await flushPromises();
  expect(await layers(w)).toHaveLength(2);
});

test('a class with a wall geometry is never painted as a mask, and says why', async()=>{
  const w=render();await flushPromises();
  await w.get('[aria-label="Selected annotation class"]').setValue('wall');
  key('r');await flushPromises();
  stroke(w,[60,15],[90,15]);await flushPromises();
  expect(w.text()).toContain('A wall is a polygon with corners (its class is a wall), so it is not kept as a mask.');
  expect(await layers(w)).toHaveLength(2);
});

test('Convert to mask and Convert to polygon, each one step of Undo', async()=>{
  const w=render();await flushPromises();
  key('v');await flushPromises();
  await w.get('polygon.shape').trigger('pointerdown');
  await button(w,'Convert to mask').trigger('click');
  let sent=await saved(w);
  expect(sent[1].mask.size).toEqual([H,W]);expect(sent[1].points).toBeUndefined();
  expect(decode(sent[1].mask).reduce((a,b)=>a+b,0)).toBe(40*30);          // the polygon's 40 x 30 pixels
  // The mask from the server, as polygons: one per separate region, corners in photo pixels.
  fire(w,'pointerdown',20,20);await flushPromises();
  await button(w,'Convert to polygon').trigger('click');
  sent=await saved(w);
  const polygon=sent.find(s=>s.points);
  expect(polygon.points).toEqual(expect.arrayContaining([[10,10],[40,10],[40,30],[10,30]]));
  await w.get('.editor-toolbar [aria-label="Undo (Ctrl+Z)"]').trigger('click');
  sent=await saved(w);
  expect(sent.filter(s=>s.mask)).toHaveLength(2);
});

test('a Masks answer is shown on the mask layer and kept as masks; Polygons keeps the polygons of the same answer', async()=>{
  api.segmentPoint.mockResolvedValue({state:'ready',shapes:[{kind:'sofa',mask:rectMask(50,50,70,70)}],other:[{kind:'sofa',points:[[50,50],[70,50],[70,70],[50,70]]}]});
  const w=render();await flushPromises();
  key('s');await flushPromises();
  fire(w,'pointerdown',60,60);await flushPromises();
  expect(w.findAll('.sam-candidate polygon')).toHaveLength(1);           // Polygons chosen: the polygons of the answer
  await w.findAll('.sam-selection-panel .source-ways button').find(b=>b.text().includes('Masks')).trigger('click');
  expect(w.findAll('.sam-candidate polygon')).toHaveLength(0);
  expect(w.find('.mask-preview').exists()).toBe(true);
  key('Enter');await flushPromises();
  expect(api.segmentPoint).toHaveBeenCalledTimes(1);
  const sent=await saved(w);
  expect(sent.at(-1)).toEqual({kind:'sofa',mask:rectMask(50,50,70,70)});
});

test('AI refine on a mask takes the answer mask that best overlaps it, as one step of Undo', async()=>{
  const better=rectMask(12,10,42,30);
  api.detect.mockResolvedValue({state:'ready',name:'SAM 3 (Masks)',started_model:'sam3',tidy:false,
    shapes:[{kind:'sofa',mask:rectMask(80,50,110,75)},{kind:'sofa',mask:better},{kind:'plant',mask:sofa}],other:[{kind:'sofa',points:[[12,10],[42,10],[42,30],[12,30]]}]});
  const w=render();await flushPromises();
  key('v');await flushPromises();
  fire(w,'pointerdown',20,20);await flushPromises();
  key('f');await flushPromises();
  expect(api.detect).toHaveBeenCalledWith('~902','p1','sam3',['sofa','wall'],null);
  expect(w.text()).toContain('refined this sofa mask (88% the same pixels as yours)');
  let sent=await saved(w);
  expect(sent[0]).toEqual({kind:'sofa',mask:better});                    // the same place in the list, the same class
  await w.get('.editor-toolbar [aria-label="Undo (Ctrl+Z)"]').trigger('click');
  sent=await saved(w);
  expect(sent[0]).toEqual({kind:'sofa',mask:sofa});
});

test('AI refine on a mask fills a polygon answer at the photo size when the model gave only polygons', async()=>{
  api.detect.mockResolvedValue({state:'ready',name:'GPT-6.1 Terra',started_model:'sam3',tidy:false,shapes:[{kind:'sofa',points:[[10,12],[40,12],[40,30],[10,30]]}]});
  const w=render();await flushPromises();
  key('v');await flushPromises();
  fire(w,'pointerdown',20,20);await flushPromises();
  key('f');await flushPromises();
  const sent=await saved(w);
  expect(sent[0].mask).toEqual(rectMask(10,12,40,30));
});

test('AI refine on a mask changes nothing when no answer overlaps it enough, and says so', async()=>{
  api.detect.mockResolvedValue({state:'ready',name:'SAM 3 (Masks)',started_model:'sam3',tidy:false,shapes:[{kind:'sofa',mask:rectMask(80,50,110,75)},{kind:'plant',mask:sofa}]});
  const w=render();await flushPromises();
  key('v');await flushPromises();
  fire(w,'pointerdown',20,20);await flushPromises();
  key('f');await flushPromises();
  expect(w.text()).toContain('SAM 3 (Masks) found no sofa in the same place as this one. Nothing was changed.');
  expect((await saved(w))[0]).toEqual({kind:'sofa',mask:sofa});
  expect(w.get('.editor-toolbar [aria-label="Undo (Ctrl+Z)"]').attributes('aria-disabled')).toBe('true');
});
