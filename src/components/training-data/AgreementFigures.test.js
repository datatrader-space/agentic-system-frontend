// @vitest-environment jsdom
// How closely two labellers agreed, in plain words, where a person looks at a batch (the assignment's page) and at a
// dataset version (its card in Versions): only the figures the server measured; nothing when neither exists.
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AnnotationJob from '../../../training-data/src/components/AnnotationJob.vue';
import ProjectStudio from '../../../training-data/src/components/ProjectStudio.vue';
import { agreementOf } from '../../../training-data/src/agreementWords.js';
import { applyStep } from '../../../training-data/src/api/annotate.js';

const STUBS = { UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="stub-dialog"><slot/></div>' }, RoomArt: true };
function job(row) {
  const state = { live: true, ref: '~1', labellers: [], images: [] };
  return mount(AnnotationJob, { props: { batch: { id: 'a1', number: 1, name: 'Batch 1', may: {}, timeline: [], agreement: agreementOf(row) }, state },
    global: { stubs: STUBS } });
}
const CORNERS = "Labellers agree: corners within 0.8 % of the photo's diagonal (4 photos)";
const MASKS = 'Masks overlap 78 % (4 photos)';

describe('a batch says how closely its labellers agreed', () => {
  it('shows both figures with the photos they come from', () => {
    const w = job({ agreement: 0.0081, agreement_mask_iou: 0.78, agreement_photos: 4 });
    expect(w.findAll('.job-agreement li').map(li => li.text())).toEqual([CORNERS, MASKS]);
  });
  it('shows only the figure that exists', () => {
    expect(job({ agreement: null, agreement_mask_iou: 0.78, agreement_photos: 4 }).findAll('.job-agreement li').map(li => li.text())).toEqual([MASKS]);
    expect(job({ agreement: 0.0081, agreement_photos: 4 }).findAll('.job-agreement li').map(li => li.text())).toEqual([CORNERS]);
  });
  it('shows nothing, not even a heading, when neither was measured', () => {
    const w = job({ agreement: null, agreement_mask_iou: null, agreement_photos: 0 });
    expect(w.find('.job-agreement').exists()).toBe(false);
    expect(w.text()).not.toContain('Agreement');
    expect(w.text()).not.toContain('—');
  });
  it('an action\'s answer brings the new figures', () => {
    const batch = { agreement: agreementOf({}) };
    applyStep(batch, { state_label: 'In review', column: 'In review', total: 4, done: 4, agreement: 0.012, agreement_mask_iou: null, agreement_photos: 2 });
    expect(batch.agreement).toEqual({ agreement: 0.012, maskIou: null, photos: 2 });
    applyStep(batch, { state_label: 'In review', column: 'In review', total: 4, done: 4 });   // an answer without them keeps them
    expect(batch.agreement.photos).toBe(2);
  });
});

describe('a dataset version says how closely its labellers agreed', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const version = (name, extra) => ({ name, title: name, kind: 'train_val', kind_label: 'Training / validation', photos: 4, split_counts: { train: 3, val: 1 },
    recipe: {}, manifest: '#', ...extra });
  it('shows the figures that exist on each card, and nothing on a card without them', async () => {
    const versions = [version('v1', { agreement: 0.0081, agreement_mask_iou: 0.7856 }), version('v2', { agreement: null, agreement_mask_iou: 0.5 }), version('v3', { agreement: null })];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ versions, kinds: [], sizes: [], can_publish: false, refused: '' }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const w = mount(ProjectStudio, { props: { page: 'versions', project: { ref: '~1', id: 1 } }, global: { stubs: { ...STUBS, AnnotationEditor: true } } });
    await flushPromises();
    const cards = w.findAll('article.panel');
    expect(cards).toHaveLength(3);
    expect(cards[0].findAll('.version-agreement').map(p => p.text())).toEqual(["Labellers agree: corners within 0.8 % of the photo's diagonal", 'Masks overlap 78.6 %']);
    expect(cards[1].findAll('.version-agreement').map(p => p.text())).toEqual(['Masks overlap 50 %']);
    expect(cards[2].findAll('.version-agreement')).toHaveLength(0);
    expect(cards[2].text()).not.toContain('agree');
    w.unmount();
  });
});
