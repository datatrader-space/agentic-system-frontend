// @vitest-environment jsdom
// The labeling editor's tools and panels (agentic-docs/LABEL_EDITOR_TOOLS_PLAN.md 2.2 to 2.6, contracts C2 to C7): the
// rail's keys, the hover cards, the crosshair, Rotate image, zoom at the pointer and its lock, the keyboard panel, Label
// Assist with its one-step Undo, the classes and layers panels, Add to Dataset and Send to Unannotated, Smart Select and
// Box to outline. Every fixture is synthetic.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AnnotationEditor from '../../training-data/src/components/AnnotationEditor.vue';
import { api } from '../../training-data/src/api/annotate.js';
vi.mock('../../training-data/src/api/annotate.js', async original=>({...(await original()),api:{editor:vi.fn(),comments:vi.fn(),segmentPoint:vi.fn(),saveLabel:vi.fn(),detect:vi.fn(),addClass:vi.fn(),updateClass:vi.fn(),detectPreference:vi.fn(),sendToUnannotated:vi.fn(),tag:vi.fn()}}));

const wrappers=[];
const classes=[{name:'chair',color:'#ef4444',description:'',geometry:''},{name:'plant',color:'#0ea5e9',description:'',geometry:''},{name:'lamp',color:'#84cc16',description:'',geometry:''}];
const initial=[{kind:'chair',points:[[100,100],[300,100],[300,300]]},{kind:'chair',points:[[700,100],[900,100],[900,300]]},{kind:'plant',points:[[100,500],[300,500],[300,700]]}];
const source=(id,extra)=>({id,where:[],detail:'Synthetic fixture',what:'',licence:'',research_only:false,...extra});
const sources=[
  source('sam3',{name:'SAM 3 (Polygons)',maker:'Meta',family:'SAM 3',labels:'polygons',platform:true,point_selection:true,tab:'ai',hosted:{state:'on',price:'$0.002 an image'}}),
  source('sam3-masks',{name:'SAM 3 (Masks)',maker:'Meta',family:'SAM 3',labels:'masks',platform:true,point_selection:true,tab:'ai',hosted:{state:'on',price:'$0.002 an image'}}),
  source('vision:terra',{name:'GPT-6.1 Terra',maker:'OpenAI',family:'GPT-6.1 Terra',labels:'polygons',platform:true,tab:'ai'}),
  source('m7',{name:'My chair model',maker:'My Models',family:'My chair model',labels:'polygons',trained_here:true,tab:'yours'}),
  source('pub1',{name:'Room objects',maker:'AADML',family:'Room objects',labels:'polygons',tab:'published'}),
];
const editorBody=(extra={})=>({photo:{width:1200,height:800},shapes:initial,classes,tags:[],readonly:'',approving:false,can_review:true,can_add_to_dataset:true,can_send_to_unannotated:true,label:{id:5,state:'draft'},
  detect:{sources,preference:'sam3'},started_from:'from_scratch',...extra});
beforeEach(()=>{
  vi.clearAllMocks();localStorage.clear();
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:600,height:300,right:600,bottom:300});
  api.editor.mockResolvedValue(editorBody());
  api.comments.mockResolvedValue({comments:[]});
  api.detectPreference.mockResolvedValue({preference:'sam3'});
  api.segmentPoint.mockResolvedValue({state:'ready',shapes:[{kind:'chair',points:[[500,300],[700,300],[700,500]]}],other:[{kind:'chair',mask:{size:[800,1200],counts:'PPYo1'}}]});
});
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
function render(extra={}){const state={live:true,ref:'~901',canChangeClasses:true,classes:[],batches:[{id:'a1',kind:'assignment',name:'Batch 1'}],
  images:[{id:'image-1',batchId:'a1',name:'Synthetic photo 1',state:'Unlabeled',tags:[],shapes:[],url:'data:image/png;base64,AA=='},{id:'image-2',batchId:'a1',name:'Synthetic photo 2',state:'Unlabeled',tags:[],shapes:[],url:'data:image/png;base64,AA=='}],...extra};
  const w=mount(AnnotationEditor,{props:{state},global:{stubs:{UiDialog:{props:['open','title'],template:'<div v-if="open" class="stub-dialog"><slot/></div>'}}}});wrappers.push(w);return w;}
