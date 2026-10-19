import { reactive } from 'vue';
const projects = new Map();
let nextId = 100;
// A real project (`real:<ref>`) gets no demo photos: its pages not connected yet show empty, never invented data.
export function getPreview(id = 'room-walls') {
  if (!projects.has(id)) projects.set(id, reactive({
    batches: (id.startsWith('preview-') || id === 'interior-library' || id.startsWith('real:')) ? [] : [{ id: 'demo-batch', name: 'Interior collection', count: 6, status: 'Unassigned', tags: ['interior'], assignee: 'Unassigned', group: 'Demo home 01' }],
    images: (id.startsWith('preview-') || id === 'interior-library' || id.startsWith('real:')) ? [] : Array.from({ length: 6 }, (_, i) => ({ id: `demo-${i}`, batchId:'demo-batch', name: `room-${String(i+1).padStart(2,'0')}.png`, sample: true, variant: i % 2, state: i < 2 ? 'Accepted' : 'Unlabeled', tags: ['interior'], shapes: i < 2 ? [{id:1, kind:'wall', points:[[178,48],[460,48],[460,217],[178,217]],corner:'room'}] : [] })),
    classes: [{name:'wall',color:'#8b5cf6'}, {name:'window',color:'#10b981'}, {name:'door',color:'#f59e0b'}], tags: ['interior', 'review'],
    versions: [], runs: [], models: [], activeRules: [], workflows: [], selectedImage: null,
  }));
  return projects.get(id);
}
export function addPreviewBatch(id, batch) {
  const state = getPreview(id);
  const batchId=`batch-${++nextId}`;
  state.batches.unshift({...batch,id:batchId,status:'Unassigned',assignee:'Unassigned'});
  for (const file of batch.files || []) state.images.push({...file,batchId,id:`image-${++nextId}`,state:'Unlabeled',shapes:[],tags:[...batch.tags]});
}

// Assignment determines the work queue; completed/review states keep their columns.
export function batchColumn(batch) {
  if (['In review', 'Dataset'].includes(batch.status)) return batch.status;
  const assignee = batch.assignee?.trim();
  return !assignee || assignee.toLowerCase() === 'unassigned' ? 'Unassigned' : 'Annotating';
}

export function assignPreviewMedia(state, batchId, options) {
 const source=state.batches.find(b=>b.id===batchId);
 if(!source) throw new Error('Batch not found.');
 const images=state.images.filter(i=>i.batchId===batchId);
 if(!Number.isInteger(options.count)||options.count<1||options.count>images.length) throw new Error('Choose a valid number of images.');
 if(!['Me','Demo labeller'].includes(options.assignee)) throw new Error('Choose an existing labeling member. Draft invitees cannot be assigned.');
 const pool=[...images];
 if(options.shuffle) for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 const picked=pool.slice(0,options.count);
 let job=source;
 if(picked.length<images.length){job={...source,id:`batch-${++nextId}`,name:`${source.name} - assignment`,tags:[...(source.tags||[])],timeline:[]};state.batches.push(job);picked.forEach(i=>i.batchId=job.id);source.count=images.length-picked.length;}
 job.count=picked.length;job.assignee=options.assignee;job.instructions=options.instructions||'';job.status='Annotating';job.timeline??=[];job.timeline.unshift({text:`${picked.length} images assigned to ${options.assignee} locally`,time:new Date().toLocaleString()});
 return state.batches.find(b=>b.id===job.id);
}
