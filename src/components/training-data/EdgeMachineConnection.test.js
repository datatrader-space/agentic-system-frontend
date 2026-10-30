// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import EdgeTab from '../../../training-data/src/components/EdgeTab.vue';
import MachineConnection from '../../../training-data/src/components/MachineConnection.vue';

const api = vi.hoisted(() => ({ list: vi.fn(), add: vi.fn(), edge: vi.fn() }));
vi.mock('../../../training-data/src/api/machines.js', async importOriginal => ({
  ...await importOriginal(), machinesApi: { list: api.list, add: api.add, remove: vi.fn() },
}));
vi.mock('../../../training-data/src/api/edge.js', async importOriginal => ({
  ...await importOriginal(), edgeApi: { list: api.edge, serve: vi.fn(), stop: vi.fn() },
}));

const model = { project: { id: 7, ref: 'quality', name: 'Quality' }, number: 2, name: 'Detector', version: '2.0', may_serve: true, environments: ['production', 'staging'] };
const machine = { id: 9, name: 'Office node', state: 'online', projects: [], capabilities: { cpus: 8, memory_gb: 16 } };
let info; let wrappers;
const command = () => ({
  command_cpu: 'docker run -d -e AADML_JOIN=aadml_join_synthetic_example public.ecr.aws/example/machine',
  command: 'docker run -d --gpus all -e AADML_JOIN=aadml_join_synthetic_example public.ecr.aws/example/machine',
  expires_at: new Date(Date.now() + 600000).toISOString(), minutes: 10,
});
const button = (wrapper, label) => wrapper.findAll('button').find(item => item.text().trim() === label);
async function render(component) {
  const wrapper = mount(component, { attachTo: document.body });
  wrappers.push(wrapper); await flushPromises(); return wrapper;
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.stubGlobal('requestAnimationFrame', callback => callback());
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  wrappers = []; info = { machines: [], available: true, may_manage: true, firewall_hosts: [] };
  api.list.mockReset().mockImplementation(async () => ({ ...info, machines: [...info.machines] }));
  api.add.mockReset().mockImplementation(async () => command());
  api.edge.mockReset().mockImplementation(async () => ({ available: true, machines: [...info.machines], models: [{ ...model }], jobs: [] }));
});
afterEach(() => {
  wrappers.forEach(wrapper => wrapper.unmount());
  document.body.innerHTML = ''; localStorage.clear();
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('machine connection stays in the Edge Devices workflow', () => {
  it('opens setup without navigating or creating a join code, and preserves form values after cancellation', async () => {
    const wrapper = await render(EdgeTab);
    await wrapper.find('.edge-form select').setValue('quality#2');
    await wrapper.findAll('.edge-form select')[1].setValue('staging');
    await wrapper.find('.edge-form input[type=number]').setValue('8088');
    await button(wrapper, 'Connect a machine').trigger('click'); await flushPromises();
    expect(wrapper.emitted('navigate')).toBeUndefined();
    expect(wrapper.find('dialog[open]').text()).toContain('Prepare your machine');
    expect(api.add).not.toHaveBeenCalled();
    await button(wrapper, 'Cancel setup').trigger('click'); await flushPromises();
    expect(wrapper.find('dialog[open]').exists()).toBe(false);
    expect(wrapper.findAll('.edge-form select')[1].element.value).toBe('staging');
    expect(wrapper.find('.edge-form input[type=number]').element.value).toBe('8088');
  });

  it('waits for an online machine, then resumes deployment with the eligible machine and existing settings', async () => {
    const wrapper = await render(EdgeTab);
    await wrapper.find('.edge-form select').setValue('quality#2');
    await wrapper.findAll('.edge-form select')[1].setValue('staging');
    await wrapper.find('.edge-form input[type=number]').setValue('8088');
    await button(wrapper, 'Connect a machine').trigger('click'); await flushPromises();
    await button(wrapper, 'Generate connection command').trigger('click'); await flushPromises();
    expect(api.add).toHaveBeenCalledTimes(1);
    expect(wrapper.find('dialog[open]').text()).toContain('Waiting for your machine');
    info.machines = [{ ...machine, state: 'offline' }];
    await vi.advanceTimersByTimeAsync(5000); await flushPromises();
    expect(wrapper.text()).not.toContain('Confirm your online machine');
    info.machines = [machine];
    await vi.advanceTimersByTimeAsync(5000); await flushPromises();
    expect(wrapper.find('dialog[open]').text()).toContain('Confirm your online machine');
    expect(wrapper.find('dialog[open]').text()).not.toContain('aadml_join_synthetic_example');
    await button(wrapper, 'Continue to deployment').trigger('click'); await flushPromises();
    expect(wrapper.find('dialog[open]').exists()).toBe(false);
    expect(wrapper.findAll('.edge-form select')[2].element.value).toBe('9');
    expect(wrapper.findAll('.edge-form select')[1].element.value).toBe('staging');
    expect(wrapper.find('.edge-form input[type=number]').element.value).toBe('8088');
    expect(wrapper.emitted('navigate')).toBeUndefined();
    expect(document.activeElement.id).toBe('edge-step-2');
  });

  it('does not select a connected machine that is restricted to another project', async () => {
    const wrapper = await render(EdgeTab);
    await wrapper.find('.edge-form select').setValue('quality#2');
    await button(wrapper, 'Connect a machine').trigger('click'); await flushPromises();
    await button(wrapper, 'Generate connection command').trigger('click'); await flushPromises();
    info.machines = [{ ...machine, projects: [{ id: 99, name: 'Other project' }] }];
    await vi.advanceTimersByTimeAsync(5000); await flushPromises();
    await button(wrapper, 'Continue to deployment').trigger('click'); await flushPromises();
    expect(wrapper.findAll('.edge-form select')[2].element.value).toBe('');
    expect(button(wrapper, 'Deploy model').attributes('disabled')).toBeDefined();
  });
});

describe('machine enrollment safeguards', () => {
  it.each([
    { may_manage: false, available: true },
    { may_manage: true, available: false },
  ])('refuses command generation without workspace access or availability: %j', async flags => {
    Object.assign(info, flags);
    const wrapper = await render(MachineConnection);
    expect(button(wrapper, 'Generate connection command').attributes('disabled')).toBeDefined();
    expect(api.add).not.toHaveBeenCalled();
  });

  it('rechecks access before creating a code and handles a revoked permission without a POST', async () => {
    const wrapper = await render(MachineConnection);
    info.may_manage = false;
    await button(wrapper, 'Generate connection command').trigger('click'); await flushPromises();
    expect(api.add).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('A workspace Admin needs to connect the machine');
  });

  it('hides an expired command and allows renewal without persisting it', async () => {
    api.add.mockResolvedValueOnce({ ...command(), expires_at: new Date(Date.now() + 1000).toISOString() });
    const wrapper = await render(MachineConnection);
    await button(wrapper, 'Generate connection command').trigger('click'); await flushPromises();
    expect(wrapper.text()).toContain('aadml_join_synthetic_example');
    await vi.advanceTimersByTimeAsync(2000); await flushPromises();
    expect(wrapper.text()).not.toContain('aadml_join_synthetic_example');
    expect(wrapper.text()).toContain('This connection command has expired');
    await button(wrapper, 'Generate new command').trigger('click'); await flushPromises();
    expect(api.add).toHaveBeenCalledTimes(2);
    expect(localStorage.length).toBe(0);
  });

  it('ignores a late command response after setup closes and stops all polling', async () => {
    let resolve;
    api.add.mockImplementation(() => new Promise(done => { resolve = done; }));
    const wrapper = await render(MachineConnection);
    await button(wrapper, 'Generate connection command').trigger('click'); await flushPromises();
    wrapper.unmount(); wrappers = [];
    const reads = api.list.mock.calls.length;
    resolve(command()); await flushPromises();
    await vi.advanceTimersByTimeAsync(15000);
    expect(api.list).toHaveBeenCalledTimes(reads);
    expect(wrapper.emitted('connected')).toBeUndefined();
  });
});
