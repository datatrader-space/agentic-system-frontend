<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowLeft, MousePointer2, Pentagon, Square, Undo2, Redo2, Plus, Minus, Check, X, Trash2, Eye, EyeOff, Save, MessageSquare, Hand, Brush, RotateCw, WandSparkles, Sparkles, CircleOff, Scissors, Keyboard, List, History, Code, ClipboardList, Tags, MousePointerClick, SquareDashedMousePointer, Eraser, Lock, LockOpen, ChevronUp, ChevronDown, SunMedium, Database, Inbox, ExternalLink } from 'lucide-vue-next';
import UiButton from './UiButton.vue';
import UiBadge from './UiBadge.vue';
import UiDialog from './UiDialog.vue';
import RoomArt from './RoomArt.vue';
import ModelSourcePicker from './ModelSourcePicker.vue';
import AnswerWays from './AnswerWays.vue';
import ToolHoverCard from './ToolHoverCard.vue';
import LabelAssistDialog from './LabelAssistDialog.vue';
import MaskLayer from './MaskLayer.vue';
import BrushCursor from './BrushCursor.vue';
import { useBrush, stageToPhoto, MAX_BRUSH } from '../useBrush.js';
import { useSamSelection } from '../useSamSelection.js';
import { aboutOf, fillOpacityOf, labelsOfId, reasonOnly, startsServer } from '../sourceFamilies.js';
import { batchColumn } from '../previewState.js';
import { api as liveApi, fromBackend, toBackend, toUnits, toPixels, classesOf, askedClasses, keepAskedClasses, takenBackWords, rolesOf, geometryOf, nextClassColor } from '../api/annotate.js';
import { split as splitShape, contains, crosses, box as boxCorners, tidyUp, whole, corners as cornersOf, bestMatch } from '../geometry.js';
import { RAIL, KEY_GROUPS, CROSSHAIR_TOOLS, helpArticle, keyAction, unrotate, viewSize, clampZoom, wheelZoom, zoomAt, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, classUse, moveLayer, pickWay, appliedWords, isMask, maskHas, bestMaskMatch, maskRefusal, polygonToMask, maskToRegions } from '../editorTools.js';
const props = defineProps({ state: Object, batchId: String }); const emit = defineEmits(['close']);
const scopedImages = computed(()=>props.batchId?props.state.images.filter(i=>i.batchId===props.batchId):props.state.images);
const index = ref(Math.max(0,scopedImages.value.findIndex(i=>i.id===props.state.selectedImage)));
const item = computed(()=>scopedImages.value[index.value]);
const shapes = ref(structuredCloneRaw(item.value?.shapes || []));
function structuredCloneRaw(value){return JSON.parse(JSON.stringify(value));}
const selected = ref(null); const tool = ref('select'); const kind = ref(props.state.classes[0]?.name || ''); const corner = ref('room'); const draft = ref([]);
const zoom = ref(100); const brightness = ref(100); const overlays = ref(true); const panel = ref('Labels'); const tag = ref(''); const comment = ref(''); const comments = ref([]);
const history = ref([]); const future = ref([]); const dirty = ref(false); const status = ref('Local preview'); const leaving = ref(false); const pendingIndex = ref(null); const empty = ref(!!item.value?.noObjects);
const canvas = ref(null); let moving = null; let panStart = null;
const layerTab=ref('Classes');const toolDialog=ref('');const pan=ref({x:0,y:0});const aspect=ref(2);
// The view (LABEL_EDITOR_TOOLS_PLAN.md 2.5): contrast beside brightness, the quarter turns of Rotate image (the view
// only: labels stay in the photo's coordinates), and the lock that keeps zoom and position for the next photo.
const contrast=ref(100);const rotation=ref(0);const viewLock=ref(false);const toneOpen=ref(false);const keysOpen=ref(false);
// Layers: hidden and locked shapes, for this editing session (not part of the label).
const hiddenIds=ref(new Set());const lockedIds=ref(new Set());
const panelItems=[{name:'Labels',icon:Tags},{name:'Attributes',icon:List},{name:'Comments',icon:MessageSquare},{name:'History',icon:History},{name:'Raw data',icon:Code},{name:'Job details',icon:ClipboardList}];
// Live (a real project): the photo, its label and what this person may do come from the backend (api/annotate.js).
// The drawing stays in 600 × 300 units; it is converted to photo pixels exactly when it is saved. A mask (contract C2)
// stays in photo pixels.
const live=computed(()=>!!props.state.live);const meta=ref(null);const reasonOpen=ref(false);const reason=ref('');const busy=ref(false);
// SAM 3 is a ready-to-use model AADML hosts (FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md section 10): nobody chooses where it
// runs, and each answer is charged as one image. While AADML is not running it, its ``unavailable`` says so. Its two
// ways (Polygons, Masks) are one family: the switch under the picker chooses which part of the answer is kept.
const samModel=ref('sam3');
const samSources=computed(()=>(meta.value?.detect?.sources||[]).filter(s=>s.id==='sam3'||s.id==='sam3-masks').sort((a,b)=>(a.id==='sam3'?0:1)-(b.id==='sam3'?0:1)));
const samPrice=computed(()=>samSources.value[0]?.hosted?.price||'');
const samPointUnavailable=computed(()=>samSources.value[0]?.point_selection!==true);
const samBlocked=computed(()=>samPointUnavailable.value||!live.value||!meta.value?.detect||!!meta.value?.readonly||!!meta.value?.approving||!samSources.value.length||!!samSources.value[0].unavailable);
// Why Smart Select and Box to outline cannot be used on this photo now ('' when they can), in words.
const SMART_OFF='Smart Select is not available yet: the SAM 3 that AADML runs now takes no clicks or boxes. Label Assist, Find Objects with AI and drawing by hand work.';
const smartOff=computed(()=>!live.value?'Smart Select works on a project photo.':meta.value?.readonly?meta.value.readonly:meta.value?.approving?'This label waits for approval: a model does not draw on it here.'
  :!meta.value?.detect||!samSources.value.length?'SAM 3 is not offered for this photo.':samSources.value[0].unavailable?reasonOnly(samSources.value[0].unavailable):samPointUnavailable.value?SMART_OFF:'');
const sam = useSamSelection(()=>({project:props.state.ref,photo:item.value?.id,name:kind.value,width:meta.value?.photo.width,height:meta.value?.photo.height,
  allowed:!samBlocked.value,why:samSources.value[0]?.unavailable||''}), (...args)=>liveApi.segmentPoint(...args));
const {points:samPoints,box:samBox,candidate:samCandidate,other:samOther,working:samBusy,message:samMessage,clear:clearSam}=sam;
const samPointMode=ref(1);
// The answer the way the switch says (contract C4: ``shapes`` and ``other`` are the same object as a mask and as polygons).
const smartWay=computed(()=>labelsOfId(samSources.value,samModel.value));
const samKept=computed(()=>meta.value?fromBackend(pickWay(samCandidate.value,samOther.value,smartWay.value),meta.value.photo.width,meta.value.photo.height):[]);
// A mask candidate is drawn by the preview MaskLayer; the SVG draws the polygon candidates.
const samPreview=computed(()=>samKept.value.filter(s=>s.points));
const samMissingWay=computed(()=>!samBusy.value&&!samKept.value.length&&(samCandidate.value.length+samOther.value.length)>0);
function addSamPoint(at,label){sam.add(at,label===0?0:samPointMode.value);}
function applySam(){if(!samKept.value.length||samBusy.value||samBlocked.value)return;const refused=samKept.value.find(s=>s.mask&&maskOff(s.kind));if(refused){hint.value=`${maskOff(refused.kind)} Choose Polygons to keep it.`;return;}remember();
  const added=samKept.value.map((s,i)=>({...s,id:`sam-${Date.now()}-${i}`}));
  shapes.value.push(...added);selected.value=added[0]?.id;empty.value=false;meta.value.started_from='from_ai';meta.value.started_model=samModel.value;clearSam();hint.value='SAM 3 outline kept as a draft. Adjust it or Undo; saving and review are separate.';}
// Brush and Eraser (2.1, part D's useBrush.js): strokes in the photo's own pixels on the selected mask, or on a new mask
// of the chosen class; each stroke is one step of the editor's own Undo (the brush's own history is not used). A class
// whose geometry is a wall, a window or a door is drawn as polygons, never painted (maskRefusal).
const brush=useBrush({photo:()=>meta.value?{width:meta.value.photo.width,height:meta.value.photo.height}:null});
const {size:brushSize,live:brushLive}=brush;const brushPoint=ref(null);
const brushMax=computed(()=>Math.max(1,Math.min(MAX_BRUSH,Math.max(meta.value?.photo.width||0,meta.value?.photo.height||0)||MAX_BRUSH)));
function maskOff(name){return maskRefusal(geometryOf(roles.value,name),name);}
const brushOff=computed(()=>!live.value?'Brush and Eraser work on a project photo.':!meta.value?'The photo is still loading.':meta.value.readonly?meta.value.readonly
  :meta.value.approving?'This label waits for approval: it is not painted on here.':'');
const brushTarget=computed(()=>shapes.value.find(sh=>sh.id===selected.value&&sh.mask)||null);
const editorClassOpen=ref(false),editorClassName=ref(''),editorClassError=ref('');
// A class added from the editor (its "Add class" and Label Assist's): the next palette colour no class has, through the
// Classes API (its role and lock checks). Answers the added name; a refusal throws the server's words.
async function addProjectClass(name){const body=await liveApi.addClass(props.state.ref,{name,color:nextClassColor(props.state.classes)});props.state.classes=classesOf(body.classes);return body.added;}
async function addEditorClass(){editorClassError.value='';try{kind.value=await addProjectClass(editorClassName.value);editorClassOpen.value=false;editorClassName.value='';}catch(e){editorClassError.value=e.message;}}
watch(()=>props.state.classes.map(c=>c.name),names=>{if(!names.includes(kind.value))kind.value=names[0]||'';},{immediate:true});
watch(kind,clearSam);
// What each class is in FitMyWall's walls format (its geometry, set on the Classes page): a wall gets corner types, the
// tidy-up and the wall-first cut; an opening is brought inside its wall. Never decided by a class's name.
const roles=computed(()=>rolesOf(props.state.classes));const isWall=sh=>geometryOf(roles.value,sh.kind)==='wall';
function liveState(s){return s==='accepted'?'Accepted':s==='done'?'In review':'Unlabeled';}
async function fetchEditor(){if(!live.value||!item.value)return;const it=item.value;const review=props.state.can?.batch&&it.state==='In review'&&it.label?it.label:null;status.value='Loading…';
  try{const body=await liveApi.editor(props.state.ref,it.id,review);if(item.value!==it)return;meta.value=body;if(body.classes)props.state.classes=classesOf(body.classes);const W=body.photo.width,H=body.photo.height;aspect.value=W/H;shapes.value=fromBackend(body.shapes,W,H);
    empty.value=!!(body.label&&body.label.state!=='draft'&&!body.shapes.length);it.tags=body.tags;history.value=[];future.value=[];dirty.value=!!body.unsaved;
    status.value=body.readonly||(body.approving?'Review: approve, correct, or request changes':body.label?`Label: ${body.label.state}`:'Not labelled yet');
    comments.value=(await liveApi.comments(props.state.ref,it.id)).comments;
    // A photo nobody has drawn on, with a model chosen (Auto Label's "Label Batch", or "Save my choice"): nothing is asked
    // of the model when the photo opens (e6e32a1c: a model costs money and runs only when the person asks), so the
    // editor says how to get its shapes.
    const auto=body.detect?.auto&&body.detect.sources?.find(x=>x.id===body.detect.auto);if(auto&&!body.shapes.length&&!hint.value)hint.value=`To start from what ${auto.name} finds, press Label Assist (L), or Find Objects with AI (M).`;}catch(e){status.value=e.message;}}
async function saveLive(review){if(meta.value?.readonly){status.value=meta.value.readonly;return;}const W=meta.value.photo.width,H=meta.value.photo.height;busy.value=true;
  try{const body=await liveApi.saveLabel(props.state.ref,item.value.id,{shapes:toBackend(shapes.value,W,H,roles.value),action:review?'done':'save',started_from:meta.value.started_from,started_model:meta.value.started_model,nothing_to_mark:empty.value&&!shapes.value.length});
    item.value.state=liveState(body.state);item.value.labelled=body.state==='done';dirty.value=false;
    status.value=body.faults?.length?`Saved as a draft. The checks found: ${body.faults.map(f=>f.message).join('; ')}`:(body.message||(review?(body.refused_done?'Saved as a draft.':'Finished: sent to review'):'Draft saved'));
    const it=item.value;liveApi.editor(props.state.ref,it.id).then(b=>{if(item.value===it&&meta.value)meta.value.history=b.history;}).catch(()=>{});   // the History panel shows this save too
    if(review&&body.state==='done'&&!body.refused_done&&index.value<scopedImages.value.length-1)load(index.value+1);}   // sent: on to the next photo
  catch(e){status.value=e.message;}finally{busy.value=false;}}
async function reviewLive(accepted){if(!meta.value?.approving){status.value=props.state.can?.batch?'Only a finished label waiting for approval can be approved or sent back.':'Only a person who may approve reviews labels.';return;}
  if(!accepted){reason.value='';reasonOpen.value=true;return;}const W=meta.value.photo.width,H=meta.value.photo.height;busy.value=true;
  try{const body=await liveApi.saveLabel(props.state.ref,item.value.id,{action:'approve',review:meta.value.review,shapes:toBackend(shapes.value,W,H,roles.value),nothing_to_mark:empty.value&&!shapes.value.length});
    if(body.approved===false){status.value=body.message||'Not approved.';return;}item.value.state='Accepted';item.value.labelled=true;dirty.value=false;meta.value.approving=false;status.value=body.message||'Approved.';}
  catch(e){status.value=e.message;}finally{busy.value=false;}}
async function sendBackLive(){if(!reason.value.trim())return;busy.value=true;
  try{await liveApi.sendBack(props.state.ref,meta.value.review,reason.value.trim());reasonOpen.value=false;item.value.state='Unlabeled';item.value.labelled=false;meta.value.approving=false;status.value='Sent back to the labeller with your reason.';comments.value=(await liveApi.comments(props.state.ref,item.value.id)).comments;}
  catch(e){status.value=e.message;}finally{busy.value=false;}}
// Taking an approval back (ADM-1210 §3.7, decision D6), for a person who may approve: the label is finished again and
// waits in the review queue. The versions that hold the photo keep the label they froze; the dialog names them first.
const takeBackOpen=ref(false);const takeBackError=ref('');
const mayTakeBack=computed(()=>!!(live.value&&meta.value?.can_review&&meta.value?.label?.state==='accepted'));
async function takeBackLive(){if(!mayTakeBack.value)return;busy.value=true;takeBackError.value='';
  try{const body=await liveApi.takeBack(props.state.ref,meta.value.label.id);takeBackOpen.value=false;item.value.state='In review';item.value.labelled=true;item.value.labelState='done';await fetchEditor();status.value=takenBackWords(body);}
  catch(e){takeBackError.value=e.message;}finally{busy.value=false;}}
