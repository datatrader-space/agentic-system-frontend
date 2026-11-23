// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AutoLabel from '../../training-data/src/components/AutoLabel.vue';
import UnassignedMedia from '../../training-data/src/components/UnassignedMedia.vue';
import { api, liveAnnotate } from '../../training-data/src/api/annotate.js';
import { labelingWorkflows } from '../../training-data/src/api/labelingWorkflows.js';
vi.mock('../../training-data/src/api/labelingWorkflows.js', () => ({ labelingWorkflows: { list: vi.fn(), use: vi.fn() } }));

vi.mock('../../training-data/src/api/annotate.js', async original => {
  const actual = await original();
  return { ...actual, loadLabellers: vi.fn(async () => []), loadRoles: vi.fn(async () => []),
    api: { ...actual.api, detectSources: vi.fn(), detect: vi.fn() } };
});
const wrappers = [];
const batch = { id: 'batch-1', name: 'Safety inspection', source: 'source-1' };
const media = [{ id: 'image-1', batchId: batch.id, name: 'Synthetic image', url: 'data:image/png;base64,AA==' }];
const state = () => ({ ref: '~901', live: true, images: media, labellers: [], canChangeClasses: true,
  classes: [{ name: 'helmet', color: '#2563eb', description: 'Protective headwear', geometry: '' }] });
const render = (component = AutoLabel) => {
  const wrapper = mount(component, { props: { batch, state: state(), media }, global: {
    stubs: { UiDialog: { props: ['open'], template: '<div v-if="open"><slot/></div>' } },
  } }); wrappers.push(wrapper); return wrapper;
};
const button = (wrapper, name) => wrapper.findAll('button').find(item => item.text().trim() === name);
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  api.detectSources.mockResolvedValue({ sources: [{ id: 'vision:fixture', name: 'Synthetic model', maker: 'AADML', labels: 'polygons', detail: 'Synthetic fixture' }] });
  api.detect.mockResolvedValue({ shapes: [] });
  labelingWorkflows.list.mockResolvedValue({ workflows: [] });
});
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

test('back to batch returns to its choices, while Annotate exits the batch', async () => {
  const wrapper = render(UnassignedMedia); await flushPromises();
  expect(wrapper.classes()).toContain('auto-label-active');
  expect(wrapper.find('.labeling-sidebar').exists()).toBe(false);
  await button(wrapper, 'Back to batch').trigger('click');
  expect(wrapper.find('.unassigned-main').exists()).toBe(true);
  expect(wrapper.emitted('close')).toBeUndefined();
  await wrapper.findAll('.label-choice').find(item => item.text().includes('Auto Label')).trigger('click');
  await flushPromises();
  await wrapper.get('.auto-breadcrumb button').trigger('click');
  expect(wrapper.emitted('close')).toHaveLength(1);
});

test('opening Auto Label never generates paid previews automatically', async () => {
  const wrapper = render(); await flushPromises();
  expect(api.detect).not.toHaveBeenCalled();
  expect(wrapper.get('.auto-progress [aria-current="step"]').text()).toContain('Configure');
  expect(wrapper.get('.auto-original-image').attributes('alt')).toBe(media[0].name);
  await button(wrapper, 'Generate Preview').trigger('click'); await flushPromises();
  expect(api.detect).toHaveBeenCalledWith('~901', 'image-1', 'vision:fixture', ['helmet']);
  expect(wrapper.get('.auto-bar-state').text()).toContain('Ready to label');
  expect(wrapper.get('.auto-progress [aria-current="step"]').text()).toContain('Preview');
});

test('steps through the whole batch: a step shows the photo, and once previewing asks about the photo it opens', async () => {
  const three = [1, 2, 3].map(n => ({ id: `image-${n}`, batchId: batch.id, name: `Synthetic ${n}`, url: 'data:image/png;base64,AA==' }));
  const wrapper = mount(AutoLabel, { props: { batch, state: state(), media: three }, global: {
    stubs: { UiDialog: { props: ['open'], template: '<div v-if="open"><slot/></div>' } } } });
  wrappers.push(wrapper);
  await flushPromises();
  expect(wrapper.get('.auto-step-at').text()).toBe('1 of 3');
  await wrapper.get('[aria-label="Next photo"]').trigger('click');
  expect(wrapper.get('.auto-step-at').text()).toBe('2 of 3');
  expect(api.detect).not.toHaveBeenCalled();                          // a step before any preview asks nothing
  await button(wrapper, 'Generate Preview').trigger('click');
  await flushPromises();
  expect(api.detect.mock.calls.map(call => call[1])).toEqual(['image-2']);
  await wrapper.get('[aria-label="Next photo"]').trigger('click');
  await flushPromises();
  expect(wrapper.get('.auto-step-at').text()).toBe('3 of 3');
  expect(api.detect.mock.calls.map(call => call[1])).toEqual(['image-2', 'image-3']);
  await wrapper.get('[aria-label="Previous photo"]').trigger('click');
  await flushPromises();
  expect(wrapper.get('.auto-step-at').text()).toBe('2 of 3');
  expect(api.detect).toHaveBeenCalledTimes(2);                        // an answer already had is shown again, not asked
  expect(wrapper.get('.auto-strip-count').text()).toBe('2 previewed · 3 in batch');
});

