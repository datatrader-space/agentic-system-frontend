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
