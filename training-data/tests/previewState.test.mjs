import test from 'node:test';
import assert from 'node:assert/strict';
import {getPreview,addPreviewBatch,batchColumn,assignPreviewMedia} from '../src/previewState.js';
test('new preview project starts empty and stays isolated from another project',()=>{
 const a=getPreview('preview-test-a'), b=getPreview('preview-test-b');
 assert.equal(a.images.length,0); assert.equal(b.images.length,0);
 addPreviewBatch('preview-test-a',{name:'Test batch',count:1,tags:['synthetic'],files:[{name:'sample.png',sample:true}],group:'Demo'});
 assert.equal(a.images.length,1);assert.equal(b.images.length,0);
 assert.equal(a.images[0].batchId,a.batches[0].id);
 assert.equal(a.images[0].state,'Unlabeled');
 assert.notEqual(a.images[0].id,a.batches[0].id);
 a.images[0].tags.push('review');assert.deepEqual(a.batches[0].tags,['synthetic']);
});
test('sample annotations are fresh for each project',()=>{
 const a=getPreview('sample-a'),b=getPreview('sample-b');
 a.images[0].shapes[0].points[0][0]=42;
 assert.equal(b.images[0].shapes[0].points[0][0],178);
 assert.equal(a.images[0].batchId,'demo-batch');
});

test('unassigned batches stay out of annotating even after a draft status change',()=>{
 assert.equal(batchColumn({status:'Annotating',assignee:'Unassigned'}),'Unassigned');
 assert.equal(batchColumn({status:'Annotating',assignee:''}),'Unassigned');
 assert.equal(batchColumn({status:'Unassigned',assignee:'Me'}),'Annotating');
 assert.equal(batchColumn({status:'Annotating',assignee:'Demo labeller'}),'Annotating');
 assert.equal(batchColumn({status:'In review',assignee:'Unassigned'}),'In review');
 assert.equal(batchColumn({status:'Dataset',assignee:'Me'}),'Dataset');
});

test('partial assignment leaves remaining media unassigned and isolates the new job',()=>{
 const s=getPreview('assignment-regression');
 const job=assignPreviewMedia(s,'demo-batch',{count:2,assignee:'Demo labeller',shuffle:false,instructions:'Outline walls'});
 assert.equal(s.images.filter(i=>i.batchId===job.id).length,2);
 assert.equal(s.images.filter(i=>i.batchId==='demo-batch').length,4);
 assert.equal(batchColumn(s.batches.find(b=>b.id==='demo-batch')),'Unassigned');
 assert.equal(batchColumn(job),'Annotating');assert.equal(job.instructions,'Outline walls');
 assert.throws(()=>assignPreviewMedia(s,'demo-batch',{count:0,assignee:'Me'}));
 assert.throws(()=>assignPreviewMedia(s,'demo-batch',{count:5,assignee:'Me'}));
 assert.throws(()=>assignPreviewMedia(s,'demo-batch',{count:1,assignee:'draft@example.com'}));
 const rest=assignPreviewMedia(s,'demo-batch',{count:4,assignee:'Me',shuffle:true});
 assert.equal(rest.id,'demo-batch');assert.equal(s.batches.length,2);assert.equal(s.images.length,6);
});
