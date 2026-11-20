// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ProjectCreate from '../../training-data/src/components/ProjectCreate.vue';
import { projectKinds } from '../../training-data/src/api/projectKinds.js';
import { projectSubmission } from '../../training-data/src/api/projectSubmission.js';
const instance = { key: 'instance_segmentation', task: 'fmw_walls', family: 'vision', available: true };
const wrappers = [];
beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; vi.restoreAllMocks(); });
const button = (w, text) => w.findAll('button').find(b => b.text().includes(text));
async function review(w) {
  await w.get('#new-project-name').setValue('Vehicle shapes'); await w.get('#project-purpose').setValue('Detect vehicles');
  await button(w, 'Continue to data policy').trigger('click');
  const checks = w.findAll('input[type="checkbox"]');
  await checks[checks.length - 1].setValue(true);
  await button(w, 'Review project').trigger('click');
}
test('failed kinds lookup offers retry, preserves draft, then creates and lands on upload', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('Temporary service failure')).mockResolvedValue({ kinds: [instance] });
  const resource = projectKinds(load), submit = vi.fn(async () => ({ ref: '~fixture' }));
  const w = mount(ProjectCreate, { props: { submit }, global: { provide: { kinds: resource.kinds, projectKinds: resource } } }); wrappers.push(w);
  await flushPromises(); await review(w);
  expect(w.text()).toContain('Project types could not be loaded');
  expect(w.text()).not.toContain('This project type cannot be created yet');
  expect(button(w, 'Create project').attributes('disabled')).toBeDefined();
  await button(w, 'Retry loading project types').trigger('click'); await flushPromises();
  expect(w.text()).toContain('Vehicle shapes');
  expect(button(w, 'Create project').attributes('disabled')).toBeUndefined();
  await button(w, 'Create project').trigger('click'); await flushPromises();
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ task: 'Instance Segmentation', name: 'Vehicle shapes' }));
  expect(w.emitted('done')[0]).toEqual(['upload', { ref: '~fixture' }]);
});
test('confirmed unavailable kind stays disabled', async () => {
  const resource = projectKinds(async () => ({ kinds: [{ ...instance, available: false }] }));
  const submit = vi.fn();
  const w = mount(ProjectCreate, { props: { submit }, global: { provide: { kinds: resource.kinds, projectKinds: resource } } }); wrappers.push(w);
  await flushPromises(); await review(w);
  expect(w.text()).toContain('This project type is currently unavailable');
  expect(button(w, 'Create project').attributes('disabled')).toBeDefined(); expect(submit).not.toHaveBeenCalled();
});
test('fresh capability check cannot silently downgrade vision to data-only', async () => {
  const resource = projectKinds(vi.fn().mockResolvedValue({ kinds: [{ ...instance, task: '' }] }));
  await expect(resource.requireKind(instance.key)).rejects.toThrow('configuration is incomplete');
  const down = projectKinds(async () => { throw new Error('Offline'); });
  await expect(down.requireKind(instance.key)).rejects.toThrow('Offline');
  const data = projectKinds(async () => ({ kinds: [{ key: 'data_only', task: '', available: true }] }));
  expect((await data.requireKind('data_only')).task).toBe('');
});
test('policy retry resumes the acknowledged project without another create', async () => {
  const create = vi.fn(async () => ({ ref: '~fixture', family: 'vision' }));
  const savePolicy = vi.fn().mockRejectedValueOnce(new Error('Policy unavailable')).mockResolvedValue({});
  const requireKind = vi.fn(async () => instance);
  const submit = projectSubmission({ requireKind, create, savePolicy, dataUse: () => ({}), typeKind: { 'Instance Segmentation': instance.key } });
  const form = { task: 'Instance Segmentation', name: 'Vehicles', purpose: 'Shapes' };
  await expect(submit(form)).rejects.toThrow('Policy unavailable'); await submit(form);
  expect(create).toHaveBeenCalledTimes(1); expect(create).toHaveBeenCalledWith({ name: 'Vehicles', description: 'Shapes', task: 'fmw_walls' });
  expect(requireKind).toHaveBeenCalledTimes(2); expect(savePolicy).toHaveBeenCalledTimes(2);
});

