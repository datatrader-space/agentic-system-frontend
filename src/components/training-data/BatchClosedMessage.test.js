// @vitest-environment jsdom
// When Send to Unannotated takes the last photo of a batch, the server closes the batch (state "rejected") and the
// board no longer shows it. The page goes back to the board and says where it went, instead of letting it vanish.
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import ProjectStudio from '../../../training-data/src/components/ProjectStudio.vue';

const STUBS = { UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="stub-dialog"><slot/></div>' }, RoomArt: true,
  AnnotationJob: true, AnnotationEditor: true };
const row = state => ({ number: 3, code: 'BABC12', name: 'Batch 3', given_name: 'Batch 3', state, state_label: state === 'sent' ? 'With the labeller' : 'Rejected',
  column: state === 'sent' ? 'Annotating' : 'Rejected', labeller: { id: 2, name: 'Sajid' }, second_labeller: null, instructions: '',
  total: state === 'sent' ? 1 : 0, done: 0, mine: true, agreement: null, agreement_mask_iou: null, agreement_photos: 0 });

afterEach(() => { vi.unstubAllGlobals(); });

it('the batch closed by its last Send to Unannotated: back on the board, told where it went', async () => {
  let closed = false;
  const answer = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  vi.stubGlobal('fetch', vi.fn(async url => {
    const path = String(url);
    if (path.includes('/board/')) return answer({ assignments: [row(closed ? 'rejected' : 'sent')], uploads: [], app_photos: 0, counts: {}, photos: 0,
      can_batch: true, can_upload: true, refused: '' });
    if (path.includes('/assignments/3/')) return answer({ ...row(closed ? 'rejected' : 'sent'), may: {}, timeline: [],
      photos: closed ? [] : [{ id: 'p1', name: 'room.jpg', image: '/p1.jpg', width: 10, height: 10, state: 'given', label_state: 'draft' }] });
    if (path.includes('/classes/')) return answer({ classes: [], can_change: false, locked: false });
    return answer({});
  }));
  const w = mount(ProjectStudio, { props: { page: 'annotate', project: { ref: '~1', id: 1 }, openAssignment: 3 }, global: { stubs: STUBS } });
  await flushPromises();
  w.findComponent({ name: 'AnnotationJob' }).vm.$emit('edit');
  await flushPromises();
  closed = true;
  w.findComponent({ name: 'AnnotationEditor' }).vm.$emit('close', { closed: true });
  await flushPromises();
  expect(w.find('.annotation-board').exists()).toBe(true);
  expect(w.text()).toContain('Batch 3 is closed: its last photo went back to Unassigned, with its labels kept as drafts.');
  expect(w.text()).not.toContain('BABC12');                            // the closed batch is on no column of the board
  w.unmount();
});

it('an ordinary close of the editor says nothing about a closed batch', async () => {
  const answer = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  vi.stubGlobal('fetch', vi.fn(async url => {
    const path = String(url);
    if (path.includes('/board/')) return answer({ assignments: [row('sent')], uploads: [], app_photos: 0, counts: {}, photos: 0, can_batch: true, can_upload: true, refused: '' });
    if (path.includes('/assignments/3/')) return answer({ ...row('sent'), may: {}, timeline: [],
      photos: [{ id: 'p1', name: 'room.jpg', image: '/p1.jpg', width: 10, height: 10, state: 'given', label_state: 'draft' }] });
    if (path.includes('/classes/')) return answer({ classes: [], can_change: false, locked: false });
    return answer({});
  }));
  const w = mount(ProjectStudio, { props: { page: 'annotate', project: { ref: '~1', id: 1 }, openAssignment: 3 }, global: { stubs: STUBS } });
  await flushPromises();
  w.findComponent({ name: 'AnnotationJob' }).vm.$emit('edit');
  await flushPromises();
  w.findComponent({ name: 'AnnotationEditor' }).vm.$emit('close');
  await flushPromises();
  expect(w.text()).not.toContain('is closed');
  expect(w.findComponent({ name: 'AnnotationJob' }).exists()).toBe(true);   // still on the batch's page
  w.unmount();
});