// Add to Dataset (contract C7a) and Send to Unannotated (C7b), each asked first in the app's own dialog. The server
// decides who may (the editor's ``can_add_to_dataset``: a person who may approve, save and approve in one step with the
// same checks as Approve; ``can_send_to_unannotated``: the labeller or a manager of the photo's open batch), and says so
// again on the call: a refusal is shown in the server's words.
const mayAddToDataset=computed(()=>!!(live.value&&meta.value?.can_add_to_dataset===true));
const maySendToUnannotated=computed(()=>!!(live.value&&meta.value?.can_send_to_unannotated===true));
const askAction=ref('');const askError=ref('');
function openAsk(action){if(samPoints.value.length||samBox.value||draft.value.length){status.value='Keep or drop what is being drawn first.';return;}askError.value='';askAction.value=action;}
async function addToDatasetLive(){const W=meta.value.photo.width,H=meta.value.photo.height;busy.value=true;askError.value='';
  try{const body=await liveApi.saveLabel(props.state.ref,item.value.id,{action:'add_to_dataset',shapes:toBackend(shapes.value,W,H,roles.value),started_from:meta.value.started_from,started_model:meta.value.started_model,nothing_to_mark:empty.value&&!shapes.value.length});
    // Not approved (a fault, or nothing drawn without "No objects to mark"): the label is kept as a draft, and why is said.
    if(body.approved!==true){dirty.value=false;item.value.state=liveState(body.state);askError.value=body.faults?.length?`Kept as a draft, not added. The checks found: ${body.faults.map(f=>f.message).join('; ')}`:(body.message||'Not added to the dataset. The label is kept as a draft.');return;}
    askAction.value='';item.value.state='Accepted';item.value.labelled=true;dirty.value=false;const words=body.message||'Added to the dataset: the label is finished and approved.';
    if(index.value<scopedImages.value.length-1){load(index.value+1);hint.value=`${words} On to the next photo.`;}else{await fetchEditor();status.value=words;}}
  catch(e){askError.value=e.message;}finally{busy.value=false;}}
async function sendToUnannotatedLive(){const W=meta.value.photo.width,H=meta.value.photo.height;busy.value=true;askError.value='';const it=item.value,at=index.value;
  try{if(dirty.value)await liveApi.saveLabel(props.state.ref,it.id,{shapes:toBackend(shapes.value,W,H,roles.value),action:'save',started_from:meta.value.started_from,started_model:meta.value.started_model,nothing_to_mark:empty.value&&!shapes.value.length});
    const body=await liveApi.sendToUnannotated(props.state.ref,it.id);askAction.value='';dirty.value=false;
    // The photo leaves this batch: on to the next one, or back to the batch when it was the last or the batch closed.
    props.state.images=props.state.images.filter(i=>i!==it);const words='Sent to Unannotated: the photo waits with the unassigned photos, its draft kept.';
    if(body?.closed||!scopedImages.value.length){emit('close');return;}load(Math.min(at,scopedImages.value.length-1));hint.value=words;}
  catch(e){askError.value=e.message;}finally{busy.value=false;}}
async function addComment(){const text=comment.value.trim();if(!text)return;if(live.value){try{comments.value=(await liveApi.comment(props.state.ref,item.value.id,text)).comments;comment.value='';}catch(e){status.value=e.message;}return;}comments.value.push(text);comment.value='';}
function openComments(){panel.value='Comments';nextTick(()=>document.getElementById('editor-comment')?.focus());}
onMounted(fetchEditor);
function pendingTool(name){toolDialog.value=name;}
function imageLoaded(event){aspect.value=event.target.naturalWidth/event.target.naturalHeight;}

function remember(){history.value.push(structuredCloneRaw(shapes.value));future.value=[];dirty.value=true;}
// Drawing. Points are in 600 × 300 units; what a person sees and aims at (snapping, closing, handle sizes, dashes) is
// measured in screen pixels, from the overlay's size on screen. The rules are the old editor's (editor.js): a corner
// snaps to another shape's corner and to the photo's edge; a polygon closes on its first point; a cut needs two clicks.
const SNAP_PX=9,EDGE_PX=6,CLOSE_PX=11,DRAG_PX=4;
const cursor=ref(null);const boxStart=ref(null);const cutFrom=ref(null);const hint=ref('');const screen=ref({w:600,h:300});let boxPress=null;let observer=null;
const ux=computed(()=>600/Math.max(1,screen.value.w));const uy=computed(()=>300/Math.max(1,screen.value.h));
function px(a,b){return Math.hypot((a[0]-b[0])/ux.value,(a[1]-b[1])/uy.value);}
function handle(r){return {rx:r*ux.value,ry:r*uy.value};}
function colorOf(shape){return props.state.classes.find(c=>c.name===shape.kind)?.color||'#8b5cf6';}
function draftColor(){return colorOf({kind:kind.value});}
function pts(points){return points.map(p=>p.join(',')).join(' ');}
function snap(p,skip){let best=null;shapes.value.forEach(sh=>(sh.points||[]).forEach((q,i)=>{if(skip&&skip.shape===sh&&skip.vertex===i)return;const gap=px(p,q);if(gap<=SNAP_PX&&(!best||gap<best.gap))best={gap,q};}));if(best)return [...best.q];
  const out=[...p];if(out[0]/ux.value<=EDGE_PX)out[0]=0;if(out[1]/uy.value<=EDGE_PX)out[1]=0;if((600-out[0])/ux.value<=EDGE_PX)out[0]=600;if((300-out[1])/uy.value<=EDGE_PX)out[1]=300;return out;}
const closing=computed(()=>tool.value==='polygon'&&draft.value.length>=3&&!!cursor.value&&px(cursor.value,draft.value[0])<=CLOSE_PX);
const drawing=computed(()=>draft.value.length>0||!!boxStart.value||!!cutFrom.value);
function cancelDrawing(){draft.value=[];boxStart.value=null;boxPress=null;cutFrom.value=null;cursor.value=null;}
function setTool(name){if((name==='smart'||name==='outline')&&smartOff.value){hint.value=smartOff.value;return;}
  if((name==='brush'||name==='eraser')&&brushOff.value){hint.value=brushOff.value;return;}
  clearSam();if(name!=='pan'&&name!=='select'&&locked.value){refuseLocked();return;}if(classPop.value)savePop();cancelDrawing();brush.cancel();hint.value='';tool.value=name;brush.erasing.value=name==='eraser';}
const painting=computed(()=>tool.value==='brush'||tool.value==='eraser');
// The top visible, unlocked mask under a point (stage units): masks lie under the SVG and take no pointer.
function maskAt(at){if(!meta.value)return null;const [x,y]=stageToPhoto(at,meta.value.photo.width,meta.value.photo.height);
  return [...shapes.value].reverse().find(sh=>{if(!sh.mask||hiddenIds.value.has(sh.id)||lockedIds.value.has(sh.id))return false;try{return maskHas(sh.mask,x,y);}catch{return false;}})||null;}
// A stroke goes on the selected mask; the eraser without one takes the top mask under the pointer.
function startStroke(at,event){let target=brushTarget.value&&!hiddenIds.value.has(brushTarget.value.id)?brushTarget.value:null;if(!target&&tool.value==='eraser')target=maskAt(at);
  if(target&&lockedIds.value.has(target.id)){hint.value='This layer is locked. Unlock it in Layers to paint on it.';return;}
  const name=target?target.kind:kind.value;if(!name){hint.value='Add or select your project class first.';return;}
  if(maskOff(name)){hint.value=maskOff(name);return;}
  if(!brush.begin(stageToPhoto(at,meta.value.photo.width,meta.value.photo.height),{shape:target,kind:name,id:`mask-${Date.now()}`})){hint.value=brush.message.value;return;}
  canvas.value.setPointerCapture?.(event.pointerId);}
function applyStroke(result){if(!result)return;remember();const at=shapes.value.findIndex(sh=>sh.id===result.id);
  if(!result.mask){if(at>=0)shapes.value.splice(at,1);selected.value=null;hint.value=`The eraser removed the whole ${result.kind} mask. Ctrl+Z brings it back.`;return;}
  if(at>=0)shapes.value.splice(at,1,{...shapes.value[at],mask:result.mask});else shapes.value.push({id:result.id,kind:result.kind,mask:result.mask});
  selected.value=result.id;empty.value=false;}
function addBox(a,b){const c=boxCorners(a,b);if((c[2][0]-c[0][0])/ux.value<3||(c[2][1]-c[0][1])/uy.value<3){hint.value='The box is too small. Click one corner, then the opposite corner.';return;}
  if(tool.value==='outline'){sam.outline([c[0][0],c[0][1],c[2][0],c[2][1]]);return;}   // Box to outline: SAM 3 turns the box into the object's outline
  remember();const shape={id:Date.now(),kind:kind.value,corner:corner.value,points:c};shapes.value.push(shape);selected.value=shape.id;hint.value='';openPop(shape,true);}
function removeSelected(){if(refuseLocked())return;if(!selected.value)return;if(lockedIds.value.has(selected.value)){hint.value='This layer is locked. Unlock it in Layers to remove it.';return;}remember();shapes.value=shapes.value.filter(sh=>sh.id!==selected.value);selected.value=null;}
// "Split": the line between two clicks cuts a shape it touches into two shapes that share the two points of the cut:
// the selected shape first, then a wall (then any shape) holding the line's middle, then any wall or shape it crosses.
// A click inside the shape becomes the new corner. A cut far away from a shape never cuts it (crosses()).
function splitAlong(from,to){const middle=[(from[0]+to[0])/2,(from[1]+to[1])/2];const chosen=shapes.value.find(sh=>sh.id===selected.value);
  const touched=shapes.value.filter(sh=>sh.points&&!lockedIds.value.has(sh.id)&&crosses(sh.points,from,to));const holds=sh=>contains(sh.points,middle);
  const order=[...new Set([...(chosen&&touched.includes(chosen)?[chosen]:[]),...touched.filter(sh=>isWall(sh)&&holds(sh)),...touched.filter(holds),...touched.filter(isWall),...touched])];
  for(const shape of order){const halves=splitShape(shape.points,from,to,SNAP_PX*(ux.value+uy.value)/2);if(!halves)continue;remember();const base=Date.now();
    const parts=halves.map((points,i)=>({id:`${base}-${i}`,kind:shape.kind,corner:shape.corner,points}));shapes.value.splice(shapes.value.indexOf(shape),1,...parts);selected.value=parts[0].id;tool.value='select';
    hint.value=`Cut the ${shape.kind} into two. Check the corners of both.`;return;}
  hint.value='Nothing was cut. Click on one side of the shape, then on the other side: the line must cross it.';}
// The photo fits the area it is shown in at 100% (all of it visible, however tall, turned or not). It stays centred in
// that area and moves with ``pan``: dragging with Pan, scrolling, and zooming at the pointer (Ctrl+wheel).
const scrollBox=ref(null);const room=ref({w:0,h:0});let roomObserver=null;
// The area is sized by the layout alone (the canvas column is the window's height; the photo inside it is clipped), so
// what is shown never changes the area's own size (a page scrollbar coming and going once made the photo resize forever).
function measureRoom(){const el=scrollBox.value;if(!el)return;const r=el.getBoundingClientRect();if(Math.abs(r.width-room.value.w)>0.5||Math.abs(r.height-room.value.h)>0.5)room.value={w:r.width,h:r.height};}
const view=computed(()=>viewSize(room.value,aspect.value,zoom.value,rotation.value));
const rotorStyle=computed(()=>({width:`${Math.round(view.value.shown.w)}px`,height:`${Math.round(view.value.shown.h)}px`,transform:`translate(${pan.value.x}px,${pan.value.y}px)`}));
const stageStyle=computed(()=>({width:`${Math.round(view.value.stage.w)}px`,height:`${Math.round(view.value.stage.h)}px`,transform:`translate(-50%,-50%) rotate(${rotation.value*90}deg)`}));
const photoFilter=computed(()=>`brightness(${brightness.value}%) contrast(${contrast.value}%)`);
watch(scrollBox,el=>{roomObserver?.disconnect();roomObserver=null;if(!el)return;measureRoom();roomObserver=new ResizeObserver(measureRoom);roomObserver.observe(el);},{immediate:true});
function setZoom(next,at){const z=clampZoom(next);if(z===zoom.value)return;pan.value=zoomAt(pan.value,zoom.value,z,at);zoom.value=z;}
function zoomStep(dir){setZoom(zoom.value+dir*ZOOM_STEP);}
function fromCentre(event){const r=scrollBox.value.getBoundingClientRect();return {x:event.clientX-r.left-r.width/2,y:event.clientY-r.top-r.height/2};}
function onWheel(event){event.preventDefault();if(event.ctrlKey||event.metaKey){setZoom(wheelZoom(zoom.value,event.deltaY),fromCentre(event));return;}
  pan.value={x:pan.value.x-event.deltaX,y:pan.value.y-event.deltaY};}
function resetView(){zoom.value=100;pan.value={x:0,y:0};brightness.value=100;contrast.value=100;rotation.value=0;}
function rotateView(){rotation.value=(rotation.value+1)%4;hint.value=rotation.value?`The view is turned ${rotation.value*90}° clockwise. Labels stay on the photo as it is stored.`:'The view is upright again.';}
// The crosshair: full width and full height of the canvas, following the pointer, for the tools that draw.
const cross=ref(null);const crossOn=computed(()=>CROSSHAIR_TOOLS.has(tool.value)&&!locked.value);
function trackCross(event){if(!crossOn.value||!scrollBox.value){cross.value=null;return;}const r=scrollBox.value.getBoundingClientRect();cross.value={x:Math.round(event.clientX-r.left),y:Math.round(event.clientY-r.top)};}
// A pointer on the turned photo, in its own 600 × 300 units (editorTools.unrotate).
function point(event){const r=canvas.value.getBoundingClientRect();const [a,b]=unrotate((event.clientX-r.left)/r.width,(event.clientY-r.top)/r.height,rotation.value);
  return [Math.max(0,Math.min(600,a*600)),Math.max(0,Math.min(300,b*300))].map(v=>Math.round(v*100)/100);}
function down(event){
  if(event.button!==0&&!(event.button===2&&tool.value==='smart'))return;   // a right-click removes an area in Smart Select
  event.preventDefault();
  if(tool.value!=='pan'&&tool.value!=='select'&&refuseLocked())return;   // the click must not take the focus away (the class panel keeps it), nor select text
  if(classPop.value)savePop();
  if(tool.value==='pan'){panStart={x:event.clientX,y:event.clientY,px:pan.value.x,py:pan.value.y};canvas.value.setPointerCapture?.(event.pointerId);return;}
  const at=point(event);hint.value='';
  if(painting.value){startStroke(at,event);return;}
  if(tool.value==='smart'){addSamPoint(at,event.shiftKey||event.button===2?0:1);return;}
  if((tool.value==='polygon'||tool.value==='box'||tool.value==='outline')&&!kind.value){hint.value='Add or select your project class first.';return;}
  if(tool.value==='polygon'){if(draft.value.length>=3&&px(at,draft.value[0])<=CLOSE_PX){finishPolygon();return;}draft.value.push(snap(at));cursor.value=at;return;}
  if(tool.value==='box'||tool.value==='outline'){if(boxStart.value){addBox(boxStart.value,snap(at));boxStart.value=null;cursor.value=null;return;}
    boxStart.value=snap(at);cursor.value=at;boxPress={x:event.clientX,y:event.clientY,dragged:false};canvas.value.setPointerCapture?.(event.pointerId);return;}
  if(tool.value==='split'){if(!cutFrom.value){cutFrom.value=at;cursor.value=at;return;}const from=cutFrom.value;cutFrom.value=null;cursor.value=null;splitAlong(from,at);return;}
  if(tool.value==='select'&&overlays.value){const hit=maskAt(at);if(hit){pickShape(hit);return;}}   // a click on a mask picks it
  selected.value=null;pickedPoint.value=null;
}
// A press that moves draws the box at once; a click starts it, and the dashed box follows the cursor to the next click.
function finish(event){panStart=null;moving=null;if(brush.active.value){applyStroke(brush.end());return;}if(boxPress){const dragged=boxPress.dragged;boxPress=null;if(dragged&&boxStart.value){addBox(boxStart.value,snap(point(event)));boxStart.value=null;cursor.value=null;}}}
function leave(){if(!boxPress)cursor.value=null;if(!brush.active.value)brushPoint.value=null;}
function finishPolygon(){if(draft.value.length<3){hint.value='A polygon needs at least three points.';return;}remember();const shape={id:Date.now(),kind:kind.value,corner:corner.value,points:structuredCloneRaw(draft.value)};shapes.value.push(shape);selected.value=shape.id;draft.value=[];cursor.value=null;openPop(shape,true);}
// A double-click finishes the polygon: its second click added the same point again, which is taken back.
function dbl(event){if(refuseLocked())return;if(tool.value==='select'){const sh=shapes.value.find(x=>String(x.id)===event?.target?.dataset?.id);if(sh&&sh.points&&!lockedIds.value.has(sh.id)){if(classPop.value)closePop();insertPoint(sh,point(event));}return;}
  if(tool.value!=='polygon'||!draft.value.length)return;const n=draft.value.length;if(n>=2&&px(draft.value[n-1],draft.value[n-2])<3)draft.value.pop();finishPolygon();}
