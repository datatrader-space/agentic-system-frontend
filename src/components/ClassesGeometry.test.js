// @vitest-environment jsdom
// The Classes page's "Wall geometry" setting (FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md section 12.2): what a class is in
// FitMyWall's walls format, set by a person who may change classes and saved with the class; no "Model class" badge.
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import ClassesTagsPage from '../../training-data/src/components/ClassesTagsPage.vue';
import { classesApi } from '../../training-data/src/api/classes.js';

vi.mock('../../training-data/src/api/classes.js', async original => {
  const actual = await original();
  return { ...actual, classesApi: { load: vi.fn(), lock: vi.fn(), tag: vi.fn(), addClass: vi.fn(), updateClass: vi.fn(), removeClass: vi.fn() } };
});

const wrappers = [];
const page = (may = true) => ({
  classes: [{ name: 'facade', color: '#ef4444', description: '', geometry: 'wall', shapes: 3, labels: 1 },
    { name: 'sofa', color: '#0ea5e9', description: 'Any sofa', geometry: '', shapes: 0, labels: 0 }],
  tags: [], locked: false, may: { classes: may, lock: may, tags: may },
});
const render = () => {
  const wrapper = mount(ClassesTagsPage, { props: { projectRef: '~901' }, global: {
    stubs: { UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="stub-dialog"><slot/></div>' } } } });
  wrappers.push(wrapper); return wrapper;
};
const button = (wrapper, name) => wrapper.findAll('button').find(item => item.text().trim() === name);
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));

test('a class shows its wall geometry, and no class is called a "Model class"', async () => {
  classesApi.load.mockResolvedValue(page());
  const wrapper = render(); await flushPromises();
  expect(wrapper.text()).not.toContain('Model class');
  const rows = wrapper.findAll('tbody tr');
  expect(rows[0].text()).toContain('Wall');
  expect(rows[1].text()).not.toContain('Wall');
});

test('a person who may change classes sets the geometry, and it is sent with the class', async () => {
  classesApi.load.mockResolvedValue(page());
  classesApi.updateClass.mockResolvedValue({});
  const wrapper = render(); await flushPromises();
  await wrapper.findAll('tbody tr')[1].findAll('button').find(b => b.text() === 'Edit').trigger('click');
  const select = wrapper.get('.stub-dialog select');
  expect(select.findAll('option').map(o => o.text())).toEqual(['None', 'Wall', 'Window in a wall', 'Door in a wall']);
  expect(select.element.value).toBe('');
  await select.setValue('door');
  await button(wrapper, 'Save').trigger('click'); await flushPromises();
  expect(classesApi.updateClass).toHaveBeenCalledWith('~901', 'sofa', { color: '#0ea5e9', description: 'Any sofa', geometry: 'door' });
});

test('the server\'s refusal of a second class with one geometry is shown in its words', async () => {
  classesApi.load.mockResolvedValue(page());
  classesApi.updateClass.mockRejectedValue(new Error('"facade" already has the Wall geometry: a project has one class of each.'));
  const wrapper = render(); await flushPromises();
  await wrapper.findAll('tbody tr')[1].findAll('button').find(b => b.text() === 'Edit').trigger('click');
  await wrapper.get('.stub-dialog select').setValue('wall');
  await button(wrapper, 'Save').trigger('click'); await flushPromises();
  expect(wrapper.get('.stub-dialog [role="alert"]').text()).toBe('"facade" already has the Wall geometry: a project has one class of each.');
});

test('a new class sends its geometry and starts with a palette colour no class has', async () => {
  classesApi.load.mockResolvedValue(page());
  classesApi.addClass.mockResolvedValue({ added: 'lamp' });
  const wrapper = render(); await flushPromises();
  await button(wrapper, 'Add class').trigger('click');
  await wrapper.get('.stub-dialog input[placeholder="e.g. radiator"]').setValue('lamp');
  await wrapper.get('.stub-dialog select').setValue('window');
  await wrapper.findAll('.stub-dialog button').find(b => b.text() === 'Add class').trigger('click'); await flushPromises();
  expect(classesApi.addClass).toHaveBeenCalledWith('~901', { name: 'lamp', color: '#ec4899', description: '', geometry: 'window' });
});

test('a person who may not change classes is not offered the geometry setting', async () => {
  classesApi.load.mockResolvedValue(page(false));
  const wrapper = render(); await flushPromises();
  expect(button(wrapper, 'Add class').attributes('disabled')).toBeDefined();
  expect(wrapper.findAll('tbody tr')[0].findAll('button').find(b => b.text() === 'Edit').attributes('disabled')).toBeDefined();
  expect(wrapper.find('select').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('Wall geometry');
});
