// @vitest-environment jsdom
// "Your machine" in "Where it runs" (agentic-docs/MACHINE_RUNPOD_PARITY_PLAN.md; owner, 2026-11-11: the platform fee,
// $0.10 an hour). The picker shows the choice when the server lists a machine of the workspace, says its fee, sends the
// machine's key, and lists one that cannot take the model with the reason, never choosable.
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MachinePicker from '../../../training-data/src/components/MachinePicker.vue';

// What the dropdown shows: its options and its group labels (where the fee and the counts are).
const shown = w => `${w.text()} ${w.findAll('optgroup').map(g => g.attributes('label')).join(' ')}`;


const GPU = { key: 'gpu:a', kind: 'gpu', gpu_name: 'PRO 6000 MIG 24GB', memory_gb: 24, data_center: 'US-WA-1', soc2: true,
  usd_per_hour: '0.90', usd_per_second: '0.000250', files_here: true, stock_text: 'Few free' };
const MINE = { key: 'machine:2', kind: 'own_machine', machine_id: 2, name: '235e1456c44f', device: 'gpu',
  gpu_name: 'NVIDIA GeForce RTX 3070', memory_gb: 8, stock_text: 'Online', free: false, fits: true, why_not: '',
  price_text: '$0.10 an hour, on your machine', usd_per_hour: '0.10', usd_per_second: '0.000028' };
const SMALL = { ...MINE, key: 'machine:3', machine_id: 3, name: 'old laptop', fits: false,
  why_not: 'This needs 24 GB of GPU memory; old laptop has 4 GB.' };

async function picker(machines) {
  const wrapper = mount(MachinePicker, { props: { load: async () => ({ machines, note: '' }), modelValue: '' } });
  await flushPromises();
  return wrapper;
}

describe('Try on my machine: the choice in Where it runs', () => {
  it('is not shown when no machine of the workspace is offered', async () => {
    const wrapper = await picker([GPU]);
    expect(wrapper.text()).not.toContain('Your machine');
    expect(wrapper.find('optgroup[label^="Your machines"]').exists()).toBe(false);
  });

  it('is shown when one is offered, says its fee, and chooses that machine', async () => {
    const wrapper = await picker([MINE, GPU]);
    expect(shown(wrapper)).toContain('Your machine');
    expect(shown(wrapper)).toContain('$0.10 an hour, on your machine');
    expect(wrapper.text()).not.toContain('free, on your hardware');
    await wrapper.find('select.machine-select').setValue('machine:2');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['machine:2']);
    await wrapper.setProps({ modelValue: 'machine:2' });
    expect(wrapper.text()).toContain('$0.10 an hour, on your machine, charged by the second');
    expect(wrapper.text()).toContain('nothing moves to RunPod');
  });

  it('lists a machine that cannot take the model with the reason, and never chooses it', async () => {
    const wrapper = await picker([SMALL, MINE, GPU]);
    await wrapper.find('select.machine-select').setValue('machine:2');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['machine:2']);       // the one that fits
    const options = wrapper.findAll('option');
    const small = options.find(o => o.attributes('value') === 'machine:3');
    expect(small.attributes('disabled')).toBeDefined();
    expect(small.text()).toContain('needs 24 GB of GPU memory');
  });

  it('says why when none of your machines can take it, and a machine that cannot is never chosen', async () => {
    const wrapper = await picker([SMALL, GPU]);
    expect(wrapper.text()).toContain('needs 24 GB of GPU memory');
    await wrapper.find('select.machine-select').setValue('machine:3');
    expect(wrapper.emitted('update:modelValue').at(-1)).not.toEqual(['machine:3']);
  });

  it('is one dropdown: Auto first, then the GPUs and your machines in their own groups', async () => {
    const wrapper = await picker([MINE, GPU]);
    expect(wrapper.findAll('select')).toHaveLength(1);
    expect(wrapper.find('input[type="radio"]').exists()).toBe(false);
    const options = wrapper.findAll('option');
    expect(options[0].text()).toContain('Auto');
    expect(wrapper.findAll('optgroup').map(g => g.attributes('label'))).toEqual(['GPU, 1 free', 'Your machines, $0.10 an hour, on your machine']);
  });

  it('never counts your machine among the GPUs or CPUs offered, nor picks it for Auto', async () => {
    const wrapper = await picker([MINE, GPU]);
    expect(shown(wrapper)).toContain('1 free');                               // the one RunPod GPU
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['gpu:a']);  // Auto: where the files are, never yours
  });
});