function beginMove(event,shape,vertex){if(tool.value!=='select')return;event.stopPropagation();event.preventDefault();if(refuseLocked())return;if(lockedIds.value.has(shape.id)){hint.value='This layer is locked. Unlock it in Layers to move its corners.';return;}if(classPop.value)savePop();selected.value=shape.id;kind.value=shape.kind;pickedPoint.value={id:shape.id,i:vertex};moving={shape,vertex,moved:false};canvas.value.setPointerCapture?.(event.pointerId);}
// Corners, as in the old editor: a clicked corner is selected and Delete removes it (a shape keeps three); a double-click
// on an edge adds one there; Straighten (T) keeps only the real corners of the selected shape, or of every shape when
// none is selected (geometry.js whole/corners). Each is one step of Undo.
const pickedPoint=ref(null);
// A label that cannot be changed here (accepted, or another person's) is looked at, not drawn on (the old editor's rule).
const locked=computed(()=>live.value&&!!meta.value?.readonly);
function refuseLocked(){if(!locked.value)return false;hint.value=meta.value.readonly;return true;}
function removePoint(){if(refuseLocked())return;const p=pickedPoint.value;const sh=p&&shapes.value.find(x=>x.id===p.id);if(!sh)return;
  if(sh.points.length<=3){hint.value='A shape keeps at least three corners. To remove the whole shape, click it and press Delete in its panel.';return;}
  remember();sh.points.splice(p.i,1);pickedPoint.value=null;hint.value=`Corner removed: ${sh.kind} has ${sh.points.length} corners now.`;}
function insertPoint(sh,at){let best=null;sh.points.forEach((a,i)=>{const b=sh.points[(i+1)%sh.points.length];const dx=b[0]-a[0],dy=b[1]-a[1];
    const t=(dx||dy)?Math.max(0,Math.min(1,((at[0]-a[0])*dx+(at[1]-a[1])*dy)/(dx*dx+dy*dy))):0;const gap=px(at,[a[0]+t*dx,a[1]+t*dy]);if(!best||gap<best.gap)best={gap,index:i+1};});
  remember();sh.points.splice(best.index,0,[Math.round(at[0]*100)/100,Math.round(at[1]*100)/100]);selected.value=sh.id;pickedPoint.value={id:sh.id,i:best.index};hint.value='Corner added. Drag it into place.';}
function straighten(){if(refuseLocked())return;const targets=(selected.value?shapes.value.filter(x=>x.id===selected.value):shapes.value).filter(x=>x.points&&!lockedIds.value.has(x.id));if(!targets.length){hint.value='Nothing is drawn yet.';return;}
  const before=structuredCloneRaw(shapes.value);let done=0;
  targets.forEach(sh=>{const kept=(isWall(sh)?whole(sh.points):cornersOf(whole(sh.points),1)).map(p=>[Math.round(p[0]*100)/100,Math.round(p[1]*100)/100]);
    if(kept.length<3||kept.length>=sh.points.length)return;sh.points=kept;done+=1;});
  if(!done){hint.value=`Nothing to straighten: ${selected.value?'this shape has':'the shapes have'} only corners.`;return;}
  history.value.push(before);future.value=[];dirty.value=true;pickedPoint.value=null;
  hint.value=`Straightened ${done} shape${done===1?'':'s'}: only the corners are kept. Ctrl+Z brings back what was there.`;}
function move(event){if(panStart){pan.value={x:panStart.px+event.clientX-panStart.x,y:panStart.py+event.clientY-panStart.y};return;}
  if(painting.value){const at=point(event);brushPoint.value=at;if(brush.active.value)brush.move(stageToPhoto(at,meta.value.photo.width,meta.value.photo.height));return;}
  if(moving){const p=snap(point(event),moving);if(!moving.moved){remember();moving.moved=true;}moving.shape.points[moving.vertex]=p;return;}
  if(tool.value==='polygon'||tool.value==='box'||tool.value==='outline'||tool.value==='split'){cursor.value=point(event);if(boxPress&&Math.hypot(event.clientX-boxPress.x,event.clientY-boxPress.y)>DRAG_PX)boxPress.dragged=true;}}
function toggleEmpty(){if(refuseLocked())return;empty.value=!empty.value;dirty.value=true;}
// The rail (LABEL_EDITOR_TOOLS_PLAN.md 2.4; the list, keys and words are editorTools.RAIL). A button that cannot be used
// now stays focusable (aria-disabled), so its card still says why; pressing it says so too.
const RAIL_ICONS={pan:Hand,select:MousePointer2,box:Square,polygon:Pentagon,split:Scissors,brush:Brush,rotate:RotateCw,smart:MousePointerClick,assist:WandSparkles,outline:SquareDashedMousePointer,refine:Sparkles,comments:MessageSquare,undo:Undo2,redo:Redo2,empty:CircleOff,labels:Eye};
function railOff(id){if(id==='smart'||id==='outline')return smartOff.value;if(id==='brush')return brushOff.value;if(id==='assist')return assistOff.value;
  if(id==='undo')return history.value.length?'':'Nothing to undo yet.';if(id==='redo')return future.value.length?'':'Nothing to redo.';return '';}
const rail=computed(()=>RAIL.map(entry=>({...entry,icon:entry.id==='labels'&&!overlays.value?EyeOff:RAIL_ICONS[entry.id],label:`${entry.name}${entry.keys.length?` (${entry.keys.join('+')})`:''}`,
  pressed:entry.kind==='tool'?tool.value===entry.id||(entry.id==='brush'&&tool.value==='eraser'):entry.id==='empty'?empty.value:entry.id==='labels'?overlays.value:undefined,off:railOff(entry.id)})));
function railRun(entry){card.value=null;if(entry.off){hint.value=entry.off;return;}
  if(entry.kind==='tool'){setTool(entry.id);return;}
  ({rotate:rotateView,assist:()=>openAssist(),refine:refineSelected,comments:openComments,undo,redo,empty:toggleEmpty,labels:()=>{overlays.value=!overlays.value;}})[entry.id]?.();}
// The hover card: after 400 ms of hover, at once on keyboard focus; closed on leave, blur and Esc; never on touch.
const card=ref(null);let cardTimer=null,cardLeave=null,keyboardMode=false;
const canHover=()=>!globalThis.matchMedia||globalThis.matchMedia('(hover: hover)').matches;
function showCard(entry,el){clearTimeout(cardLeave);card.value={entry,rect:el.getBoundingClientRect(),off:entry.off};}
function railEnter(event,entry){if(event.pointerType==='touch'||!canHover())return;clearTimeout(cardLeave);clearTimeout(cardTimer);const el=event.currentTarget;cardTimer=setTimeout(()=>showCard(entry,el),400);}
function railLeave(){clearTimeout(cardTimer);clearTimeout(cardLeave);cardLeave=setTimeout(()=>{card.value=null;},150);}
function keepCard(){clearTimeout(cardLeave);}
function railFocus(event,entry){if(keyboardMode)showCard(entry,event.currentTarget);}
function railBlur(){clearTimeout(cardTimer);card.value=null;}
function onPointerAnywhere(event){keyboardMode=false;if(toneOpen.value&&!event.target?.closest?.('.tone'))toneOpen.value=false;}
// The keyboard (editorTools.keyAction; every key is listed in the keyboard panel, KEY_GROUPS): Enter finishes a polygon
// or keeps a Smart Select outline, Esc cancels or drops, Backspace takes back the last point, Delete removes the selected
// corner or shape, Ctrl+Z / Ctrl+Y undo and redo.
function runKey(action){
  if(action==='eraser'){setTool(tool.value==='eraser'?'brush':'eraser');return true;}   // E: the eraser, and back to the brush
  if(action==='brush-smaller'||action==='brush-larger')return painting.value&&brush.keydown({key:action==='brush-larger'?']':'['});
  if(['pan','select','box','polygon','split','smart','outline','brush'].includes(action)){setTool(action);return true;}
  const run={rotate:rotateView,assist:()=>openAssist(),find:openDetect,refine:refineSelected,comments:openComments,empty:toggleEmpty,straighten,'zoom-in':()=>zoomStep(1),'zoom-out':()=>zoomStep(-1),'reset-view':resetView}[action];
  if(run){run();return true;}
  return false;
}
function onAnyKey(){keyboardMode=true;}
function onKey(event){if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.target.isContentEditable||document.querySelector('dialog[open]'))return;
  const key=event.key;
  if(key==='Escape'&&card.value){card.value=null;return;}
  if(key==='Escape'&&toneOpen.value){toneOpen.value=false;return;}
  const action=keyAction(event);
  if(action==='undo'||action==='redo'){event.preventDefault();if(action==='undo')undo();else redo();return;}
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(action){if(runKey(action))event.preventDefault();return;}
  if(key==='Enter'&&tool.value==='polygon'&&draft.value.length){event.preventDefault();finishPolygon();return;}
  if(key==='Enter'&&(tool.value==='smart'||tool.value==='outline')&&samKept.value.length){event.preventDefault();applySam();return;}
  if(key==='Escape'&&brush.active.value){brush.cancel();return;}
  if(key==='Escape'){if(samPoints.value.length||samBox.value||samCandidate.value.length){clearSam();return;}if(detectOpen.value&&!drawing.value){closeFind();return;}if(drawing.value)cancelDrawing();else selected.value=null;return;}
  if(key==='Backspace'&&draft.value.length){event.preventDefault();draft.value.pop();return;}
  if((key==='Delete'||key==='Backspace')&&pickedPoint.value){event.preventDefault();removePoint();return;}
  if((key==='Delete'||key==='Backspace')&&selected.value){event.preventDefault();removeSelected();}}
onMounted(()=>{window.addEventListener('keydown',onAnyKey,true);window.addEventListener('keydown',onKey);window.addEventListener('resize',measureRoom);window.addEventListener('pointerdown',onPointerAnywhere,true);});
function measureCanvas(){const el=canvas.value;if(!el)return;const r=el.getBoundingClientRect();if(!r.width||!r.height)return;screen.value=rotation.value%2?{w:r.height,h:r.width}:{w:r.width,h:r.height};}
watch(canvas,el=>{observer?.disconnect();observer=null;if(!el)return;measureCanvas();observer=new ResizeObserver(measureCanvas);observer.observe(el);},{immediate:true});
watch(rotation,()=>nextTick(measureCanvas));
onUnmounted(()=>{window.removeEventListener('keydown',onAnyKey,true);window.removeEventListener('keydown',onKey);window.removeEventListener('resize',measureRoom);window.removeEventListener('pointerdown',onPointerAnywhere,true);observer?.disconnect();roomObserver?.disconnect();clearTimeout(pollTimer);clearTimeout(cardTimer);clearTimeout(cardLeave);clearTimeout(appliedTimer);clearSam();});
// The class of a shape, asked as soon as it is drawn, and when a shape is clicked with Select: a small panel beside it
// with the project's classes (type to filter, ↑/↓ to choose), Delete, and Save (Enter). The next shape is drawn in the
// class chosen last.
const classPop=ref(null);const popInput=ref(null);
const popShape=computed(()=>classPop.value?shapes.value.find(sh=>sh.id===classPop.value.id):null);
const popMatches=computed(()=>{if(!classPop.value)return [];const t=classPop.value.text.trim().toLowerCase();const all=props.state.classes;
  if(!t||all.some(c=>c.name.toLowerCase()===t))return all;return all.filter(c=>c.name.toLowerCase().includes(t));});
// The panel sits at the top-left corner of the photo (asked for by the user on 2026-10-16): always in view, never cut off.
const popStyle={left:'12px',top:'12px'};
function openPop(shape,isNew){const at=Math.max(0,props.state.classes.findIndex(c=>c.name===shape.kind));classPop.value={id:shape.id,text:shape.kind,at,isNew,error:''};
  nextTick(()=>{popInput.value?.focus();popInput.value?.select();});}
function closePop(){classPop.value=null;}
function popStep(step){const pop=classPop.value,list=popMatches.value;if(!pop||!list.length)return;const at=list.findIndex(c=>c.name===pop.text);const next=list[((at<0?pop.at:at)+step+list.length)%list.length];
  pop.text=next.name;pop.at=props.state.classes.findIndex(c=>c.name===next.name);pop.error='';}
function savePop(name){const pop=classPop.value,sh=popShape.value;if(!pop||!sh){closePop();return;}const t=String(name||pop.text).trim().toLowerCase();
  const found=props.state.classes.find(c=>c.name.toLowerCase()===t)||(popMatches.value.length===1?popMatches.value[0]:null);
  if(!found){pop.error=`Choose one of the classes: ${props.state.classes.map(c=>c.name).join(', ')}.`;nextTick(()=>popInput.value?.focus());return;}
  if(found.name!==sh.kind){if(!pop.isNew)remember();sh.kind=found.name;dirty.value=true;}kind.value=found.name;closePop();}
function deletePop(){const pop=classPop.value;if(!pop)return;if(pop.isNew&&history.value.length)shapes.value=history.value.pop();else{remember();shapes.value=shapes.value.filter(sh=>sh.id!==pop.id);}
  selected.value=null;closePop();}
// Convert to mask / Convert to polygon (the shape's own panel), each one step of Undo. A mask becomes one polygon per
// separate region (holes are not kept: a polygon has none).
function convertToMask(){const sh=popShape.value;if(!sh?.points||!meta.value)return;if(maskOff(sh.kind)){hint.value=maskOff(sh.kind);return;}const W=meta.value.photo.width,H=meta.value.photo.height;
  const mask=polygonToMask(toPixels(sh.points,W,H),W,H);if(!mask){hint.value='This polygon covers no pixel of the photo, so there is no mask to make.';return;}
  remember();shapes.value.splice(shapes.value.indexOf(sh),1,{id:sh.id,kind:sh.kind,mask});selected.value=sh.id;closePop();hint.value='Converted to a mask. The Brush (R) and the Eraser (E) change it; Ctrl+Z brings the polygon back.';}
function convertToPolygon(){const sh=popShape.value;if(!sh?.mask||!meta.value)return;const W=meta.value.photo.width,H=meta.value.photo.height;let rings;
  try{rings=maskToRegions(sh.mask);}catch(e){hint.value=e.message;return;}
  if(!rings.length){hint.value='This mask is too small to outline as a polygon.';return;}
  remember();const base=Date.now();const parts=rings.map((ring,i)=>{const points=toUnits(ring,W,H).map(p=>[Math.round(p[0]*100)/100,Math.round(p[1]*100)/100]);return {id:`${base}-p${i}`,kind:sh.kind,corner:'room',cornerTypes:null,cornerCount:points.length,points};});
  shapes.value.splice(shapes.value.indexOf(sh),1,...parts);selected.value=parts[0].id;closePop();
  hint.value=`Converted to ${parts.length} polygon${parts.length===1?'':'s'}, one for each separate part. Holes are not kept; Ctrl+Z brings the mask back.`;}