test('workspace change during capability check prevents creation', async () => {
  let scope = 'tenant-a'; const create = vi.fn();
  const submit = projectSubmission({ requireKind: async () => { scope = 'tenant-b'; return instance; }, create, workspace: () => scope, typeKind: { 'Instance Segmentation': instance.key } });
  await expect(submit({ task: 'Instance Segmentation' })).rejects.toThrow('workspace changed');
  expect(create).not.toHaveBeenCalled();
});
test('malformed capability response is retryable, never available', async () => {
  const resource = projectKinds(async () => ({ kinds: [{ ...instance, available: 'false' }] }));
  await expect(resource.requireKind(instance.key)).rejects.toThrow('could not be loaded');
  expect(resource.status.value).toBe('error');
});

// FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md section 4.3: "Find objects" (your own classes) is the default and comes first;
// the card is made from the API's row, and its own kind and task are sent.
// The API's rows as aadml.com sends them (families.KINDS): "Find objects" is the instance_segmentation kind, which this
// screen also has a card (and a picture) for. Live, 2026-11-20, the card's old name "Instance Segmentation" and its walls
// example were shown instead of the API's words; an earlier version of this test used a made-up key and missed it.
test('the New project dialog offers the first kind the API lists, Find objects, first, by default and in its own words', async () => {
  const find = { key: 'instance_segmentation', label: 'Find objects', task: 'segment', family: 'vision', available: true,
    description: 'Finds each object of the classes you name and draws its outline.', gives: ['Outlines', 'Counting'],
    examples: ['Each product on a shelf, with its exact shape'], you_label: 'The outline of each object, with its class' };
  const walls = { key: 'fmw_walls', label: 'Find the walls in room photos', task: 'fmw_walls', family: 'vision', available: true,
    description: 'Finds every wall, window and door of a room photo.', gives: ['Outlines', 'Corners'] };
  const resource = projectKinds(async () => ({ kinds: [find, walls] }));
  const submit = vi.fn(async () => ({ ref: '~fixture' }));
  const w = mount(ProjectCreate, { props: { submit }, global: { provide: { kinds: resource.kinds, projectKinds: resource } } }); wrappers.push(w);
  await flushPromises();
  const cards = w.findAll('.task-option');
  expect(cards[0].text()).toContain('Find objects');
  expect(cards[0].text()).toContain('Finds each object of the classes you name');
  expect(cards[0].text()).toContain('Counting');
  expect(cards[0].find('input').element.checked).toBe(true);
  expect(cards[1].text()).toContain('Find the walls in room photos');
  expect(w.text()).not.toContain('Instance Segmentation');
  expect(w.text()).toContain('Each product on a shelf, with its exact shape');
  expect(w.text()).not.toContain('Outline each wall, window and door in a room');
  expect(w.find('.task-example img').exists()).toBe(true);                // the card's picture is kept
  await review(w);
  await button(w, 'Create project').trigger('click'); await flushPromises();
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ task: 'Find objects', kind: 'instance_segmentation' }));
  // Defaulting to it is not a change of the person's: cancelling a fresh dialog asks nothing.
  const fresh = mount(ProjectCreate, { props: { submit }, global: { provide: { kinds: resource.kinds, projectKinds: resource } } }); wrappers.push(fresh);
  await flushPromises();
  await button(fresh, 'Cancel').trigger('click');
  expect(fresh.emitted('cancel')).toBeTruthy();
});

test('a card made from the API sends its own kind, and the backend task comes from that kind', async () => {
  const find = { key: 'instance_segmentation', label: 'Find objects', task: 'segment', family: 'vision', available: true };
  const create = vi.fn(async () => ({ ref: '~fixture', family: 'vision' }));
  const requireKind = vi.fn(async () => find);
  const submit = projectSubmission({ requireKind, create, savePolicy: async () => ({}), dataUse: () => ({}), typeKind: { 'Instance Segmentation': instance.key } });
  await submit({ task: 'Find objects', kind: 'instance_segmentation', name: 'Shelf', purpose: 'Products' });
  expect(requireKind).toHaveBeenCalledWith('instance_segmentation');
  expect(create).toHaveBeenCalledWith({ name: 'Shelf', description: 'Products', task: 'segment' });
});

test('Classification keeps its single- or multi-label choice whatever the API calls the kind', async () => {
  const sort = { key: 'classification', label: 'Sort photos', task: 'classification', family: 'vision', available: true,
    description: 'Gives the whole picture a label, or several.', gives: ['Labels'] };
  const resource = projectKinds(async () => ({ kinds: [sort] }));
  const w = mount(ProjectCreate, { props: { submit: vi.fn() }, global: { provide: { kinds: resource.kinds, projectKinds: resource } } }); wrappers.push(w);
  await flushPromises();
  expect(w.findAll('.task-option')[0].text()).toContain('Sort photos');
  expect(w.find('.classification-options').exists()).toBe(true);
});
