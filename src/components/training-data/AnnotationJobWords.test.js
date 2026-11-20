// @vitest-environment jsdom
// An assignment's own words (found 2026-11-18 on production): the Accept dialog says one photo in the singular; the
// submit dialog's field is not named after the dialog again ("Submit for review Submit for review"); an assignment
// accepted into the dataset offers its photos to look at, not "Continue Annotating".
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AnnotationJob from '../../../training-data/src/components/AnnotationJob.vue';

const STUBS = { UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="stub-dialog"><h2>{{ title }}</h2><slot/></div>' },
  RoomArt: true };
const photo = (id, extra = {}) => ({ id, batchId: 'a1', name: `room-${id}.jpg`, labelled: true, state: 'In review', shapes: [], tags: [], ...extra });
function job(batch, images) {
  const state = { live: true, ref: '~1', labellers: [], images };
  return mount(AnnotationJob, { props: { batch: { id: 'a1', number: 1, name: 'Batch 1', may: {}, timeline: [], ...batch }, state },
    global: { stubs: STUBS } });
}
const button = (w, text) => w.findAll('button').find(b => b.text().trim() === text);

describe('An assignment says what it is', () => {
  it('Accept all says one photo in the singular and several in the plural', async () => {
    const one = job({ status: 'In review', may: { review: true } }, [photo(1)]);
    await button(one, 'Accept all').trigger('click');
    await flushPromises();
    expect(one.text()).toContain('The 1 photo of this batch is accepted and goes into the dataset.');
    expect(one.text()).not.toContain('All 1 photo');
    const two = job({ status: 'In review', may: { review: true } }, [photo(1), photo(2)]);
    await button(two, 'Accept all').trigger('click');
    await flushPromises();
    expect(two.text()).toContain('All 2 photos of this batch are accepted and go into the dataset.');
  });

  it('the submit dialog names its field once, not the dialog again', async () => {
    const wrapper = job({ status: 'Annotating', mine: true, may: { return: true } }, [photo(1)]);
    await button(wrapper, 'Submit for Review').trigger('click');
    await flushPromises();
    const dialog = wrapper.find('.stub-dialog');
    expect(dialog.find('h2').text()).toBe('Submit for review');
    expect(dialog.text().split('Submit for review').length - 1).toBe(1);          // the title only
    expect(dialog.find('label').text()).toContain('Note for the approver (optional)');
  });

  it('an accepted assignment offers its photos to look at, not Continue Annotating', async () => {
    const accepted = job({ status: 'Dataset' }, [photo(1, { state: 'Accepted' })]);
    expect(button(accepted, 'Continue Annotating')).toBeUndefined();
    expect(button(accepted, 'View photos')).toBeDefined();
    await button(accepted, 'View photos').trigger('click');
    expect(accepted.emitted('edit')[0][0].id).toBe(1);
    const open = job({ status: 'Annotating' }, [photo(1, { labelled: false, state: 'Unlabeled' })]);
    expect(button(open, 'Continue Annotating')).toBeDefined();
  });
});