function pickShape(shape){if(lockedIds.value.has(shape.id))return;selected.value=shape.id;kind.value=shape.kind;pickedPoint.value=null;if(tool.value==='select'&&!locked.value)openPop(shape,false);}
// The side panel's classes (2.6): those in this photo with their count, and the unused ones; each with an AI button
// that opens Label Assist for that class alone. Layers: every shape, top first, with show / hide, lock and order.
const use=computed(()=>classUse(shapes.value,props.state.classes));
const drawnShapes=computed(()=>shapes.value.filter(sh=>sh.points&&!hiddenIds.value.has(sh.id)));
const layers=computed(()=>shapes.value.map((shape,i)=>({shape,n:i+1})).reverse());
function toggleIn(set,id){const next=new Set(set.value);if(next.has(id))next.delete(id);else next.add(id);set.value=next;}
function toggleHidden(id){toggleIn(hiddenIds,id);if(hiddenIds.value.has(id)&&selected.value===id){selected.value=null;closePop();}}
function toggleLocked(id){toggleIn(lockedIds,id);if(lockedIds.value.has(id)&&classPop.value?.id===id)closePop();}
function moveLayerBy(shape,step){if(refuseLocked())return;const next=moveLayer(shapes.value,shape.id,step);if(next===shapes.value)return;remember();shapes.value=next;}
function pickLayer(shape){selected.value=shape.id;kind.value=shape.kind;pickedPoint.value=null;}
// Find Objects with AI (agentic-docs/FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md, ADM-1182): a card over the left panel. The
// person chooses the model (ModelSourcePicker; nobody chooses where it runs: a hosted model runs where AADML runs it),
// types the class to find (any name: the project's classes are only suggestions; nothing is filled in) and an optional description.
// What the model finds is shown on the photo first, with a confidence slider when the model gave a confidence, and
// Save adds the kept shapes BESIDE what is drawn, as one step of Undo. A class the project does not have yet is added
// on Save through the Classes API (its role and lock checks), only for a person who may change classes. A model is
// started when it is not running; the card asks again every 4 seconds until it answers.
// Label Assist (2.3) asks the ticked project classes through the same path and shows its answer in the same card.
const detectOpen=ref(false);const detecting=ref(null);const detectError=ref('');let pollTimer=null;
// The model the card's picker is on (the same grouped picker as Auto Label: ModelSourcePicker); Find Objects asks it.
const detectPick=ref('');const pickedSource=computed(()=>meta.value?.detect?.sources.find(x=>x.id===detectPick.value)||null);
// The found shapes are drawn as the chosen way shows them (contract C3): an answer carries ``shapes`` and ``other``, the
// same objects as polygons and as masks, and the switch (AnswerWays) shows one or the other without asking again. An
// answer that has only one way is drawn as it came (a polygon filled more for Masks: sourceFamilies.fillOpacityOf).
const foundWay=computed(()=>labelsOfId(meta.value?.detect?.sources||[],detectPick.value));
const foundFill=computed(()=>fillOpacityOf(pickedSource.value?.labels));
// AI refine asks for the project's classes (the same choice as Auto Label's ticks, kept per project in this browser).
const classNames=computed(()=>props.state.classes.map(c=>c.name));
// What the person typed, written as the backend writes a class name (label_classes.clean_name).
const findName=ref('');const findDescription=ref('');const found=ref(null);const findThreshold=ref(50);const findSaving=ref(false);
const findClass=computed(()=>findName.value.trim().toLowerCase().replace(/\s+/g,' '));
const findKnown=computed(()=>props.state.classes.some(c=>c.name===findClass.value));
const mayAddClass=computed(()=>!!props.state.canChangeClasses&&!props.state.classesLocked);
const findBlocked=computed(()=>!findClass.value?'Type what to find.'
  :!/^[a-z0-9][a-z0-9 _-]{0,39}$/.test(findClass.value)?'A class name is 1 to 40 letters, digits, spaces, "-" or "_", starting with a letter or digit.'
  :findKnown.value||mayAddClass.value?''
  :`"${findClass.value}" is not a class of this project, and ${props.state.classesLocked?'its classes are locked':'your role does not add classes'}. Type one of its classes.`);
// What the description is used for by the model chosen: SAM 3 is given the class name alone.
const findDescriptionUse=computed(()=>{const id=pickedSource.value?.id||'';if(!pickedSource.value?.platform)return 'This model finds the classes it was trained on; the description is not sent to it.';
  return /^sam3/.test(id)?'SAM 3 looks for the class name alone; the description is not sent to it.':'The vision model reads the description to choose what it marks.';});
const foundAll=computed(()=>{if(!found.value)return [];const picked=pickWay(found.value.shapes,found.value.other,foundWay.value);return picked.length?picked:found.value.shapes;});
const foundScored=computed(()=>foundAll.value.some(x=>typeof x.score==='number'));
const foundKept=computed(()=>foundAll.value.filter(x=>typeof x.score!=='number'||x.score*100>=findThreshold.value));
// Found masks are drawn by the preview MaskLayer (with an edge: not kept yet); the SVG draws the polygons dashed.
const foundPolygons=computed(()=>foundKept.value.filter(x=>x.points));
const foundSummary=computed(()=>{const n=foundAll.value.length;if(!found.value)return '';
  if(!found.value.assist)return n?`Found ${n} object${n===1?'':'s'} matching "${found.value.cls}"`:`No object matching "${found.value.cls}" was found`;
  if(!n)return `No ${found.value.asked.join(', ')} was found in this photo`;
  const by=classUse(foundAll.value,[]).inPhoto.map(c=>`${c.count} ${c.name}`).join(', ');return `Found ${n} object${n===1?'':'s'}: ${by}`;});
const previewColor=computed(()=>props.state.classes.find(c=>c.name===found.value?.cls)?.color||'#2563eb');
// The masks not kept yet: the found ones and the Smart Select / Box to outline candidate.
const previewMasks=computed(()=>[...(found.value?foundKept.value.filter(isMask):[]),...(tool.value==='smart'||tool.value==='outline'?samKept.value.filter(isMask):[])]);
function maskColor(name){return colorOf({kind:name});}
function previewMaskColor(name){return found.value&&!found.value.assist?previewColor.value:colorOf({kind:name});}
function openDetect(){if(refuseLocked())return;if(!live.value){pendingTool('Find Objects with AI');return;}
  if(!meta.value?.detect){hint.value=meta.value?.readonly||(meta.value?.approving?'This label waits for approval: a model does not draw on it here.':'A model cannot draw on this photo here.');return;}
  if(detectOpen.value&&!assistMode.value)return;
  stopDetect();assistMode.value=false;detectError.value='';found.value=null;assistOpen.value=false;
  const offered=meta.value.detect.sources;detectPick.value=offered.find(x=>x.id===meta.value.detect.preference&&!x.unavailable)?.id||offered.find(x=>!x.unavailable)?.id||'';
  detectOpen.value=true;nextTick(()=>document.getElementById('find-class-name')?.focus());}
function closeFind(){stopDetect();found.value=null;detectError.value='';detectOpen.value=false;assistMode.value=false;}
function runFind(){if(findBlocked.value||!pickedSource.value||pickedSource.value.unavailable)return;
  runDetect(pickedSource.value.id,null,{name:findClass.value,description:findDescription.value.trim()});}
function stopDetect(){clearTimeout(pollTimer);pollTimer=null;detecting.value=null;}
// Label Assist (2.3): the dialog chooses the model and the classes; the descriptions changed there are saved to their
// classes first (a vision model reads them), then the model is asked for those classes, and the answer is shown in the
// card like Find Objects with AI's: dashed until Save.
const assistOpen=ref(false);const assistOnly=ref('');const assistMode=ref(false);const assistError=ref('');
const assistOff=computed(()=>!live.value?'Label Assist works on a project photo.':locked.value?meta.value.readonly
  :!meta.value?.detect?(meta.value?.approving?'This label waits for approval: a model does not draw on it here.':'A model cannot draw on this photo here.'):'');
function openAssist(only=''){if(assistOff.value){hint.value=assistOff.value;return;}closePop();cancelDrawing();clearSam();assistOnly.value=only;assistError.value='';assistOpen.value=true;}
async function runAssist({source,classes:asked,descriptions,only}){assistError.value='';busy.value=true;
  try{for(const [name,description] of Object.entries(descriptions||{})){const body=await liveApi.updateClass(props.state.ref,name,{description});props.state.classes=classesOf(body.classes);}}
  catch(e){assistError.value=`The description was not saved, so the model was not asked. ${e.message}`;return;}finally{busy.value=false;}
  if(!only)keepAskedClasses(props.state.ref,classNames.value,asked);
  assistOpen.value=false;stopDetect();found.value=null;detectError.value='';detectPick.value=source;assistMode.value=true;detectOpen.value=true;
  runDetect(source,null,null,asked);}
function backToAssist(){stopDetect();found.value=null;detectError.value='';detectOpen.value=false;assistMode.value=false;assistOpen.value=true;}
function findFromAssist(){assistOpen.value=false;openDetect();}
// ``find``: the class typed in the card ({name, description}); ``classes``: the classes Label Assist asks; without
// either (AI refine) the project's classes are asked.
async function runDetect(id,refine=null,find=null,classes=null){clearTimeout(pollTimer);const it=item.value;const source=meta.value?.detect?.sources.find(x=>x.id===id);if(!it||!source)return;detectError.value='';
  if(!detecting.value)detecting.value={id,name:source.name,title:`Asking ${source.name}`,now:'asking the model',steps:[],refine};
  try{const body=await liveApi.detect(props.state.ref,it.id,id,find?null:(classes||askedClasses(props.state.ref,classNames.value)),find);if(item.value!==it||!detecting.value)return;
    if(body.state==='waiting'){detecting.value={...body,id,refine};pollTimer=setTimeout(()=>runDetect(id,refine,find,classes),4000);return;}
    if(refine)applyRefine(body,refine);else showFound(body,find,classes);}
  catch(e){if(item.value!==it)return;detecting.value=null;detectError.value=e.message;if(!detectOpen.value)hint.value=`${source.name} did not answer. ${e.message}`;}}
// The answer, shown on the photo before anything is added (a "Basic Detector" answer tidied first by the old editor's
// rules, geometry.js tidyUp). The model used is kept as this person's choice, offered first next time.
function showFound(body,find,classes=null){const W=meta.value.photo.width,H=meta.value.photo.height;detecting.value=null;closePop();cancelDrawing();
  const given=body.tidy&&body.shapes.length?tidyUp(structuredCloneRaw(body.shapes),roles.value).shapes:body.shapes;const at=Date.now();
  const shown=(list,tag)=>(list||[]).map((x,i)=>({...fromBackend([x],W,H)[0],id:`${tag}${i}-${at}`,...(typeof x.score==='number'?{score:x.score}:{})}));
  found.value={name:body.name,cls:find?(body.find||find.name):'',assist:!find,asked:classes||[],started_model:body.started_model,research_only:body.research_only,
    shapes:shown(given,'f'),other:shown(body.other,'o')};findThreshold.value=50;
  if(meta.value.detect.preference!==body.started_model)
    liveApi.detectPreference(props.state.ref,body.started_model).then(kept=>{meta.value.detect.preference=kept.preference;}).catch(()=>{});}
// After Save: "Applied N labels · Undo", which takes the whole answer back in one step while nothing came after it.
const applied=ref(null);let appliedTimer=null;
function noteApplied(count){clearTimeout(appliedTimer);applied.value={count,step:history.value.length};appliedTimer=setTimeout(()=>{applied.value=null;},10000);}
function undoApplied(){const a=applied.value;applied.value=null;clearTimeout(appliedTimer);if(!a)return;
  if(history.value.length!==a.step){hint.value='Other changes came after those labels. Use Undo (Ctrl+Z) one step at a time.';return;}undo();hint.value='The labels from the model are taken back.';}
async function saveFound(){const f=found.value;const kept=foundKept.value;if(!f||!kept.length||findSaving.value)return;detectError.value='';
  const refused=kept.find(x=>x.mask&&maskOff(x.kind));if(refused){detectError.value=`${maskOff(refused.kind)} Choose Polygons to keep it.`;return;}
  if(!f.assist&&!props.state.classes.some(c=>c.name===f.cls)){findSaving.value=true;
    try{const body=await liveApi.addClass(props.state.ref,{name:f.cls,color:nextClassColor(props.state.classes),description:findDescription.value.trim()});props.state.classes=classesOf(body.classes);}
    catch(e){detectError.value=`"${f.cls}" was not added to the project's classes, so nothing was added. ${e.message}`;return;}
    finally{findSaving.value=false;}}
  remember();const before=shapes.value.length;shapes.value=[...shapes.value,...kept.map(({score:_score,...shape})=>shape)];
  if(!before){meta.value.started_from='from_ai';meta.value.started_model=f.started_model;}
  empty.value=false;selected.value=null;dirty.value=true;found.value=null;detectOpen.value=false;assistMode.value=false;noteApplied(kept.length);
  const what=f.assist?`label${kept.length===1?'':'s'}`:`${f.cls} shape${kept.length===1?'':'s'}`;
  hint.value=`${kept.length} ${what} from ${f.name} added beside what was drawn. A head start, not a label: check each one; Ctrl+Z takes them away.${f.research_only?' The model is for research or evaluation only, and the label says so.':''}`;}
// AI refine: the selected shape is replaced by the shape of its kind that a model finds in the same place (a mask by the
// answer's mask that covers the most the same pixels, editorTools.bestMaskMatch) (the model
// the person chose for new photos, else the first one offered), tidied by the same rules as Auto annotation. Only that
// shape changes, as one step of Undo; when the model finds nothing of its kind there, nothing changes.
function refineSelected(){if(refuseLocked())return;if(!live.value){pendingTool('AI refine');return;}
  const target=shapes.value.find(x=>x.id===selected.value);if(!target){hint.value='Select a shape first: AI refine replaces it with the shape a model finds in the same place.';return;}
  const detect=meta.value?.detect;if(!detect?.sources?.length){hint.value=meta.value?.readonly||'A model cannot draw on this photo here.';return;}
  const source=detect.sources.find(x=>x.id===detect.preference)||detect.sources[0];closePop();runDetect(source.id,target.id);}
function applyRefine(body,targetId){const W=meta.value.photo.width,H=meta.value.photo.height;detecting.value=null;
  const target=shapes.value.find(x=>x.id===targetId);if(!target){hint.value='The shape was removed while the model looked at the photo. Nothing was changed.';return;}
  if(target.mask){let match=null;try{match=bestMaskMatch(target.mask,[...(body.shapes||[]),...(body.other||[])],target.kind);}catch(e){hint.value=`${body.name} answered a mask that could not be read. Nothing was changed. ${e.message}`;return;}
    if(!match){hint.value=`${body.name} found no ${target.kind} in the same place as this one. Nothing was changed.`;return;}
    remember();shapes.value.splice(shapes.value.indexOf(target),1,{...target,mask:match.mask});dirty.value=true;selected.value=target.id;
    hint.value=`${body.name} refined this ${target.kind} mask (${Math.round(match.share*100)}% the same pixels as yours). Check its edges; Ctrl+Z brings yours back.${body.research_only?' The model is for research or evaluation only.':''}`;return;}
  const tidied=body.tidy&&body.shapes.length?tidyUp(structuredCloneRaw(body.shapes),roles.value).shapes:body.shapes;
  const match=bestMatch(target,fromBackend(pickWay(tidied,body.other,'polygons'),W,H));
  if(!match){hint.value=`${body.name} found no ${target.kind} in the same place as this one. Nothing was changed.`;return;}
  remember();target.points=structuredCloneRaw(match.shape.points);target.corner=match.shape.corner;target.cornerTypes=match.shape.cornerTypes;target.cornerCount=match.shape.cornerCount;
  dirty.value=true;pickedPoint.value=null;selected.value=target.id;
  hint.value=`${body.name} refined this ${target.kind}: its corners now follow what the model sees (${Math.round(match.share*100)}% the same place as yours). Check every corner; Ctrl+Z brings yours back.${body.research_only?' The model is for research or evaluation only.':''}`;}
