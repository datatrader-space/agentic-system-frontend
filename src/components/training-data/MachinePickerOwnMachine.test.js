// @vitest-environment jsdom
// "Where it runs" (agentic-docs/MACHINE_RUNPOD_PARITY_PLAN.md; owner, 2026-11-11): two dropdowns. The first chooses the
// kind: Auto, GPU, CPU or Your machine, always all four; a kind this model cannot use now is listed with the reason and
// cannot be chosen ("if model can run only gpu but can't on cpu or even machine connected resource gpu is not enough we
// show but disabled"). The second lists the machines of the kind chosen, each that cannot take the model with its reason.
// Your machine says its fee ($0.10 an hour) and sends the machine's key.
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MachinePicker from '../../../training-data/src/components/MachinePicker.vue';

const GPU = { key: 'gpu:a', kind: 'gpu', gpu_name: 'PRO 6000 MIG 24GB', memory_gb: 24, data_center: 'US-WA-1', soc2: true,
  usd_per_hour: '0.90', usd_per_second: '0.000250', files_here: true, stock_text: 'Few free' };
const CPU = { key: 'cpu:a', kind: 'cpu', gpu_name: '8 vCPU', memory_gb: 32, data_center: 'EU-RO-1', soc2: false,
  usd_per_hour: '0.24', usd_per_second: '0.000067', files_here: false, stock_text: 'Free' };
const MINE = { key: 'machine:2', kind: 'own_machine', machine_id: 2, name: '235e1456c44f', device: 'gpu',
  gpu_name: 'NVIDIA GeForce RTX 3070', memory_gb: 8, stock_text: 'Online', free: false, fits: true, why_not: '',
  price_text: '$0.10 an hour, on your machine', usd_per_hour: '0.10', usd_per_second: '0.000028' };
const SMALL = { ...MINE, key: 'machine:3', machine_id: 3, name: 'old laptop', fits: false,
  why_not: 'This needs 24 GB of GPU memory; old laptop has 4 GB.' };

async function picker(machines, extra = {}) {
  const wrapper = mount(MachinePicker, { props: { load: async () => ({ machines, note: '', ...extra }), modelValue: '' } });
  await flushPromises();
  return wrapper;
}
const kinds = w => w.find('select.machine-kind').findAll('option');
const kind = (w, value) => kinds(w).find(o => o.attributes('value') === value);
const last = w => w.emitted('update:modelValue').at(-1);

describe('Where it runs: the kind first, then the machine', () => {
  it('lists Auto, GPU, CPU and Your machine, always, in that order, Auto chosen', async () => {
    const wrapper = await picker([MINE, GPU, CPU]);
    expect(kinds(wrapper).map(o => o.attributes('value'))).toEqual(['auto', 'gpu', 'cpu', 'own_machine']);
    expect(wrapper.find('select.machine-kind').element.value).toBe('auto');
    expect(wrapper.find('select.machine-select').exists()).toBe(false);              // Auto has no second choice
    expect(wrapper.find('input[type="radio"]').exists()).toBe(false);
    expect(kind(wrapper, 'gpu').text()).toBe('GPU, 1 free');
    expect(kind(wrapper, 'cpu').text()).toBe('CPU, 1 free');
    expect(kind(wrapper, 'own_machine').text()).toBe('Your machine, $0.10 an hour, on your machine');
    expect(last(wrapper)).toEqual(['gpu:a']);                    // Auto: where the files are, never your machine
  });

  it('the second dropdown lists only the machines of the kind chosen', async () => {
    const wrapper = await picker([MINE, GPU, CPU]);
    await wrapper.find('select.machine-kind').setValue('cpu');
    const listed = wrapper.find('select.machine-select').findAll('option').map(o => o.attributes('value'));
    expect(listed).toEqual(['cpu:a']);
    expect(last(wrapper)).toEqual(['cpu:a']);
    await wrapper.find('select.machine-kind').setValue('gpu');
    expect(wrapper.find('select.machine-select').findAll('option').map(o => o.attributes('value'))).toEqual(['gpu:a']);
    expect(last(wrapper)).toEqual(['gpu:a']);
  });

  it('a model that needs a GPU: CPU is listed, says so, and cannot be chosen', async () => {
    const wrapper = await picker([GPU], { gpu_only: 'SAM 3 runs on a GPU only: SAM 3 is too large to answer on a CPU.' });
    expect(kind(wrapper, 'cpu').attributes('disabled')).toBeDefined();
    expect(kind(wrapper, 'cpu').text()).toBe('CPU: this model needs a GPU');
    await wrapper.find('select.machine-kind').setValue('cpu');
    expect(wrapper.find('select.machine-select').exists()).toBe(false);
    expect(last(wrapper)).toEqual(['gpu:a']);
  });

  it('your machine with too little GPU memory: listed with the reason, never chosen', async () => {
    const wrapper = await picker([SMALL, GPU]);
    expect(kind(wrapper, 'own_machine').attributes('disabled')).toBeDefined();
    expect(kind(wrapper, 'own_machine').text()).toContain('needs 24 GB of GPU memory; old laptop has 4 GB');
    await wrapper.find('select.machine-kind').setValue('own_machine');
    expect(last(wrapper)).not.toEqual(['machine:3']);
  });

  it('Your machine says its fee, chooses that machine, and lists one that cannot take it disabled with why', async () => {
    const wrapper = await picker([SMALL, MINE, GPU]);
    await wrapper.find('select.machine-kind').setValue('own_machine');
    expect(last(wrapper)).toEqual(['machine:2']);                                   // the one that fits
    const small = wrapper.find('select.machine-select').findAll('option').find(o => o.attributes('value') === 'machine:3');
    expect(small.attributes('disabled')).toBeDefined();
    expect(small.text()).toContain('needs 24 GB of GPU memory');
    await wrapper.find('select.machine-select').setValue('machine:3');
    expect(last(wrapper)).toEqual(['machine:2']);
    await wrapper.setProps({ modelValue: 'machine:2' });
    expect(wrapper.text()).toContain('$0.10 an hour, on your machine, charged by the second');
    expect(wrapper.text()).toContain('nothing moves to RunPod');
    expect(wrapper.text()).not.toContain('free, on your hardware');
  });

  it('no machine of yours offered for this model: Your machine is listed, says so, not choosable', async () => {
    const wrapper = await picker([GPU]);
    expect(kind(wrapper, 'own_machine').attributes('disabled')).toBeDefined();
    expect(kind(wrapper, 'own_machine').text()).toBe('Your machine: none connected for this model');
  });

  it('back to Auto: the second dropdown goes and Auto picks again', async () => {
    const wrapper = await picker([MINE, GPU]);
    await wrapper.find('select.machine-kind').setValue('own_machine');
    expect(last(wrapper)).toEqual(['machine:2']);
    await wrapper.find('select.machine-kind').setValue('auto');
    expect(wrapper.find('select.machine-select').exists()).toBe(false);
    expect(last(wrapper)).toEqual(['gpu:a']);
  });
});