const button=(w,text)=>w.findAll('button').filter(b=>b.text().trim()===text).at(-1);
const key=(k,extra={})=>window.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,...extra}));
const overlay=w=>w.get('svg.annotation-overlay').element;
const press=(w,x,y,extra={})=>overlay(w).dispatchEvent(new MouseEvent('pointerdown',{button:0,clientX:x,clientY:y,bubbles:true,...extra}));
const rail=(w,label)=>w.get(`.editor-toolbar [aria-label="${label}"]`);
const layerRows=async w=>{await button(w,'Layers').trigger('click');return w.findAll('.layer-row');};

test('every rail key chooses its tool or runs its action', async()=>{
  const w=render();await flushPromises();
  for(const [k,label] of [['b','Box (B)'],['p','Polygon (P)'],['/','Split (/)'],['h','Pan (H)'],['v','Select (V)'],['s','Smart Select (S)'],['o','Box to outline (O)']]){
    key(k);await flushPromises();expect(rail(w,label).attributes('aria-pressed'),label).toBe('true');}
  key('R',{shiftKey:true});await flushPromises();
  expect(w.get('.canvas-stage').attributes('style')).toContain('rotate(90deg)');
  key('n');await flushPromises();expect(rail(w,'No objects (N)').attributes('aria-pressed')).toBe('true');
  key('c');await flushPromises();expect(w.find('#editor-comment').exists()).toBe(true);
  key('l');await flushPromises();expect(w.text()).toContain('A model labels the classes you tick in this photo.');
});

test('a hover card opens after 400 ms, says the tool, its key and its article, and closes on leave and on Esc; not on touch', async()=>{
  const w=render();await flushPromises();vi.useFakeTimers();
  const box=rail(w,'Box (B)');
  await box.trigger('pointerenter');vi.advanceTimersByTime(399);await flushPromises();
  expect(w.find('#tool-card').exists()).toBe(false);
  vi.advanceTimersByTime(1);await flushPromises();
  const card=w.get('#tool-card');
  expect(card.text()).toContain('Box');expect(card.get('kbd').text()).toBe('B');
  expect(card.text()).toContain('Click one corner, then the opposite one, or drag across the object.');
  expect(card.get('a').attributes('href')).toBe('/dashboard/help-center/article/label-editor-box');
  expect(card.find('svg.tool-art').exists()).toBe(true);
  expect(box.attributes('aria-describedby')).toBe('tool-card');
  await box.trigger('pointerleave');vi.advanceTimersByTime(200);await flushPromises();
  expect(w.find('#tool-card').exists()).toBe(false);
  await box.trigger('pointerenter');vi.advanceTimersByTime(400);await flushPromises();
  expect(w.find('#tool-card').exists()).toBe(true);
  key('Escape');await flushPromises();
  expect(w.find('#tool-card').exists()).toBe(false);
  const touch=new MouseEvent('pointerenter');Object.defineProperty(touch,'pointerType',{value:'touch'});
  box.element.dispatchEvent(touch);vi.advanceTimersByTime(1000);await flushPromises();
  expect(w.find('#tool-card').exists()).toBe(false);
});

test('keyboard focus opens the card at once and blur closes it; a tool that cannot be used says why in its card', async()=>{
  api.editor.mockResolvedValue(editorBody({detect:{sources:sources.map(s=>({...s,point_selection:false})),preference:'sam3'}}));
  const w=render();await flushPromises();
  key('Tab');
  await rail(w,'Polygon (P)').trigger('focus');
  expect(w.get('#tool-card').text()).toContain('Polygon');
  await rail(w,'Polygon (P)').trigger('blur');
  expect(w.find('#tool-card').exists()).toBe(false);
  key('Tab');await rail(w,'Smart Select (S)').trigger('focus');
  expect(w.get('#tool-card').text()).toContain('Smart Select is not available yet');
  await rail(w,'Smart Select (S)').trigger('click');
  expect(w.find('.sam-selection-panel').exists()).toBe(false);
  // A pointer press ends keyboard mode: a focus after a click shows no card.
  window.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));
  await rail(w,'Box (B)').trigger('focus');
  expect(w.find('#tool-card').exists()).toBe(false);
});