// Start over (the label's own menu, under Annotations): the walls the app sent, or the empty photo. It replaces what is
// drawn, as one step of Undo.
const startOpen=ref(false);
async function startFrom(start){const it=item.value;stopDetect();
  try{const body=await liveApi.editor(props.state.ref,it.id,null,start);if(item.value!==it)return;const W=body.photo.width,H=body.photo.height;closePop();cancelDrawing();
    remember();shapes.value=fromBackend(body.shapes,W,H);meta.value.started_from=body.started_from;meta.value.started_model=body.started_model||'';empty.value=false;selected.value=null;dirty.value=true;startOpen.value=false;
    hint.value=start==='blank'?'Everything was removed. Draw by hand.':`Started from ${start==='correction'?"the walls the app's user confirmed":"the walls the app's own AI marked"}. Check every corner.`;}
  catch(e){hint.value=e.message;}}
function undo(){if(!history.value.length)return;pickedPoint.value=null;future.value.push(structuredCloneRaw(shapes.value));shapes.value=history.value.pop();dirty.value=true;}
function redo(){if(!future.value.length)return;pickedPoint.value=null;history.value.push(structuredCloneRaw(shapes.value));shapes.value=future.value.pop();dirty.value=true;}
function syncBatch(){if(live.value)return;const b=props.state.batches.find(b=>b.id===item.value.batchId);if(!b)return;const group=props.state.images.filter(i=>i.batchId===b.id);b.status=group.every(i=>i.state==='Accepted')?'Dataset':group.some(i=>i.state==='In review')?'In review':batchColumn({...b,status:'Annotating'});}
function save(review=false){if(samPoints.value.length||samBox.value){status.value='Keep or drop the Smart Select outline before saving.';return;}if(draft.value.length){status.value='Finish or cancel the polygon before saving.';return;}if(live.value)return saveLive(review);if(review&&!shapes.value.length&&!empty.value){status.value='Draw an annotation or mark this image as having no objects.';return;}item.value.shapes=structuredCloneRaw(shapes.value);item.value.state=review?'In review':(item.value.state==='Changes requested'?'Changes requested':'Unlabeled');item.value.noObjects=empty.value;syncBatch();dirty.value=false;status.value=review?'Sent to review locally':'Draft saved locally';}
function review(accepted){if(live.value)return reviewLive(accepted);if(dirty.value){status.value='Save your changes before reviewing.';return;}if(accepted&&!item.value.shapes.length&&!item.value.noObjects){status.value='Add an annotation or mark no objects before approving.';return;}item.value.state=accepted?'Accepted':'Changes requested';syncBatch();status.value=accepted?'Accepted in local dataset preview':'Changes requested locally';}
function selectImage(i){if(dirty.value||draft.value.length||samPoints.value.length||samBox.value){pendingIndex.value=i;leaving.value=true;return;}load(i);}
// The next photo: zoom and position stay when the lock is on; the turn, the layers' view and the tools start afresh.
function load(i){clearSam();cancelDrawing();closePop();pickedPoint.value=null;stopDetect();found.value=null;detectOpen.value=false;assistMode.value=false;assistOpen.value=false;startOpen.value=false;hint.value='';applied.value=null;index.value=i;
  if(!viewLock.value){zoom.value=100;pan.value={x:0,y:0};}rotation.value=0;hiddenIds.value=new Set();lockedIds.value=new Set();brush.reset();brushPoint.value=null;
  aspect.value=2;shapes.value=structuredCloneRaw(item.value.shapes);empty.value=!!item.value.noObjects;history.value=[];future.value=[];draft.value=[];dirty.value=false;selected.value=null;status.value='Local preview';if(live.value){meta.value=null;fetchEditor();}}