test('failed preview is never presented as ready to label', async () => {
  api.detect.mockRejectedValue(new Error('Synthetic model unavailable'));
  const wrapper = render(); await flushPromises();
  await button(wrapper, 'Generate Preview').trigger('click'); await flushPromises();
  expect(wrapper.get('.auto-bar-state').text()).toContain('Preview needs attention');
  expect(wrapper.get('.auto-bar-state').text()).not.toContain('Ready to label');
  expect(wrapper.text()).toContain('Synthetic model unavailable');
  // The reason is in view (live, 2026-11-16: it sat below the photo, and the bar only said "Check the image message").
  expect(wrapper.get('.auto-bar-state').text()).toContain('Synthetic model unavailable');
  expect(wrapper.get('.auto-refused[role="alert"]').text()).toBe('Synthetic model unavailable');
});

// Live, 2026-11-23 (ADM-1344): the walls models found a wall and a window, but the project's classes took none of it and
// the preview said only "Nothing found". What a model found and did not draw is said, with how to get it.
test('a preview says what the model found but did not draw, never only "Nothing found"', async () => {
  api.detect.mockResolvedValue({ state: 'ready', shapes: [], note: "Found 1 window. Add a class named 'window' to get them." });
  const wrapper = render(); await flushPromises();
  await button(wrapper, 'Generate Preview').trigger('click'); await flushPromises();
  expect(wrapper.get('.auto-note[role="status"]').text()).toBe("Found 1 window. Add a class named 'window' to get them.");
  expect(wrapper.text()).toContain('Nothing drawn: see the note above the photo.');
  expect(wrapper.text()).not.toContain('Nothing found on this photo.');
  expect(wrapper.find('.auto-refused').exists()).toBe(false);          // a note, not an error
});

test('a preview with no note and nothing found still says so', async () => {
  api.detect.mockResolvedValue({ state: 'ready', shapes: [] });
  const wrapper = render(); await flushPromises();
  await button(wrapper, 'Generate Preview').trigger('click'); await flushPromises();
  expect(wrapper.find('.auto-note').exists()).toBe(false);
  expect(wrapper.text()).toContain('Nothing found on this photo.');
});

test('labeling keeps the existing explicit confirmation and source payload', async () => {
  const wrapper = render(); await flushPromises();
  await button(wrapper, 'Label Batch').trigger('click');
  expect(wrapper.emitted('autolabel')).toBeUndefined();
  expect(wrapper.get('.auto-progress [aria-current="step"]').text()).toContain('Label batch');
  await button(wrapper, 'Start labelling').trigger('click');
  expect(wrapper.emitted('autolabel')).toEqual([['vision:fixture']]);
  expect(api.detect).not.toHaveBeenCalled();
});

test('using a saved workflow applies its user-defined classes without running inference', async () => {
  const classes = [{ name: 'safety vest', color: '#123456', description: 'High visibility clothing', geometry: '' }];
  const row = { id: 'workflow-1', name: 'Safety gear', revision: 1,
    definition: { schema: 'aadml.labeling-workflow.v1', source: 'vision:fixture', classes: classes.map(c => ({name:c.name, color:c.color, description:c.description})) } };
  labelingWorkflows.list.mockResolvedValue({ workflows: [row] });
  labelingWorkflows.use.mockResolvedValue({ workflow: row, classes, started: false });
  const wrapper = render(); await flushPromises();
  await wrapper.get('#auto-workflow-tab').trigger('click'); await flushPromises();
  await wrapper.get('.workflow-fields select').setValue(row.id);
  await button(wrapper, 'Use this workflow').trigger('click');
  expect(api.detect).not.toHaveBeenCalled();
  await button(wrapper, 'Apply workflow').trigger('click'); await flushPromises();
  expect(wrapper.get('#auto-preview-tab').attributes('aria-selected')).toBe('true');
  expect(wrapper.find('.class-name').element.value).toBe('safety vest');
  expect(api.detect).not.toHaveBeenCalled();
  await button(wrapper, 'Generate Preview').trigger('click'); await flushPromises();
  expect(api.detect).toHaveBeenCalledWith('~901', 'image-1', 'vision:fixture', ['safety vest']);
});