test('the crosshair spans the canvas and follows the pointer, only for the drawing tools', async()=>{
  const w=render();await flushPromises();
  const area=w.get('.canvas-scroll');
  key('b');await flushPromises();
  area.element.dispatchEvent(new MouseEvent('pointermove',{clientX:120,clientY:80,bubbles:true}));await flushPromises();
  expect(w.get('.crosshair-x').attributes('style')).toContain('top: 80px');
  expect(w.get('.crosshair-y').attributes('style')).toContain('left: 120px');
  area.element.dispatchEvent(new MouseEvent('pointerleave'));await flushPromises();
  expect(w.find('.crosshair').exists()).toBe(false);
  key('v');await flushPromises();
  area.element.dispatchEvent(new MouseEvent('pointermove',{clientX:120,clientY:80,bubbles:true}));await flushPromises();
  expect(w.find('.crosshair').exists()).toBe(false);
});

test('with the view turned a quarter, a box is drawn where it is seen and saved in the photo\'s own pixels', async()=>{
  api.saveLabel.mockResolvedValue({state:'draft'});
  const w=render();await flushPromises();
  await rail(w,'Rotate image (Shift+R)').trigger('click');await flushPromises();
  key('b');await flushPromises();
  press(w,150,150);await flushPromises();     // a quarter of the way across, half way down the turned photo
  press(w,450,75);await flushPromises();
  await button(w,'Save (Enter)').trigger('click');
  await button(w,'Save draft').trigger('click');await flushPromises();
  const sent=api.saveLabel.mock.calls[0][2].shapes.at(-1);
  expect(sent.kind).toBe('chair');
  expect(sent.points).toEqual(expect.arrayContaining([[300,200],[600,600]]));
  expect(sent.points).toHaveLength(4);
});

test('zoom: the buttons, Ctrl+wheel at the pointer, and the lock that keeps zoom and position for the next photo', async()=>{
  const w=render();await flushPromises();
  const zoom=()=>w.get('output.zoom-value').text();
  expect(zoom()).toBe('100%');
  await w.get('[aria-label="Zoom in (+)"]').trigger('click');expect(zoom()).toBe('125%');
  w.get('.canvas-scroll').element.dispatchEvent(new WheelEvent('wheel',{ctrlKey:true,deltaY:-200,clientX:100,clientY:40,bubbles:true,cancelable:true}));await flushPromises();
  expect(Number(zoom().replace('%',''))).toBeGreaterThan(125);
  expect(w.get('.canvas-rotor').attributes('style')).not.toContain('translate(0px,0px)');   // moved so the point stays under the pointer
  const locked=zoom();
  await w.get('[aria-label="Keep zoom and position for the next photo"]').trigger('click');
  await button(w,'→').trigger('click');await flushPromises();
  expect(zoom()).toBe(locked);
  await w.get('[aria-label="Zoom and position are kept for the next photo"]').trigger('click');
  await button(w,'←').trigger('click');await flushPromises();
  expect(zoom()).toBe('100%');
  expect(w.get('.canvas-rotor').attributes('style')).toContain('translate(0px,0px)');
});

test('brightness and contrast are in a popover over the photo only; the keyboard panel lists every key by group', async()=>{
  const w=render();await flushPromises();
  await w.get('[aria-label="Brightness and contrast"]').trigger('click');
  await w.get('input[aria-label="Contrast"]').setValue(140);
  expect(w.get('.canvas-stage img').attributes('style')).toContain('contrast(140%)');
  expect(w.get('.canvas-stage').attributes('style')).not.toContain('contrast');
  window.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));await flushPromises();
  expect(w.find('#tone-pop').exists()).toBe(false);
  await w.get('[aria-label="Keyboard shortcuts"]').trigger('click');
  expect(w.findAll('.keys-groups h3').map(h=>h.text())).toEqual(['Tools','View','Shapes','Review']);
  expect(w.text()).toContain('Rotate the view a quarter turn');
  expect(w.get('.keys-groups a[aria-label="Learn more: Smart Select"]').attributes('href')).toBe('/dashboard/help-center/article/label-editor-smart-select');
});