function close(){if(dirty.value||draft.value.length||samPoints.value.length||samBox.value){pendingIndex.value=null;leaving.value=true;}else emit('close');}
function discard(){leaving.value=false;if(pendingIndex.value===null)emit('close');else load(pendingIndex.value);}
function addTag(){if(live.value){const v=tag.value.trim();tag.value='';if(!v)return;liveApi.tag(props.state.ref,item.value.id,{add:v}).then(b=>{item.value.tags=b.tags;}).catch(e=>{status.value=e.message;});return;}if(tag.value.trim()&&!item.value.tags.includes(tag.value.trim()))item.value.tags.push(tag.value.trim());tag.value='';}
</script>
<template>
<div class="annotation-editor">
  <header class="editor-header"><UiButton @click="close"><ArrowLeft :size="16"/> Back</UiButton><strong>{{ item?.name }}</strong><UiBadge v-if="!live" tone="purple">Coming soon</UiBadge><span role="status">{{ dirty ? 'Unsaved changes' : status }}</span><UiButton :disabled="busy||!!meta?.readonly||!!meta?.approving" @click="save()"><Save :size="15"/> Save draft</UiButton><UiButton variant="primary" :disabled="busy||!!meta?.readonly||!!meta?.approving" @click="save(true)"><Check :size="15"/> Send to review</UiButton><UiButton v-if="mayTakeBack" :disabled="busy" @click="takeBackError='';takeBackOpen=true"><Undo2 :size="15" aria-hidden="true"/> Take back approval</UiButton></header>
  <div v-if="item" class="editor-layout"><aside class="editor-left">
    <section v-if="detectOpen" class="find-card" aria-labelledby="find-card-title">
      <header class="find-card-head"><h3 id="find-card-title"><component :is="assistMode?WandSparkles:Sparkles" :size="16" aria-hidden="true"/> {{ assistMode?'Label Assist':'Find Objects with AI' }}</h3><button type="button" class="icon-button" :aria-label="assistMode?'Close Label Assist':'Close Find Objects with AI'" @click="closeFind"><X :size="16" aria-hidden="true"/></button></header>
      <div v-if="detecting" class="detect-wait" role="status"><strong>{{ detecting.title }}</strong><span>Now: {{ detecting.now }}{{ detecting.seconds?` · ${detecting.seconds} s`:'' }}</span><ol v-if="detecting.steps?.length"><li v-for="(step,i) in detecting.steps" :key="i" :class="step.state">{{ step.label }}</li></ol><span v-if="detecting.note">{{ detecting.note }}</span><UiButton @click="stopDetect">Stop waiting</UiButton></div>
      <template v-else-if="found">
        <p class="find-count" role="status">{{ foundSummary }}</p>
        <label v-if="foundScored" class="find-threshold"><span>Confidence threshold <strong>{{ findThreshold }}%</strong></span><input v-model.number="findThreshold" type="range" min="0" max="100" step="1" aria-describedby="find-threshold-help"><small id="find-threshold-help">{{ foundKept.length }} of {{ foundAll.length }} kept. Lower it to keep less certain finds.</small></label>
        <p v-else-if="foundAll.length" class="field-help">{{ found.name }} gives no confidence, so every object it found is kept.</p>
        <p v-if="foundAll.length" class="field-help">Shown dashed on the photo, not added yet: Save adds {{ foundKept.length===1?'it':'them' }} beside what is drawn.<template v-if="!found.assist&&!state.classes.some(c=>c.name===found.cls)"> Save also adds "{{ found.cls }}" to the project's classes.</template></p>
        <AnswerWays :sources="meta?.detect?.sources||[]" v-model="detectPick"/><div class="find-actions"><UiButton v-if="found.assist" @click="backToAssist">Back</UiButton><UiButton v-else @click="found=null">Back</UiButton><UiButton variant="primary" :disabled="!foundKept.length||findSaving" @click="saveFound">{{ findSaving?'Saving…':`Save (${foundKept.length})` }}</UiButton></div>
      </template>
      <div v-else-if="assistMode" class="find-actions"><UiButton @click="backToAssist">Back to Label Assist</UiButton></div>
      <form v-else class="find-ask" @submit.prevent="runFind">
        <ModelSourcePicker v-model="detectPick" :sources="meta?.detect?.sources||[]"/>
        <label class="field-label" for="find-class-name">Class name</label>
        <input id="find-class-name" v-model="findName" class="text-input" list="find-class-names" maxlength="40" placeholder="e.g. person, car, dog" autocomplete="off" aria-describedby="find-class-help">
        <datalist id="find-class-names"><option v-for="c in state.classes" :key="c.name" :value="c.name"/></datalist>
        <small id="find-class-help" class="field-help">{{ state.classes.length ? 'Type anything, or one of the project\'s classes.' : 'Type anything you want found.' }}<template v-if="findClass&&!findKnown&&!findBlocked"> "{{ findClass }}" is new: Save adds it to the project's classes.</template></small>
        <label class="field-label" for="find-class-description">Description <span class="find-optional">optional</span></label>
        <textarea id="find-class-description" v-model="findDescription" class="text-input" rows="2" maxlength="300" placeholder="e.g. only people wearing a helmet" aria-describedby="find-description-help"/>
        <small id="find-description-help" class="field-help">{{ findDescriptionUse }}</small>
        <p v-if="findBlocked&&findName.trim()" class="field-error" role="alert">{{ findBlocked }}</p>
        <p v-if="pickedSource" class="field-help">{{ aboutOf(pickedSource) }}<template v-if="startsServer(pickedSource)"> If it is not running it is started first, which takes a moment.</template><template v-if="pickedSource.licence"> Licence: {{ pickedSource.licence }}. A label started from its answer says so.</template></p>
        <div class="find-actions"><UiButton type="button" @click="closeFind">Cancel</UiButton><UiButton type="submit" variant="primary" :disabled="!!findBlocked||!pickedSource||!!pickedSource.unavailable"><Sparkles :size="15" aria-hidden="true"/> Find Objects</UiButton></div>
      </form>
      <p v-if="detectError" class="field-error" role="alert">{{ detectError }}</p>
    </section>
    <div class="editor-panel-tabs"><button v-for="entry in panelItems" :key="entry.name" :class="{active:panel===entry.name}" @click="panel=entry.name"><span><component :is="entry.icon" :size="19"/></span>{{entry.name}}</button></div>
    <template v-if="panel==='Labels'"><h3>Annotations <UiBadge>{{ shapes.length }}</UiBadge></h3><p class="editor-group">Group: {{state.batches.find(b=>b.id===item.batchId)?.name||'Project images'}}</p><div class="editor-label-tabs"><button v-for="name in ['Classes','Layers']" :key="name" :aria-pressed="layerTab===name" @click="layerTab=name">{{name}}</button></div>
      <template v-if="layerTab==='Classes'">
        <label class="field-label">Class<select v-model="kind" class="text-input" aria-label="Selected annotation class"><option v-if="!state.classes.length" value="">Add a project class first</option><option v-for="c in state.classes" :key="c.name" :value="c.name">{{ c.name }}</option></select></label><label v-if="geometryOf(roles,kind)==='wall'" class="field-label">Corner type<select v-model="corner" class="text-input"><option value="room">Room corner</option><option value="image_edge">Image edge</option></select></label>
        <div class="ai-actions"><UiButton class="assist-open" :aria-disabled="!!assistOff" :title="assistOff||'Label every class you tick with a model (L)'" @click="openAssist()"><WandSparkles :size="15" aria-hidden="true"/>Label Assist</UiButton><UiButton class="find-ai" title="Find any object you name, with a model (M)" :disabled="live&&!meta?.detect" @click="openDetect"><Sparkles :size="15"/>Find Objects with AI</UiButton></div>
        <div v-if="live&&meta&&!meta.readonly&&!meta.approving" class="start-over"><button type="button" class="link-button" :aria-expanded="startOpen" aria-controls="start-over-list" @click="startOpen=!startOpen">Start over from…</button><ul v-if="startOpen" id="start-over-list" class="detect-list"><li v-if="meta.given?.correction"><button type="button" @click="startFrom('correction')"><strong>The walls the app's user confirmed</strong><span>Often only the wall the user chose. Replaces what is drawn.</span></button></li><li v-if="meta.given?.ai"><button type="button" @click="startFrom('ai')"><strong>The walls the app's own AI marked</strong><span>Replaces what is drawn.</span></button></li><li><button type="button" @click="startFrom('blank')"><strong>The empty photo</strong><span>Removes everything, to draw by hand. Ctrl+Z brings it back.</span></button></li></ul></div>
        <section class="class-use" aria-labelledby="class-in-photo"><h4 id="class-in-photo">In this photo</h4><p v-if="!use.inPhoto.length" class="class-empty">Nothing is labelled yet.</p>
          <ul v-else><li v-for="c in use.inPhoto" :key="c.name"><button type="button" class="class-pick" :aria-pressed="kind===c.name" :title="`Draw ${c.name} next`" @click="kind=c.name"><i :style="{background:c.color||'#8b5cf6'}" aria-hidden="true"/><span>{{ c.name }}</span><strong class="class-count" :aria-label="`${c.count} in this photo`">{{ c.count }}</strong></button><button type="button" class="icon-button class-ai" :aria-label="`Label ${c.name} with AI`" :title="assistOff||`Label every ${c.name} in this photo with a model`" :aria-disabled="!!assistOff" @click="openAssist(c.name)"><WandSparkles :size="15" aria-hidden="true"/></button></li></ul></section>
        <section class="class-use" aria-labelledby="class-unused"><h4 id="class-unused">Unused classes</h4><p v-if="!state.classes.length" class="class-empty">No classes yet. Add what you want to label.</p><p v-else-if="!use.unused.length" class="class-empty">Every class of the project is in this photo.</p>
          <ul v-else><li v-for="c in use.unused" :key="c.name"><button type="button" class="class-pick" :aria-pressed="kind===c.name" :title="`Draw ${c.name} next`" @click="kind=c.name"><i :style="{background:c.color}" aria-hidden="true"/><span>{{ c.name }}</span></button><button type="button" class="icon-button class-ai" :aria-label="`Label ${c.name} with AI`" :title="assistOff||`Label every ${c.name} in this photo with a model`" :aria-disabled="!!assistOff" @click="openAssist(c.name)"><WandSparkles :size="15" aria-hidden="true"/></button></li></ul>
          <UiButton v-if="live&&state.canChangeClasses&&!state.classesLocked&&!meta?.readonly&&!meta?.approving" class="class-add" @click="editorClassOpen=true"><Plus :size="14"/>Add class</UiButton></section>
        <label class="field-label">Tags</label><div class="component-row"><UiBadge v-for="t in item.tags" :key="t">{{ t }}</UiBadge></div><form @submit.prevent="addTag"><input v-model="tag" class="text-input" aria-label="Image tag" placeholder="Add a tag"><UiButton type="submit">Add tag</UiButton></form>
      </template>
      <template v-else>
        <p v-if="!shapes.length" class="class-empty">No layers yet. Draw a shape, or let a model label the photo.</p>
        <ol v-else class="shape-list layer-list" aria-label="Layers, top first"><li v-for="{shape,n} in layers" :key="shape.id" :class="['layer-row',{active:selected===shape.id,'layer-hidden':hiddenIds.has(shape.id)}]">
          <button type="button" class="layer-name" :aria-pressed="selected===shape.id" @click="pickLayer(shape)"><span :style="{background:colorOf(shape)}" aria-hidden="true"/>{{ shape.kind }} {{ n }}<small>{{ shape.mask?'mask':`${shape.points.length} points` }}</small></button>
          <button type="button" class="icon-button" :aria-label="`${hiddenIds.has(shape.id)?'Show':'Hide'} ${shape.kind} ${n}`" :aria-pressed="hiddenIds.has(shape.id)" @click="toggleHidden(shape.id)"><EyeOff v-if="hiddenIds.has(shape.id)" :size="15" aria-hidden="true"/><Eye v-else :size="15" aria-hidden="true"/></button>
          <button type="button" class="icon-button" :aria-label="`${lockedIds.has(shape.id)?'Unlock':'Lock'} ${shape.kind} ${n}`" :aria-pressed="lockedIds.has(shape.id)" @click="toggleLocked(shape.id)"><Lock v-if="lockedIds.has(shape.id)" :size="15" aria-hidden="true"/><LockOpen v-else :size="15" aria-hidden="true"/></button>
          <button type="button" class="icon-button" :aria-label="`Move ${shape.kind} ${n} up`" :disabled="n===shapes.length" @click="moveLayerBy(shape,1)"><ChevronUp :size="15" aria-hidden="true"/></button>
          <button type="button" class="icon-button" :aria-label="`Move ${shape.kind} ${n} down`" :disabled="n===1" @click="moveLayerBy(shape,-1)"><ChevronDown :size="15" aria-hidden="true"/></button></li></ol>
        <p v-if="shapes.length" class="class-empty">Hidden and locked layers are for this session; the label keeps every shape.</p>
        <UiButton :disabled="!selected" @click="removeSelected"><Trash2 :size="14"/> Remove selected</UiButton>
      </template></template>
    <template v-else-if="panel==='Attributes'"><h3>Image attributes</h3><dl><dt>Source</dt><dd>{{ live?'Project photo':item.sample?'Synthetic room':'Local browser file' }}</dd><dt>Canvas coordinates</dt><dd>{{ live&&meta?`${meta.photo.width} × ${meta.photo.height} photo pixels (drawn in 600 × 300 units)`:'600 × 300 preview units' }}</dd><dt>Status</dt><dd>{{ item.state }}</dd></dl><label class="check-line"><input v-model="empty" type="checkbox" @change="dirty=true"> No objects to mark</label><p v-if="!live">Preview geometry only. Backend coordinate conversion is not connected.</p></template>
    <template v-else-if="panel==='Comments'"><h3>Comments</h3><p v-if="!comments.length">No comments yet.</p><p v-for="(c,i) in comments" :key="i" class="comment-preview">{{ typeof c==='string'?c:`${c.by}: ${c.text}` }}</p><form @submit.prevent="addComment"><textarea id="editor-comment" v-model="comment" class="text-input" aria-label="Comment" placeholder="Add a review note"/><UiButton type="submit">{{ live?'Add comment':'Add local comment' }}</UiButton></form></template>
    <template v-else-if="panel==='History'"><h3>Editing history</h3><p>{{ history.length }} changes available to undo.</p><p>{{ future.length }} changes available to redo.</p><p v-if="!live">History is kept for this editing session only.</p><template v-else><p v-if="!meta?.history?.length">No saves of this label yet.</p><p v-for="(h,i) in meta?.history||[]" :key="i">{{ h.state }} · {{ typeof h.shapes==='number'?`${h.shapes} shape${h.shapes===1?'':'s'}`:`${h.walls} walls, ${h.openings} openings` }}{{ h.faults?` · ${h.faults} to fix`:'' }} · {{ h.by }} · {{ new Date(h.at).toLocaleString() }}</p></template></template>
    <template v-else-if="panel==='Job details'"><h3>Job details</h3><dl><dt>Batch</dt><dd>{{state.batches.find(b=>b.id===item.batchId)?.name||'Project images'}}</dd><dt>Assignment</dt><dd>{{state.batches.find(b=>b.id===item.batchId)?.assignee||'Unassigned'}}</dd><dt>Instructions</dt><dd>{{state.batches.find(b=>b.id===item.batchId)?.instructions||'No instructions added.'}}</dd></dl></template><template v-else><h3>Raw annotation preview</h3><pre>{{ JSON.stringify(shapes,null,2) }}</pre></template>
  </aside><section class="editor-canvas-area">
    <div class="editor-toolbar" role="toolbar" aria-label="Tools" aria-orientation="vertical"><template v-for="(t,i) in rail" :key="t.id"><span v-if="i&&t.group!==rail[i-1].group" class="rail-divider" aria-hidden="true"/><button type="button" class="icon-button" :aria-label="t.label" :aria-pressed="t.pressed" :aria-disabled="t.off?'true':undefined" :aria-describedby="card?.entry.id===t.id?'tool-card':undefined" :data-tool="t.id" @click="railRun(t)" @pointerenter="railEnter($event,t)" @pointerleave="railLeave" @focus="railFocus($event,t)" @blur="railBlur"><component :is="t.icon" :size="19" aria-hidden="true"/></button></template></div>
    <section v-if="painting" class="sam-selection-panel brush-panel" aria-label="Brush"><div class="sam-selection-heading"><strong>{{ tool==='eraser'?'Eraser':'Brush' }}</strong><span>{{ brushSize }} px</span></div>
      <div class="brush-row"><div class="brush-modes" role="radiogroup" aria-label="Paint or erase"><button type="button" role="radio" :aria-checked="tool==='brush'" @click="setTool('brush')"><Brush :size="15" aria-hidden="true"/> Brush (R)</button><button type="button" role="radio" :aria-checked="tool==='eraser'" @click="setTool('eraser')"><Eraser :size="15" aria-hidden="true"/> Eraser (E)</button></div>
        <label class="brush-size"><span>Size</span><input v-model.number="brushSize" type="range" min="1" :max="brushMax" aria-label="Brush size in photo pixels"></label></div>
      <p>{{ tool==='eraser' ? (brushTarget?`Erasing from the selected ${brushTarget.kind} mask.`:'Erasing from the mask under the pointer. Select a mask to erase only from it.') : brushTarget ? `Painting adds to the selected ${brushTarget.kind} mask.` : kind ? `Painting starts a new ${kind} mask. Select a mask to add to it.` : 'Add or select a project class first.' }} [ and ] change the size; each stroke is one step of Undo.</p><p v-if="!brushTarget&&kind&&maskOff(kind)" role="status">{{ maskOff(kind) }}</p></section>
    <section v-if="tool==='smart'||tool==='outline'" class="sam-selection-panel" :aria-label="tool==='smart'?'Smart Select':'Box to outline'"><div class="sam-selection-heading"><strong>{{ tool==='smart'?'Smart Select':'Box to outline' }}</strong><span v-if="tool==='smart'">{{samPoints.length}} / 32 points</span></div><p v-if="tool==='smart'">Choose your class, then click the object. Click to add an area; Shift-click or right-click removes one. Enter keeps the outline, Esc drops it.</p><p v-else>Choose your class, then draw a box around one object: SAM 3 turns it into the object's outline. Enter keeps it, Esc drops it.</p><ModelSourcePicker v-model="samModel" :sources="samSources" :disabled="samBusy"/><p>{{ samSources.length ? (tool==='smart' ? `Each new click asks SAM 3 for a new outline${samPrice ? `, charged ${samPrice}` : ''}, paid from your balance.` : `Each box asks SAM 3 once${samPrice ? `, charged ${samPrice}` : ''}, paid from your balance.`) : 'SAM 3 is available when this photo can be edited.' }} Keeping it does not save or approve the label.</p><div class="sam-selection-actions"><template v-if="tool==='smart'"><UiButton :aria-pressed="samPointMode===1" @click="samPointMode=1">Add area</UiButton><UiButton :aria-pressed="samPointMode===0" @click="samPointMode=0">Remove area</UiButton></template><UiButton :disabled="(!samPoints.length&&!samBox)||samBusy" @click="sam.retry">Ask again</UiButton><UiButton :disabled="!samPoints.length&&!samBox" @click="clearSam">Drop (Esc)</UiButton><UiButton variant="primary" :disabled="!samKept.length||samBusy||samBlocked" @click="applySam">Keep outline (Enter)</UiButton></div><p v-if="samMessage" role="status">{{samMessage}}</p><p v-if="samMissingWay" role="status">SAM 3 answered no {{ smartWay==='masks'?'mask':'polygon' }} for this object. Switch to {{ smartWay==='masks'?'Polygons':'Masks' }} to see what it answered.</p><p v-if="!kind">Add or select a project class first.</p></section>
    <div ref="scrollBox" class="canvas-scroll" @wheel="onWheel" @pointermove="trackCross" @pointerleave="cross=null"><div class="canvas-rotor" :style="rotorStyle"><div class="canvas-stage" :style="stageStyle"><RoomArt plain v-if="item.sample" :variant="item.variant||0" :style="{filter:photoFilter}"/><img v-else :src="item.url" :alt="item.name" :style="{filter:photoFilter}" @load="imageLoaded">
      <MaskLayer v-if="meta" v-show="overlays" :shapes="shapes" :color-of="maskColor" :selected="selected" :hidden="hiddenIds" :photo-width="meta.photo.width" :photo-height="meta.photo.height" :live="brushLive"/>
      <MaskLayer v-if="meta&&previewMasks.length" class="mask-preview" :shapes="previewMasks" :color-of="previewMaskColor" :photo-width="meta.photo.width" :photo-height="meta.photo.height"/>
      <svg ref="canvas" :class="['annotation-overlay',`tool-${tool}`]" viewBox="0 0 600 300" preserveAspectRatio="none" @pointerdown="down" @pointermove="move" @pointerup="finish" @pointercancel="finish" @pointerleave="leave" @dblclick="dbl" @contextmenu="tool==='smart'&&$event.preventDefault()">
      <g v-if="tool==='smart'||tool==='outline'" class="sam-candidate" pointer-events="none"><rect v-if="samBox" :x="samBox[0]" :y="samBox[1]" :width="samBox[2]-samBox[0]" :height="samBox[3]-samBox[1]" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/><polygon v-for="shape in samPreview" :key="shape.id" :points="pts(shape.points)" :fill="colorOf(shape)" fill-opacity="0.28" :stroke="colorOf(shape)" stroke-width="2" stroke-dasharray="5 3" vector-effect="non-scaling-stroke"/><ellipse v-for="(p,i) in samPoints" :key="i" :cx="p.point[0]" :cy="p.point[1]" v-bind="handle(5)" :fill="p.label?'#2563eb':'#ef4444'" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g><g v-if="found" class="find-preview" pointer-events="none"><polygon v-for="shape in foundPolygons" :key="shape.id" :points="pts(shape.points)" :fill="found.assist?colorOf(shape):previewColor" :fill-opacity="foundFill" :stroke="found.assist?colorOf(shape):previewColor" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/></g><g v-if="overlays"><g v-for="shape in drawnShapes" :key="shape.id" :style="{pointerEvents:tool==='select'&&!lockedIds.has(shape.id)?'auto':'none'}"><polygon class="shape" :data-id="shape.id" :points="pts(shape.points)" :fill="colorOf(shape)" :fill-opacity="selected===shape.id?.32:.18" :stroke="colorOf(shape)" :stroke-width="selected===shape.id?3:2" stroke-linejoin="round" vector-effect="non-scaling-stroke" @pointerdown.stop="pickShape(shape)"/><template v-if="(tool==='select'||selected===shape.id)&&!lockedIds.has(shape.id)"><ellipse v-for="(p,i) in shape.points" :key="i" :class="['vertex',{picked:pickedPoint?.id===shape.id&&pickedPoint.i===i}]" :cx="p[0]" :cy="p[1]" v-bind="handle(pickedPoint?.id===shape.id&&pickedPoint.i===i?7:selected===shape.id?5:4)" :fill="pickedPoint?.id===shape.id&&pickedPoint.i===i?'#dc2626':'#fff'" :stroke="pickedPoint?.id===shape.id&&pickedPoint.i===i?'#fff':selected===shape.id?'#0f172a':colorOf(shape)" :stroke-width="pickedPoint?.id===shape.id&&pickedPoint.i===i?2:1.5" vector-effect="non-scaling-stroke" @pointerdown="beginMove($event,shape,i)"/></template></g></g>
      <g class="drawing-layer" pointer-events="none">
        <BrushCursor v-if="painting&&meta" :point="brushPoint" :size="brushSize" :photo-width="meta.photo.width" :photo-height="meta.photo.height" :erasing="tool==='eraser'"/>
        <template v-if="draft.length"><polygon v-if="draft.length>=2&&cursor" :points="pts([...draft,closing?draft[0]:cursor])" :fill="draftColor()" fill-opacity=".1" stroke="none"/><polyline :points="pts([...draft,...(cursor?[closing?draft[0]:cursor]:[])])" fill="none" :stroke="draftColor()" stroke-width="2" stroke-dasharray="7 5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><ellipse v-for="(p,i) in draft" :key="'d'+i" :cx="p[0]" :cy="p[1]" v-bind="handle(i===0?(closing?9:7):4)" :fill="i===0?'#dc2626':'#fff'" :stroke="i===0?'#fff':'#0f172a'" stroke-width="1.5" vector-effect="non-scaling-stroke"/></template>
        <template v-if="boxStart"><polygon :points="pts(boxCorners(boxStart,cursor||boxStart))" :fill="draftColor()" fill-opacity=".1" :stroke="tool==='outline'?'#64748b':draftColor()" stroke-width="2" stroke-dasharray="7 5" vector-effect="non-scaling-stroke"/><ellipse :cx="boxStart[0]" :cy="boxStart[1]" v-bind="handle(6)" fill="#dc2626" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/><ellipse v-if="cursor" :cx="cursor[0]" :cy="cursor[1]" v-bind="handle(4)" fill="#fff" stroke="#0f172a" stroke-width="1.5" vector-effect="non-scaling-stroke"/></template>
        <template v-if="cutFrom"><line :x1="cutFrom[0]" :y1="cutFrom[1]" :x2="(cursor||cutFrom)[0]" :y2="(cursor||cutFrom)[1]" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="8 5" stroke-linecap="round" vector-effect="non-scaling-stroke"/><ellipse :cx="cutFrom[0]" :cy="cutFrom[1]" v-bind="handle(6)" fill="#dc2626" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/></template>
      </g></svg></div>
      <div v-if="classPop&&popShape" class="class-pop" :style="popStyle" role="dialog" aria-label="Annotation editor" @pointerdown.stop>
        <header><strong>Annotation editor</strong><button class="icon-button" aria-label="Close the annotation editor" @click="savePop()"><X :size="15"/></button></header>
        <input ref="popInput" v-model="classPop.text" class="text-input" aria-label="Class of this shape" autocomplete="off" @input="classPop.error=''" @keydown.enter.prevent="savePop()" @keydown.down.prevent="popStep(1)" @keydown.up.prevent="popStep(-1)" @keydown.esc.prevent.stop="savePop()">
        <ul role="listbox"><li v-for="c in popMatches" :key="c.name" role="option" :aria-selected="c.name===classPop.text" :class="{active:c.name===classPop.text}" @click="savePop(c.name)"><i :style="{background:c.color}"/>{{ c.name }}</li></ul>
        <p v-if="classPop.error" class="field-error" role="alert">{{ classPop.error }}</p>
        <div v-if="live&&meta&&(popShape.mask||!maskOff(popShape.kind))" class="class-pop-convert"><UiButton v-if="popShape.mask" @click="convertToPolygon">Convert to polygon</UiButton><UiButton v-else @click="convertToMask">Convert to mask</UiButton></div>
        <div class="class-pop-actions"><UiButton class="danger" @click="deletePop"><Trash2 :size="13"/> Delete</UiButton><UiButton variant="primary" @click="savePop()">Save (Enter)</UiButton></div>
      </div></div><div v-if="cross&&crossOn" class="crosshair" aria-hidden="true"><i class="crosshair-x" :style="{top:cross.y+'px'}"/><i class="crosshair-y" :style="{left:cross.x+'px'}"/></div><div v-if="applied" class="applied-note" role="status"><Check :size="15" aria-hidden="true"/><span>{{ appliedWords(applied.count) }} · </span><button type="button" class="link-button" @click="undoApplied">Undo</button></div></div>
    <div class="editor-help" v-if="tool==='polygon'"><span>{{ draft.length?(closing?'Click the red point to close the polygon.':`${draft.length} point${draft.length===1?'':'s'}. Click the red first point, double-click or press Enter to finish; Backspace takes back the last point.`):'Click to place the first corner. Corners snap to other corners and to the photo edge.' }}</span><UiButton :disabled="draft.length<3" @click="finishPolygon">Finish polygon</UiButton><UiButton :disabled="!draft.length" @click="cancelDrawing">Cancel (Esc)</UiButton></div><div class="editor-help" v-else-if="tool==='box'||tool==='outline'"><span>{{ boxStart?'Click the opposite corner to finish the box. Esc cancels.':'Click one corner, then the opposite corner, or drag from corner to corner.' }}</span><UiButton v-if="boxStart" @click="cancelDrawing">Cancel (Esc)</UiButton></div><div class="editor-help" v-else-if="tool==='split'"><span>{{ cutFrom?'Click on the other side of the shape: the dashed line is the cut.':'Click on one side of a shape, then on the other: the line cuts it in two. A click inside the shape becomes the new corner.' }}</span><UiButton v-if="cutFrom" @click="cancelDrawing">Cancel (Esc)</UiButton></div><div class="editor-help" v-else-if="tool==='smart'">Click the object to see its outline. Keep it with Enter; Undo removes a kept outline.</div><div class="editor-help" v-else-if="painting">{{ tool==='eraser'?'Drag over the mask to erase.':'Drag to paint the mask.' }} Esc drops a stroke while it is drawn.</div><div class="editor-help" v-else-if="tool==='pan'">Drag the photo, or scroll, to move it. Ctrl+scroll zooms at the pointer.</div><div class="editor-help" v-else><span>{{ pickedPoint?'Corner selected: drag it, or press Delete to remove it.':selected?'Click a corner to select it, double-click an edge to add one. Corners snap to other corners.':'Click a shape or one of its corners. Straighten keeps only the real corners.' }}</span><UiButton :disabled="!pickedPoint" @click="removePoint"><Trash2 :size="14"/> Delete point (Del)</UiButton><UiButton :disabled="!shapes.length" :title="selected?'Keep only the corners of the selected shape':'Keep only the corners of every shape'" @click="straighten">Straighten{{ selected?'':' all' }} (T)</UiButton></div><p v-if="detecting&&!detectOpen" class="editor-hint" role="status">{{ detecting.title }}: {{ detecting.now }}{{ detecting.seconds?` (${detecting.seconds} s)`:"" }}… <button class="link-button" @click="stopDetect">Stop</button></p><p v-if="hint" class="editor-hint" role="status">{{ hint }}</p>
    <footer class="editor-controls" aria-label="View"><button type="button" class="icon-button" aria-label="Zoom out (-)" title="Zoom out (-)" :disabled="zoom<=ZOOM_MIN" @click="zoomStep(-1)"><Minus :size="16" aria-hidden="true"/></button><output class="zoom-value" aria-label="Zoom">{{ zoom }}%</output><button type="button" class="icon-button" aria-label="Zoom in (+)" title="Zoom in (+)" :disabled="zoom>=ZOOM_MAX" @click="zoomStep(1)"><Plus :size="16" aria-hidden="true"/></button><button type="button" class="icon-button" :aria-pressed="viewLock" :aria-label="viewLock?'Zoom and position are kept for the next photo':'Keep zoom and position for the next photo'" :title="viewLock?'Zoom and position are kept for the next photo':'Keep zoom and position for the next photo'" @click="viewLock=!viewLock"><Lock v-if="viewLock" :size="16" aria-hidden="true"/><LockOpen v-else :size="16" aria-hidden="true"/></button><UiButton class="view-reset" title="Reset zoom, position, rotation, brightness and contrast (0)" @click="resetView">Reset</UiButton><span class="controls-divider" aria-hidden="true"/>
      <div class="tone"><button type="button" class="icon-button" aria-label="Brightness and contrast" title="Brightness and contrast" aria-haspopup="dialog" :aria-expanded="toneOpen" aria-controls="tone-pop" @click="toneOpen=!toneOpen"><SunMedium :size="16" aria-hidden="true"/></button>
        <div v-if="toneOpen" id="tone-pop" class="tone-pop" role="dialog" aria-label="Brightness and contrast" @keydown.esc.stop.prevent="toneOpen=false"><label><span>Brightness <output>{{ brightness }}%</output></span><input v-model.number="brightness" type="range" min="50" max="150" aria-label="Brightness"></label><label><span>Contrast <output>{{ contrast }}%</output></span><input v-model.number="contrast" type="range" min="50" max="200" aria-label="Contrast"></label><button type="button" class="link-button" @click="brightness=100;contrast=100">Back to normal</button></div></div>
      <button type="button" class="icon-button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" @click="keysOpen=true"><Keyboard :size="16" aria-hidden="true"/></button></footer></section>
    <aside class="editor-right"><p class="editor-batch-title">{{state.batches.find(b=>b.id===item.batchId)?.name||'Project images'}}</p><div class="editor-pagination"><UiButton :disabled="index===0" @click="selectImage(index-1)">←</UiButton><span>{{ index+1 }} / {{ scopedImages.length }}</span><UiButton :disabled="index===scopedImages.length-1" @click="selectImage(index+1)">→</UiButton></div><UiButton v-if="mayAddToDataset" variant="primary" class="right-action" :disabled="busy" @click="openAsk('dataset')"><Database :size="15" aria-hidden="true"/> Add to Dataset</UiButton><UiButton v-if="maySendToUnannotated" class="right-action" :disabled="busy" @click="openAsk('unannotated')"><Inbox :size="15" aria-hidden="true"/> Send to Unannotated</UiButton><UiButton :disabled="busy||(live&&!meta?.approving)" @click="review(true)"><Check :size="16"/> {{ live?'Approve':'Approve locally' }}</UiButton><UiButton :disabled="busy||(live&&!meta?.approving)" @click="review(false)"><X :size="16"/> Request changes</UiButton><UiBadge>{{ item.state }}</UiBadge><button v-for="(image,i) in scopedImages" :key="image.id" :class="['editor-thumb',{active:index===i}]" @click="selectImage(i)"><RoomArt v-if="image.sample" :variant="image.variant||0"/><img v-else :src="image.thumb||image.url" :alt="image.name" @error="image.thumb=''"><span>{{ image.name }}</span></button></aside>
  </div><UiDialog :open="reasonOpen" title="Request changes" @close="reasonOpen=false"><label class="field-label">What should the labeller change?<textarea v-model="reason" class="text-input" rows="4" maxlength="1000"/></label><p class="dialog-description">The label goes back to its labeller with this note.</p><div class="dialog-actions"><UiButton @click="reasonOpen=false">Cancel</UiButton><UiButton variant="primary" :disabled="busy||!reason.trim()" @click="sendBackLive">Send back</UiButton></div></UiDialog><UiDialog :open="!!toolDialog" :title="toolDialog" @close="toolDialog=''"><UiBadge tone="purple">Coming soon</UiBadge><p class="dialog-description">{{ toolDialog }} works on a project photo. Draw with the polygon or box tools here.</p><div class="dialog-actions"><UiButton @click="toolDialog=''">Close</UiButton></div></UiDialog><UiDialog :open="takeBackOpen" title="Take back this approval" @close="takeBackOpen=false"><p class="dialog-description">The label of {{ item?.name }} waits for approval again in the review queue, where it can be approved again or sent back to its labeller.</p><p v-if="meta?.in_versions?.length" class="dialog-description" role="note">{{ meta.in_versions.join(', ') }} {{ meta.in_versions.length===1?'keeps':'keep' }} the label {{ meta.in_versions.length===1?'it':'they' }} froze. A new version takes the label approved next.</p><p v-if="takeBackError" class="field-error" role="alert">{{ takeBackError }}</p><div class="dialog-actions"><UiButton @click="takeBackOpen=false">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="takeBackLive">{{ busy?'Taking back…':'Take back approval' }}</UiButton></div></UiDialog><UiDialog :open="leaving" title="Discard unsaved annotations?" @close="leaving=false"><p class="dialog-description">Your changes to this photo are not saved. Keep editing and save them, or discard them.</p><div class="dialog-actions"><UiButton @click="leaving=false">Keep editing</UiButton><UiButton @click="discard">Discard changes</UiButton></div></UiDialog>
  <UiDialog :open="askAction==='dataset'" title="Add this photo to the dataset?" @close="askAction=''"><p class="dialog-description">The label is saved and approved in one step, with the same checks as Approve. The photo is then part of the dataset.</p><p v-if="askError" class="field-error" role="alert">{{ askError }}</p><div class="dialog-actions"><UiButton @click="askAction=''">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="addToDatasetLive">{{ busy?'Adding…':'Add to Dataset' }}</UiButton></div></UiDialog>
  <UiDialog :open="askAction==='unannotated'" title="Send this photo to Unannotated?" @close="askAction=''"><p class="dialog-description">The photo leaves this batch and waits again with the board's unassigned photos. Your draft label is kept{{ dirty?', and your unsaved changes are saved into it first':'' }}.</p><p v-if="askError" class="field-error" role="alert">{{ askError }}</p><div class="dialog-actions"><UiButton @click="askAction=''">Cancel</UiButton><UiButton variant="primary" :disabled="busy" @click="sendToUnannotatedLive">{{ busy?'Sending…':'Send to Unannotated' }}</UiButton></div></UiDialog>
  <UiDialog class="keys-dialog" :open="keysOpen" title="Keyboard shortcuts" @close="keysOpen=false"><div class="keys-groups"><section v-for="g in KEY_GROUPS" :key="g.group" :aria-labelledby="`keys-${g.group}`"><h3 :id="`keys-${g.group}`">{{ g.group }}</h3><dl><div v-for="k in g.keys" :key="k.what" class="keys-row"><dt><kbd v-for="key in k.keys" :key="key">{{ key }}</kbd></dt><dd>{{ k.what }}<a v-if="k.slug" :href="helpArticle(k.slug)" target="_blank" rel="noopener" :aria-label="`Learn more: ${k.what}`">Learn more <ExternalLink :size="11" aria-hidden="true"/></a></dd></div></dl></section></div><div class="dialog-actions"><UiButton @click="keysOpen=false">Close</UiButton></div></UiDialog>
  <LabelAssistDialog :open="assistOpen" :project-ref="state.ref" :sources="meta?.detect?.sources||[]" :classes="state.classes" :preference="meta?.detect?.preference||''" :only="assistOnly" :may-change-classes="mayAddClass&&!meta?.readonly&&!meta?.approving" :busy="busy" :error="assistError" :add-class="addProjectClass" @close="assistOpen=false" @run="runAssist" @find="findFromAssist"/>
  <ToolHoverCard v-if="card" id="tool-card" :entry="card.entry" :anchor="card.rect" :unavailable="card.off" @enter="keepCard" @leave="railLeave"/>