test('a fresh project has no hardcoded classes and cannot preview or label until the user adds one', async () => {
  expect(liveAnnotate('~new').classes).toEqual([]);
  const empty = state(); empty.classes = [];
  const wrapper = mount(AutoLabel, { props: { batch, state: empty, media } }); wrappers.push(wrapper);
  await flushPromises();
  expect(wrapper.findAll('.auto-class')).toHaveLength(0);
  expect(wrapper.text()).toContain('No classes yet');
  expect(wrapper.get('.auto-bar-state').text()).toContain('Add your classes');
  expect(button(wrapper, 'Generate Preview').attributes('disabled')).toBeDefined();
  expect(button(wrapper, 'Label Batch').attributes('disabled')).toBeDefined();
  expect(api.detect).not.toHaveBeenCalled();
  await wrapper.setProps({ state: { ...empty, classes: [{name:'product logo', color:'#123456', description:'', geometry:''}] } });
  await flushPromises();
  expect(wrapper.findAll('.class-name').map(el=>el.element.value)).toEqual(['product logo']);
  await button(wrapper, 'Generate Preview').trigger('click'); await flushPromises();
  expect(api.detect).toHaveBeenCalledWith('~901', 'image-1', 'vision:fixture', ['product logo']);
});

// A ready-to-use model is hosted by AADML (ADM-1182, 2026-11-19): nobody chooses where it runs, and no place is sent.
const hostedSam = extra => ({ id: 'sam3', name: 'SAM 3', family: 'SAM 3', maker: 'Meta', labels: 'polygons', where: [],
  detail: 'Runs on AADML, always on', hosted: { state: 'on', price: '$0.01 an image' }, ...extra });
test('a hosted SAM 3 offers no place to run it and previews with no place sent', async () => {
  api.detectSources.mockResolvedValue({ sources: [hostedSam()] });
  const w = render(); await flushPromises();
  expect(w.find('.source-place').exists()).toBe(false);
  expect(w.get('.source-where').text()).toContain('Runs on AADML, always on');
  await button(w, 'Generate Preview').trigger('click'); await flushPromises();
  expect(api.detect).toHaveBeenLastCalledWith('~901', 'image-1', 'sam3', ['helmet']);
});
// Live, 2026-11-20: switching SAM 3 from Polygons to Masks threw the preview away, so seeing it filled asked (and charged)
// SAM 3 again for the same outlines. The two ways are one answer: the preview stays and is drawn filled.
test('switching Polygons and Masks keeps the preview, asks nothing again and only draws it filled', async () => {
  api.detectSources.mockResolvedValue({ sources: [hostedSam(), hostedSam({ id: 'sam3-masks', labels: 'masks' })] });
  api.detect.mockResolvedValue({ shapes: [{ kind: 'helmet', points: [[0, 0], [1, 0], [1, 1]] }] });
  const w = render(); await flushPromises();
  await button(w, 'Generate Preview').trigger('click'); await flushPromises();
  expect(api.detect).toHaveBeenCalledTimes(1);
  for (const img of w.findAll('img')) {                                        // the photo loads (jsdom loads none)
    Object.defineProperties(img.element, { naturalWidth: { value: 10 }, naturalHeight: { value: 10 } });
    await img.trigger('load');
  }
  const fill = () => w.find('polygon[fill-opacity]').attributes('fill-opacity');
  expect(fill()).toBe('0.25');
  await w.findAll('.source-ways button').find(b => b.text().includes('Masks')).trigger('click'); await flushPromises();
  expect(api.detect).toHaveBeenCalledTimes(1);                                   // not asked again
  expect(fill()).toBe('0.55');                                                    // the same shapes, filled
  await w.findAll('.source-ways button').find(b => b.text().includes('Polygons')).trigger('click'); await flushPromises();
  expect(api.detect).toHaveBeenCalledTimes(1);
  expect(fill()).toBe('0.25');
});
test('a hosted SAM 3 that AADML is not running cannot preview', async () => {
  api.detectSources.mockResolvedValue({ sources: [hostedSam({ hosted: { state: 'off', price: '' },
    unavailable: 'SAM 3 is not running now: AADML starts it.' })] });
  const w = render(); await flushPromises();
  expect(button(w, 'Generate Preview').attributes('disabled')).toBeDefined();
  expect(api.detect).not.toHaveBeenCalled();
});
test('models without SAM 3 visibly identify their actual provider', async () => {
  const w = render(); await flushPromises();
  expect(w.get('.source-where').text()).toContain('Where this model runs');
  expect(w.get('.source-where').text()).toContain('Synthetic fixture');
  expect(w.find('.source-place').exists()).toBe(false);
});