test('Label Assist: tabs by the source\'s tab, ticked classes asked through the same detect call, shown dashed, and Undo in one step', async()=>{
  api.updateClass.mockResolvedValue({classes:classes.map(c=>c.name==='chair'?{...c,description:'only armchairs'}:c)});
  api.detect.mockResolvedValue({state:'ready',name:'SAM 3 (Polygons)',started_model:'sam3',tidy:false,
    shapes:[{kind:'chair',points:[[400,400],[600,400],[600,600]],score:0.9}],other:[{kind:'chair',mask:{size:[800,1200],counts:'PPYo1'},score:0.9}]});
  const w=render();await flushPromises();
  await button(w,'Label Assist').trigger('click');
  const tabs=w.findAll('[role="tab"]');
  // Counted as the picker's rows: SAM 3 (its Polygons and Masks are one model) and GPT-6.1 Terra.
  expect(tabs.map(t=>t.text())).toEqual(['AI models 2','Your models 1','Published models 1']);
  expect(tabs[0].attributes('aria-selected')).toBe('true');
  await tabs[1].trigger('click');expect(w.get('.assist-panel').text()).toContain('My chair model');
  await tabs[0].trigger('click');expect(w.get('.assist-panel').text()).toContain('GPT-6.1 Terra');
  expect(w.text()).toContain('$0.002 an image, paid from your balance.');
  const chip=name=>w.findAll('.assist-chip').find(c=>c.text().includes(name));
  expect(['chair','plant','lamp'].map(n=>chip(n).attributes('aria-pressed'))).toEqual(['true','true','true']);
  await chip('lamp').trigger('click');
  await button(w,'Describe the classes (optional)').trigger('click');
  await w.get('#assist-describe-chair').setValue('only armchairs');
  await button(w,'Label with AI').trigger('click');await flushPromises();
  expect(api.updateClass).toHaveBeenCalledWith('~901','chair',{description:'only armchairs'});
  expect(api.detect).toHaveBeenCalledWith('~901','image-1','sam3',['chair','plant'],null);
  expect(w.get('.find-card').text()).toContain('Label Assist');
  expect(w.get('.find-count').text()).toBe('Found 1 object: 1 chair');
  expect(w.findAll('.find-preview polygon')).toHaveLength(1);
  expect(w.get('.find-preview polygon').attributes('stroke-dasharray')).toBe('6 4');
  expect(api.saveLabel).not.toHaveBeenCalled();
  await button(w,'Save (1)').trigger('click');
  expect(w.get('.applied-note').text()).toBe('Applied 1 label · Undo');
  expect(await layerRows(w)).toHaveLength(4);
  await w.get('.applied-note button').trigger('click');
  expect(w.findAll('.layer-row')).toHaveLength(3);
  expect(w.find('.applied-note').exists()).toBe(false);
  expect(JSON.parse(localStorage.getItem('aadml.autolabel.skipped.~901'))).toEqual(['lamp']);   // the ticks are kept, as Auto Label keeps them
});

test('Find Objects with AI stays reachable from Label Assist', async()=>{
  const w=render();await flushPromises();
  key('l');await flushPromises();
  await button(w,'Find one object by name instead').trigger('click');await flushPromises();
  expect(w.find('#find-class-name').exists()).toBe(true);
});

test('the Classes tab counts the classes in this photo, lists the unused ones, and each AI button asks for that class alone', async()=>{
  api.detect.mockResolvedValue({state:'ready',name:'SAM 3 (Polygons)',started_model:'sam3',tidy:false,shapes:[]});
  const w=render();await flushPromises();
  const sections=w.findAll('.class-use');
  expect(sections[0].text()).toContain('In this photo');
  expect(sections[0].findAll('li').map(l=>l.text())).toEqual(['chair2','plant1']);
  expect(sections[1].text()).toContain('Unused classes');
  expect(sections[1].findAll('li').map(l=>l.text())).toEqual(['lamp']);
  await w.get('[aria-label="Label lamp with AI"]').trigger('click');
  expect(w.text()).toContain('A model labels every lamp in this photo.');
  expect(w.findAll('.assist-chip[aria-pressed="true"]').map(c=>c.text())).toEqual(['lamp']);
  await button(w,'Label with AI').trigger('click');await flushPromises();
  expect(api.detect).toHaveBeenCalledWith('~901','image-1','sam3',['lamp'],null);
  expect(w.get('.find-count').text()).toBe('No lamp was found in this photo');
  expect(localStorage.getItem('aadml.autolabel.skipped.~901')).toBe(null);   // one class alone does not change the project's ticks
});

