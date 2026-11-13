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
  classes: [{ name: 'helmet', color: '#2563eb', description: 'Protective headwear', trained: false }] });
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
  expect(api.detect).toHaveBeenCalledWith('~901', 'image-1', 'vision:fixture', ['helmet'], '');
  expect(wrapper.get('.auto-bar-state').text()).toContain('Ready to label');
  expect(wrapper.get('.auto-progress [aria-current="step"]').text()).toContain('Preview');
});

test('failed preview is never presented as ready to label', async () => {
  api.detect.mockRejectedValue(new Error('Synthetic model unavailable'));
  const wrapper = render(); await flushPromises();
  await button(wrapper, 'Generate Preview').trigger('click'); await flushPromises();
  expect(wrapper.get('.auto-bar-state').text()).toContain('Preview needs attention');
  expect(wrapper.get('.auto-bar-state').text()).not.toContain('Ready to label');
  expect(wrapper.text()).toContain('Synthetic model unavailable');
});

test('labeling keeps the existing explicit confirmation and source payload', async () => {
  const wrapper = render(); await flushPromises();
  await button(wrapper, 'Label Batch').trigger('click');
  expect(wrapper.emitted('autolabel')).toBeUndefined();
  expect(wrapper.get('.auto-progress [aria-current="step"]').text()).toContain('Label batch');
  await button(wrapper, 'Start labelling').trigger('click');
  expect(wrapper.emitted('autolabel')).toEqual([['vision:fixture', '']]);
  expect(api.detect).not.toHaveBeenCalled();
});

test('using a saved workflow applies its user-defined classes without running inference', async () => {
  const classes = [{ name: 'safety vest', color: '#123456', description: 'High visibility clothing', trained: false }];
  const row = { id: 'workflow-1', name: 'Safety gear', revision: 1,
    definition: { schema: 'aadml.labeling-workflow.v1', source: 'vision:fixture', where: '', classes: classes.map(c => ({name:c.name, color:c.color, description:c.description})) } };
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
  expect(api.detect).toHaveBeenCalledWith('~901', 'image-1', 'vision:fixture', ['safety vest'], '');
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
  await wrapper.setProps({ state: { ...empty, classes: [{name:'product logo', color:'#123456', description:'', trained:false}] } });
  await flushPromises();
  expect(wrapper.findAll('.class-name').map(el=>el.element.value)).toEqual(['product logo']);
  await button(wrapper, 'Generate Preview').trigger('click'); await flushPromises();
  expect(api.detect).toHaveBeenCalledWith('~901', 'image-1', 'vision:fixture', ['product logo'], '');
});