</div>
  <UiDialog :open="editorClassOpen" title="Add a project class" @close="editorClassOpen=false"><form @submit.prevent="addEditorClass"><label class="field-label">Class name<input v-model="editorClassName" class="text-input" maxlength="40" placeholder="What do you want to label?" required></label><p v-if="editorClassError" class="field-error" role="alert">{{ editorClassError }}</p><div class="dialog-actions"><UiButton type="button" @click="editorClassOpen=false">Cancel</UiButton><UiButton type="submit" variant="primary">Add class</UiButton></div></form></UiDialog>
</template>
<style scoped>
.sam-selection-panel{width:100%;max-width:920px;margin-bottom:14px;padding:14px;background:#fff;border:1px solid #dce4ef;border-radius:12px;align-self:center}.sam-selection-heading{display:flex;justify-content:space-between;gap:10px;font-size:13px}.sam-selection-heading span{font-size:11px;color:#64748b}.sam-selection-panel p{font-size:12px;margin:8px 0;line-height:1.6}.sam-selection-panel :deep(.source-picker){max-width:420px}.sam-selection-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.sam-selection-actions .button{font-size:11px;padding:7px 10px}.sam-selection-actions [aria-pressed=true]{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}.annotation-overlay.tool-smart,.annotation-overlay.tool-outline{cursor:crosshair}.annotation-overlay.tool-brush,.annotation-overlay.tool-eraser{cursor:none}.sam-candidate{pointer-events:none}
.annotation-editor{position:fixed;inset:0;background:#f3f4f7;z-index:50;overflow:auto;scrollbar-gutter:stable}.editor-header{display:flex;gap:15px;align-items:center;padding:14px 20px;background:white;border-bottom:1px solid #dfe1e8;flex-wrap:wrap}.editor-header strong{font-size:12px}.editor-header>span:not(.badge){margin-left:auto;font-size:11px;color:#82788e}.editor-layout{display:grid;grid-template-columns:245px minmax(0,1fr) 180px;min-height:calc(100vh - 70px)}.editor-left,.editor-right{background:white;padding:18px;border-right:1px solid #dedee7;overflow:auto;max-height:calc(100vh - 70px)}.editor-panel-tabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:25px}.editor-panel-tabs button{font-size:10px;border:0;background:var(--aadml-tint);padding:8px;border-radius:5px;color:#81718e}.editor-panel-tabs button.active{color:var(--aadml-primary);background:var(--aadml-soft)}.editor-left h3{font-size:14px;margin-bottom:20px}.editor-left p{font-size:12px;margin:15px 0}.editor-left pre{font-size:10px;white-space:pre-wrap}.editor-left form{margin-top:20px}.editor-left form .button{margin-top:10px}.shape-list{margin:20px 0}.editor-left dl{font-size:12px;line-height:1.8}.editor-left dd{margin:0 0 15px;color:#8b7d98}.editor-canvas-area{min-width:0;display:flex;flex-direction:column;position:relative;padding:18px}.editor-toolbar{display:flex;gap:8px;padding:8px;background:white;border:1px solid var(--aadml-outline);border-radius:8px;align-self:center;margin-bottom:20px}.canvas-scroll{position:relative;overflow:hidden;flex:1;display:flex;align-items:center;justify-content:center;min-height:340px;border-radius:12px;overscroll-behavior:contain}.canvas-rotor{position:relative;flex-shrink:0}.canvas-stage{position:absolute;left:50%;top:50%;line-height:0}.canvas-stage>svg:not(.annotation-overlay),.canvas-stage>img{width:100%;height:100%;object-fit:fill;display:block}.annotation-overlay{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}.editor-help{display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--aadml-primary);padding:14px}.editor-controls{display:flex;justify-content:center;align-items:center;gap:10px;font-size:11px;flex-wrap:wrap}.editor-right{border-left:1px solid #dedee7;border-right:0;display:flex;flex-direction:column;gap:12px}.editor-right>.button{font-size:10px}.editor-pagination{display:flex;align-items:center;justify-content:space-between;font-size:11px}.editor-pagination .button{padding:6px;min-height:28px}.editor-thumb{border:1px solid var(--aadml-outline);background:white;border-radius:6px;padding:4px;color:var(--aadml-primary)}.editor-thumb.active{border-color:var(--aadml-focus);background:var(--aadml-tint)}.editor-thumb svg,.editor-thumb img{width:100%;height:78px;object-fit:cover}.editor-thumb span{display:block;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:7px 0}.comment-preview{background:var(--aadml-tint);padding:12px;border-radius:7px}@media(max-width:1000px){.editor-layout{grid-template-columns:200px minmax(0,1fr)}.editor-right{grid-column:1/-1;flex-direction:row;max-height:160px;overflow:auto}.editor-thumb{width:130px;flex-shrink:0}.editor-right>.button{align-self:center}.editor-pagination{min-width:120px}}@media(max-width:650px){.editor-layout{display:flex;flex-direction:column}.editor-left{max-height:250px;border-bottom:1px solid #ddd}.editor-canvas-area{min-height:400px}.editor-header{gap:8px}.editor-header .button{font-size:10px;padding:8px}.editor-header>.badge{display:none}.editor-header>span:not(.badge){margin-left:0}.editor-right{min-height:150px}.canvas-scroll{min-height:200px}}

/* Full-height labeling workspace with separate navigation, tools and filmstrip. */
.editor-layout{grid-template-columns:350px minmax(0,1fr) 160px}.editor-left{position:relative;padding:24px 18px 24px 96px}.editor-panel-tabs{position:absolute;left:0;top:0;bottom:0;width:78px;display:flex;flex-direction:column;flex-wrap:nowrap;gap:16px;border-right:1px solid #e0e4eb;padding:20px 5px;margin:0}.editor-panel-tabs button{display:flex;flex-direction:column;align-items:center;gap:8px;background:none;font-size:11px;padding:4px;color:#5f728d}.editor-panel-tabs button>span{display:grid;place-items:center;width:34px;height:34px;background:#f4f5f7;border-radius:9px}.editor-panel-tabs button.active{background:none;color:var(--aadml-primary)}.editor-panel-tabs button.active>span{background:var(--aadml-tint)}.editor-group{font-size:11px!important;margin:0 0 12px!important}.editor-label-tabs{display:flex;border-bottom:1px solid #dedee7;margin-bottom:20px}.editor-label-tabs button{flex:1;background:none;border:0;border-bottom:2px solid transparent;padding:12px;color:#6d7c92}.editor-label-tabs button[aria-pressed=true]{border-color:var(--aadml-focus);color:var(--aadml-focus)}.find-ai{width:100%;color:var(--aadml-primary);border-color:var(--aadml-outline)}.editor-canvas-area{background:#f8f9fb;padding:24px 74px 16px 18px;height:calc(100vh - 70px);min-height:520px}.canvas-scroll{flex:1 1 0;min-height:240px}.canvas-scroll{justify-content:center}.class-pop{position:absolute;z-index:4;width:250px;line-height:1.4;background:#fff;border:1px solid var(--aadml-outline);border-radius:10px;box-shadow:0 12px 32px #0f172a30;overflow:hidden;font-size:12px;text-align:left}.class-pop header{display:flex;align-items:center;justify-content:space-between;background:var(--aadml-tint);padding:6px 6px 6px 12px;color:var(--aadml-primary)}.class-pop header .icon-button{min-width:26px;min-height:26px}.class-pop .text-input{display:block;margin:10px;width:calc(100% - 20px);padding:8px 10px;font-size:12px}.class-pop ul{list-style:none;margin:0;padding:0 0 6px;max-height:150px;overflow:auto}.class-pop li{display:flex;align-items:center;gap:8px;padding:7px 14px;cursor:pointer}.class-pop li.active,.class-pop li:hover{background:var(--aadml-soft);color:var(--aadml-primary)}.class-pop li i{width:8px;height:8px;border-radius:50%}.class-pop .field-error{margin:0 12px 8px;font-size:11px}.class-pop-actions{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-top:1px solid #eef0f4}.class-pop-actions .button{min-height:30px;padding:6px 10px;font-size:11px}.class-pop .danger{color:#b42318;border-color:#fda29b}.class-pop .danger:hover:not(:disabled){background:#fef3f2;border-color:#f97066}.find-card{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;gap:12px;padding:20px 18px;background:#fff;overflow:auto;overscroll-behavior:contain;border-right:1px solid #e0e3eb;box-shadow:4px 0 16px rgba(15,23,42,.08)}.find-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.find-card-head h3{display:flex;align-items:center;gap:8px;margin:0;font-size:15px;color:#16213a}.find-card-head h3 svg{color:var(--aadml-primary)}.find-ask{display:flex;flex-direction:column;gap:6px}.find-ask .source-picker{margin-bottom:10px}.find-card .field-label{margin:4px 0 0;font-size:13px;font-weight:600;color:#344054}.find-optional{font-weight:400;color:#667085}.find-card .field-help{margin:0;font-size:12px;line-height:1.5;color:#5b6b82}.find-card .field-error{margin:0}.find-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}.find-count{margin:0;font-size:14px;font-weight:600;color:#16213a}.find-threshold{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#344054}.find-threshold input{width:100%;min-height:24px;accent-color:var(--aadml-primary);cursor:pointer}.find-threshold small{color:#5b6b82;font-size:12px}.start-over{margin:8px 0 12px}.start-over .detect-list{margin:8px 0}.detect-list{list-style:none;padding:0;margin:16px 0;display:flex;flex-direction:column;gap:8px;max-height:46vh;overflow:auto}.detect-list button{display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;text-align:left;background:#fff;border:1px solid #dfe3ea;border-radius:8px;padding:12px 14px;font-size:12px;color:#5b6b82;line-height:1.5}.detect-list button:hover{border-color:var(--aadml-focus);background:var(--aadml-tint)}.detect-list strong{color:#16213a;font-size:13px}.research-tag{background:#fef3c7;color:#92400e}.detect-wait{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:14px;border:1px solid var(--aadml-soft);border-radius:8px;margin:16px 0;font-size:12px}.detect-wait ol{margin:0;padding-left:18px}.detect-wait li.done{color:#27765a}.detect-wait li.now{font-weight:600;color:var(--aadml-primary)}.detect-wait li.next{color:#98a2b3}.link-button{background:none;border:0;padding:0;color:var(--aadml-primary);text-decoration:underline;font:inherit;cursor:pointer}.editor-help{font-size:11px}.editor-hint{text-align:center;font-size:11px;color:#b54708;margin:0 0 8px}.annotation-overlay.tool-select{cursor:default}.annotation-overlay.tool-pan{cursor:grab}.annotation-overlay.tool-pan:active{cursor:grabbing}.annotation-overlay .vertex{cursor:move}.annotation-overlay .vertex.picked{cursor:grabbing}.annotation-overlay .shape{cursor:pointer}.editor-right{padding:12px 8px}.editor-batch-title{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.editor-thumb img,.editor-thumb svg{height:110px}.editor-header strong{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:1100px){.editor-layout{grid-template-columns:290px minmax(0,1fr) 130px}.editor-right{grid-column:auto;flex-direction:column;max-height:calc(100vh - 70px)}.editor-thumb{width:100%}.editor-pagination{min-width:0}.editor-left{padding-left:88px}}@media(max-width:750px){.editor-layout{display:flex;flex-direction:column}.editor-left{min-height:290px;max-height:350px}.editor-panel-tabs{gap:6px;overflow:auto}.editor-right{flex-direction:row;max-height:180px;min-height:150px}.editor-thumb{width:120px}.editor-toolbar{top:20px;transform:none}.editor-canvas-area{min-height:580px;height:auto}.canvas-scroll{flex:none;height:420px}.editor-controls{gap:4px}.editor-header strong{max-width:160px}}

/* The rail (LABEL_EDITOR_TOOLS_PLAN.md 2.4): one column at the canvas's right edge, grouped by what the tools do. */
.editor-toolbar{position:absolute;right:12px;top:50%;transform:translateY(-50%);flex-direction:column;align-items:center;gap:2px;margin:0;padding:6px;max-height:calc(100% - 24px);overflow-y:auto;scrollbar-width:none;border:1px solid #e2e8f0;border-radius:12px;z-index:5;box-shadow:0 4px 14px #0f172a14}
.editor-toolbar .icon-button{margin:0;width:36px;height:36px;min-width:36px;border-radius:9px;color:#475569;cursor:pointer;transition:background .15s,color .15s}
.editor-toolbar .icon-button:hover{background:var(--aadml-soft);color:#1d4ed8}
.editor-toolbar .icon-button[aria-pressed=true]{background:var(--aadml-primary);color:#fff;box-shadow:0 2px 6px #2563eb44}
.editor-toolbar .icon-button[data-tool=labels][aria-pressed=true],.editor-toolbar .icon-button[data-tool=empty][aria-pressed=true]{background:var(--aadml-soft);color:#1d4ed8;box-shadow:inset 0 0 0 1px #bfdbfe}
.editor-toolbar .icon-button[aria-disabled=true]{color:#a3adbb;cursor:not-allowed}
.editor-toolbar .icon-button[aria-disabled=true]:hover{background:#f1f5f9;color:#a3adbb}
.editor-toolbar .icon-button:focus-visible{outline:2px solid var(--aadml-primary);outline-offset:1px}
.rail-divider{display:block;flex-shrink:0;width:22px;height:1px;margin:4px 0;background:#e2e8f0}
@media(pointer:coarse){.editor-toolbar .icon-button{width:44px;height:44px;min-width:44px}}
/* The crosshair: full width and height of the canvas, dashed in white and slate so it shows on any photo. */
.crosshair{position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden}
.crosshair i{position:absolute;display:block}
.crosshair-x{left:0;right:0;height:1px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.95) 0 6px,rgba(15,23,42,.7) 6px 12px)}
.crosshair-y{top:0;bottom:0;width:1px;background:repeating-linear-gradient(180deg,rgba(255,255,255,.95) 0 6px,rgba(15,23,42,.7) 6px 12px)}
.applied-note{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:6;display:flex;align-items:center;gap:6px;padding:9px 14px;background:#0f172a;color:#fff;border-radius:10px;font-size:13px;box-shadow:0 8px 24px #0f172a40}
.applied-note .link-button{color:#93c5fd;font-weight:600;min-height:28px}
/* The footer: zoom, the lock, reset, the brightness and contrast popover, the keyboard panel. */
.editor-controls{position:relative;justify-content:flex-start;gap:4px;margin-top:4px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:4px 6px;align-self:flex-start;box-shadow:0 2px 6px #0f172a0d}
.editor-controls .icon-button{margin:0;width:36px;height:36px;border-radius:8px;color:#475569;cursor:pointer}
.editor-controls .icon-button:hover:not(:disabled){background:var(--aadml-soft);color:#1d4ed8}
.editor-controls .icon-button[aria-pressed=true]{background:var(--aadml-soft);color:#1d4ed8}
.editor-controls .icon-button:disabled{opacity:.45;cursor:default}
.editor-controls .icon-button:focus-visible{outline:2px solid var(--aadml-primary);outline-offset:1px}
.zoom-value{min-width:46px;text-align:center;font-size:12px;font-weight:600;color:#0f172a;font-variant-numeric:tabular-nums}
.view-reset{min-height:32px;padding:6px 10px;font-size:12px}
.controls-divider{width:1px;height:20px;margin:0 4px;background:#e2e8f0}
.tone{position:relative}
.tone-pop{position:absolute;left:0;bottom:calc(100% + 8px);z-index:8;width:240px;display:flex;flex-direction:column;gap:12px;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 12px 30px #0f172a26}
.tone-pop label{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#344054}
.tone-pop label span{display:flex;justify-content:space-between}
.tone-pop output{font-variant-numeric:tabular-nums;color:#0f172a;font-weight:600}
.tone-pop input{width:100%;accent-color:var(--aadml-primary)}
.tone-pop .link-button{align-self:flex-start;font-size:12px}
/* The side panels: classes in this photo and unused, each with its AI button; layers with show, lock and order. */
.ai-actions{display:flex;flex-direction:column;gap:8px;margin:4px 0 8px}.ai-actions .button{margin:0}
.assist-open{width:100%;background:var(--aadml-primary);border-color:var(--aadml-primary);color:#fff}
.assist-open:hover:not([aria-disabled=true]){background:#1d4ed8}
.assist-open[aria-disabled=true]{background:#e2e8f0;border-color:#e2e8f0;color:#64748b;cursor:not-allowed}
.class-use{margin:14px 0;padding:12px;border:1px solid #e2e8f0;border-radius:12px;background:#fbfcfe}
.class-use h4{margin:0 0 8px;font-size:12px;font-weight:600;color:#344054}
.class-use ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.class-use li{display:flex;align-items:center;gap:4px}
.class-pick{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:36px;padding:6px 8px;border:0;border-radius:8px;background:none;color:#334155;font-size:12.5px;text-align:left;cursor:pointer}
.class-pick span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.class-pick i{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.class-pick:hover,.class-pick[aria-pressed=true]{background:var(--aadml-soft);color:#1d4ed8}
.class-pick:focus-visible,.class-ai:focus-visible,.layer-row button:focus-visible{outline:2px solid var(--aadml-primary);outline-offset:1px}
.class-count{min-width:24px;padding:1px 7px;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:11px;font-weight:600;text-align:center;font-variant-numeric:tabular-nums}
.class-ai{margin:0;width:36px;height:36px;border-radius:8px;color:#2563eb;cursor:pointer}
.class-ai:hover{background:var(--aadml-soft)}
.class-ai[aria-disabled=true]{color:#a3adbb;cursor:not-allowed}
.editor-left .class-empty{margin:4px 0;font-size:12px;color:#64748b}
.class-add{margin-top:8px}
.layer-list{list-style:none;padding:0;max-height:none!important;display:flex;flex-direction:column;gap:4px}
.layer-row{display:flex;align-items:center;gap:2px;padding:2px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}
.layer-row.active{border-color:#93c5fd;background:var(--aadml-soft)}
.layer-row.layer-hidden .layer-name{opacity:.55}
.layer-name{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:36px;padding:6px 8px;border:0;background:none;color:#334155;font-size:12px;text-align:left;cursor:pointer}
.layer-name>span{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.layer-name small{margin-left:auto;color:#64748b;font-size:11px}
.layer-row .icon-button{margin:0;width:30px;height:30px;min-width:30px;border-radius:7px;color:#475569;cursor:pointer}
.layer-row .icon-button:hover:not(:disabled){background:#eef2f7}
.layer-row .icon-button[aria-pressed=true]{color:#1d4ed8;background:#e0ecff}
.layer-row .icon-button:disabled{opacity:.35;cursor:default}
.right-action{width:100%;font-size:11px!important;white-space:normal!important;line-height:1.3;text-align:center}
/* Masks not kept yet (found, or a Smart Select candidate): an edge round them says so. */
.mask-preview{filter:drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #0f172a)}
.brush-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:8px}
.brush-modes{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:10px;background:#f2f4f7}
.brush-modes button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 12px;border:0;border-radius:8px;background:none;color:#475569;font-size:12px;font-weight:550;cursor:pointer}
.brush-modes button[aria-checked=true]{background:#fff;color:#0f172a;box-shadow:0 1px 3px #10182826}
.brush-modes button:focus-visible{outline:2px solid var(--aadml-primary);outline-offset:1px}
.brush-size{display:flex;align-items:center;gap:8px;font-size:12px;color:#344054}
.brush-size input{width:160px;accent-color:var(--aadml-primary)}
.class-pop-convert{padding:0 10px 8px}.class-pop-convert .button{width:100%;min-height:30px;font-size:11px;margin:0}
/* The keyboard panel. */
.keys-dialog{width:min(760px,calc(100% - 32px));max-height:calc(100vh - 48px);overflow:auto}
.keys-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 28px;margin-top:16px}
.keys-groups h3{margin:0 0 6px;font-size:13px;color:#344054}
.keys-groups dl{margin:0}
.keys-row{display:grid;grid-template-columns:118px 1fr;gap:10px;align-items:baseline;padding:5px 0;border-top:1px solid #f1f5f9;font-size:12.5px}
.keys-row dt{display:flex;gap:4px;flex-wrap:wrap}
.keys-row dd{margin:0;color:#475569}
.keys-row dd a{margin-left:6px;display:inline-flex;align-items:center;gap:2px;color:#1d4ed8;font-size:11.5px}
.keys-row kbd{min-width:22px;padding:0 6px;border:1px solid #cbd5e1;border-bottom-width:2px;border-radius:6px;background:#f8fafc;color:#334155;font:600 11px/20px var(--aadml-font,inherit);text-align:center}
@media(max-width:700px){.keys-groups{grid-template-columns:1fr}}
@media(prefers-reduced-motion:no-preference){.canvas-stage{transition:transform .2s ease}}
@media(prefers-reduced-motion:reduce){.editor-toolbar .icon-button{transition:none}}
</style>
