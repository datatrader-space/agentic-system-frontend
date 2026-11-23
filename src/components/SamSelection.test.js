// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { useSamSelection } from '../../training-data/src/useSamSelection.js';
afterEach(()=>vi.useRealTimers());
const context = () => ({project:'~project',photo:'photo-1',name:'helmet',width:1200,height:800,allowed:true});
test('clicks and exclusions use photo pixels and remain candidates until explicitly applied by the editor',async()=>{
  const request=vi.fn().mockResolvedValue({state:'ready',shapes:[{kind:'helmet',points:[[1,1],[2,1],[2,2]]}]});
  const s=useSamSelection(context,request); expect(request).not.toHaveBeenCalled();
  s.add([300,150]); await flushPromises();
  expect(request).toHaveBeenLastCalledWith('~project','photo-1','helmet',{coords:[[600,400]],labels:[1]});
  expect(s.candidate.value).toHaveLength(1);
  s.add([450,225],0); await flushPromises();
  expect(request).toHaveBeenLastCalledWith('~project','photo-1','helmet',{coords:[[600,400],[900,600]],labels:[1,0]});
  s.clear(); expect(s.candidate.value).toEqual([]); expect(s.points.value).toEqual([]);
});
test('a late response cannot affect another image or a discarded selection',async()=>{
  let answer;const request=vi.fn(()=>new Promise(resolve=>{answer=resolve;}));
  const s=useSamSelection(context,request); s.add([20,30]); s.clear();
  answer({state:'ready',shapes:[{kind:'helmet'}]});await flushPromises();
  expect(s.candidate.value).toEqual([]); expect(s.points.value).toEqual([]);expect(s.working.value).toBe(false);
});
test('no class, read-only or negative-first clicks never invoke a model',()=>{
  const request=vi.fn(); const missing=useSamSelection(()=>({...context(),name:''}),request); missing.add([1,2]);
  const blocked=useSamSelection(()=>({...context(),allowed:false}),request);blocked.add([1,2]);
  const normal=useSamSelection(context,request);normal.add([1,2],0);
  expect(request).not.toHaveBeenCalled();expect(normal.message.value).toContain('click on the object');
});
test('Box to outline asks with the box in photo pixels, and a later click keeps the box',async()=>{
  const request=vi.fn().mockResolvedValue({state:'ready',shapes:[{kind:'helmet',mask:{size:[800,1200],counts:'abc'}}],other:[{kind:'helmet',points:[[1,1],[2,1],[2,2]]}]});
  const s=useSamSelection(context,request);s.outline([450,225,150,75]);await flushPromises();
  expect(request).toHaveBeenLastCalledWith('~project','photo-1','helmet',{coords:[],labels:[]},[300,200,900,600]);
  expect(s.candidate.value).toHaveLength(1);expect(s.other.value).toHaveLength(1);
  s.add([300,150],0);await flushPromises();   // a remove click refines the boxed object
  expect(request).toHaveBeenLastCalledWith('~project','photo-1','helmet',{coords:[[600,400]],labels:[0]},[300,200,900,600]);
  s.clear();expect(s.box.value).toBe(null);expect(s.other.value).toEqual([]);
});
test('starting polls the same points, while discard cancels further polls',async()=>{
  vi.useFakeTimers();const request=vi.fn().mockResolvedValue({state:'waiting',title:'SAM 3',now:'Starting'});
  const s=useSamSelection(context,request);s.add([20,30]);await flushPromises();
  expect(s.working.value).toBe(true);await vi.advanceTimersByTimeAsync(4000);expect(request).toHaveBeenCalledTimes(2);
  s.clear();await vi.advanceTimersByTimeAsync(8000);expect(request).toHaveBeenCalledTimes(2);
});