test('Layers: every shape top first, hide, lock and move one place, each move one step of Undo', async()=>{
  const w=render();await flushPromises();
  const rows=await layerRows(w);
  expect(rows.map(r=>r.get('.layer-name').text())).toEqual(['plant 33 points','chair 23 points','chair 13 points']);
  await w.get('[aria-label="Hide plant 3"]').trigger('click');
  expect(w.findAll('polygon.shape')).toHaveLength(2);
  await w.get('[aria-label="Show plant 3"]').trigger('click');
  expect(w.findAll('polygon.shape')).toHaveLength(3);
  await w.get('[aria-label="Lock chair 1"]').trigger('click');
  expect(w.get('[aria-label="Unlock chair 1"]').attributes('aria-pressed')).toBe('true');
  expect(w.get('[aria-label="Move plant 3 up"]').attributes('disabled')).toBeDefined();
  await w.get('[aria-label="Move plant 3 down"]').trigger('click');
  expect(w.findAll('.layer-name').map(r=>r.text())).toEqual(['chair 33 points','plant 23 points','chair 13 points']);
  await rail(w,'Undo (Ctrl+Z)').trigger('click');
  expect(w.findAll('.layer-name').map(r=>r.text())).toEqual(['plant 33 points','chair 23 points','chair 13 points']);
});

test('Add to Dataset: asked first, saved and approved in one step; a refusal is shown in the server\'s words', async()=>{
  api.saveLabel.mockRejectedValueOnce(new Error('Only a person who may approve adds a photo to the dataset.'));
  const w=render();await flushPromises();
  await button(w,'Add to Dataset').trigger('click');
  expect(w.text()).toContain('The label is saved and approved in one step, with the same checks as Approve.');
  expect(api.saveLabel).not.toHaveBeenCalled();
  await button(w,'Add to Dataset').trigger('click');await flushPromises();
  expect(w.get('.stub-dialog .field-error').text()).toBe('Only a person who may approve adds a photo to the dataset.');
  // Kept as a draft when it has a fault: the server's words, and the dialog stays.
  api.saveLabel.mockResolvedValueOnce({ok:true,approved:false,state:'draft',refused_done:true,faults:[{message:'chair 2 crosses the photo edge'}],message:'Saved as a draft.'});
  await button(w,'Add to Dataset').trigger('click');await flushPromises();
  expect(w.get('.stub-dialog .field-error').text()).toBe('Kept as a draft, not added. The checks found: chair 2 crosses the photo edge');
  api.saveLabel.mockResolvedValueOnce({ok:true,approved:true,state:'accepted',message:'Added to the dataset: the label is finished and approved.'});
  await button(w,'Add to Dataset').trigger('click');await flushPromises();
  const body=api.saveLabel.mock.calls.at(-1)[2];
  expect(body.action).toBe('add_to_dataset');expect(body.shapes).toHaveLength(3);expect(body.review).toBeUndefined();
  expect(w.props('state').images[0].state).toBe('Accepted');
  expect(w.text()).toContain('Added to the dataset: the label is finished and approved. On to the next photo.');
});

test('each action is offered only when the server says this person may (can_add_to_dataset, can_send_to_unannotated)', async()=>{
  api.editor.mockResolvedValue(editorBody({can_add_to_dataset:false}));
  const w=render();await flushPromises();
  expect(button(w,'Add to Dataset')).toBeUndefined();
  expect(button(w,'Send to Unannotated')).toBeDefined();
  api.editor.mockResolvedValue(editorBody({can_send_to_unannotated:false}));
  const v=render();await flushPromises();
  expect(button(v,'Send to Unannotated')).toBeUndefined();
  expect(button(v,'Add to Dataset')).toBeDefined();
});

test('Send to Unannotated: asked first; the photo leaves the batch; a refusal is shown in the server\'s words', async()=>{
  api.sendToUnannotated.mockRejectedValueOnce(new Error('This photo is not in an open batch of yours.'));
  const w=render();await flushPromises();
  await button(w,'Send to Unannotated').trigger('click');
  expect(w.text()).toContain('The photo leaves this batch and waits again with the board\'s unassigned photos. Your draft label is kept.');
  await button(w,'Send to Unannotated').trigger('click');await flushPromises();
  expect(w.get('.stub-dialog .field-error').text()).toBe('This photo is not in an open batch of yours.');
  api.sendToUnannotated.mockResolvedValueOnce({photo:'image-1',assignment:{number:3},closed:false,accepted:false,label:{id:5,state:'draft'}});
  await button(w,'Send to Unannotated').trigger('click');await flushPromises();
  expect(api.sendToUnannotated).toHaveBeenLastCalledWith('~901','image-1');
  expect(w.props('state').images.map(i=>i.id)).toEqual(['image-2']);
  expect(w.get('.editor-header strong').text()).toBe('Synthetic photo 2');
  expect(w.text()).toContain('Sent to Unannotated: the photo waits with the unassigned photos, its draft kept.');
  expect(api.saveLabel).not.toHaveBeenCalled();   // nothing unsaved: the draft on the server is kept as it is
  expect(w.emitted('close')).toBeUndefined();
});

test('Send to Unannotated goes back to the batch when the batch closed', async()=>{
  api.sendToUnannotated.mockResolvedValueOnce({photo:'image-1',assignment:{number:3},closed:true,accepted:false,label:null});
  const w=render();await flushPromises();
  await button(w,'Send to Unannotated').trigger('click');
  await button(w,'Send to Unannotated').trigger('click');await flushPromises();
  expect(w.emitted('close')).toHaveLength(1);
});

test('Smart Select: click adds, Shift-click and right-click remove, Esc drops, Enter keeps the way chosen', async()=>{
  const w=render();await flushPromises();
  key('s');await flushPromises();
  press(w,300,150);await flushPromises();
  expect(api.segmentPoint).toHaveBeenLastCalledWith('~901','image-1','chair',{coords:[[600,400]],labels:[1]});
  press(w,330,150,{shiftKey:true});await flushPromises();
  expect(api.segmentPoint).toHaveBeenLastCalledWith('~901','image-1','chair',{coords:[[600,400],[660,400]],labels:[1,0]});
  press(w,360,150,{button:2});await flushPromises();
  expect(api.segmentPoint).toHaveBeenLastCalledWith('~901','image-1','chair',{coords:[[600,400],[660,400],[720,400]],labels:[1,0,0]});
  expect(w.findAll('.sam-candidate polygon')).toHaveLength(1);
  key('Escape');await flushPromises();
  expect(w.findAll('.sam-candidate polygon')).toHaveLength(0);expect(w.findAll('.sam-candidate ellipse')).toHaveLength(0);
  expect(await layerRows(w)).toHaveLength(3);
  press(w,300,150);await flushPromises();
  key('Enter');await flushPromises();
  expect(w.findAll('.layer-row')).toHaveLength(4);
  expect(w.findAll('.layer-name')[0].text()).toContain('3 points');
  // Masks: the same answer's mask (``other``) is kept, without asking again.
  press(w,300,150);await flushPromises();const asked=api.segmentPoint.mock.calls.length;
  await w.findAll('.sam-selection-panel .source-ways button').find(b=>b.text().includes('Masks')).trigger('click');
  key('Enter');await flushPromises();
  expect(api.segmentPoint.mock.calls.length).toBe(asked);
  expect(w.findAll('.layer-name')[0].text()).toContain('mask');
  expect(api.saveLabel).not.toHaveBeenCalled();
});

test('Box to outline sends the drawn box in photo pixels and no points', async()=>{
  const w=render();await flushPromises();
  key('o');await flushPromises();
  press(w,400,200);await flushPromises();
  press(w,500,280);await flushPromises();
  expect(api.segmentPoint).toHaveBeenCalledTimes(1);
  expect(api.segmentPoint).toHaveBeenLastCalledWith('~901','image-1','chair',{coords:[],labels:[]},[800,533.3333333333334,1000,746.6666666666666]);
  expect(w.findAll('.sam-candidate polygon')).toHaveLength(1);
  key('Enter');await flushPromises();
  expect(await layerRows(w)).toHaveLength(4);
});
