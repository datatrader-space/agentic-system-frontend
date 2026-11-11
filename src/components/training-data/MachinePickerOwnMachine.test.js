// @vitest-environment jsdom
// "Your machine" in Try's "Where it runs" (agentic-docs/TRY_ON_MY_MACHINE_PLAN.md; owner, 2026-11-10: "only if machine
// is connected"). The server lists a workspace machine only when it is online and allowed; the picker shows the choice
// only then, says it is free, and sends the machine's key.
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MachinePicker from '../../../training-data/src/components/MachinePicker.vue';

const GPU = { key: 'gpu:a', kind: 'gpu', gpu_name: 'PRO 6000 MIG 24GB', memory_gb: 24, data_center: 'US-WA-1', soc2: true,
  usd_per_hour: '0.90', usd_per_second: '0.000250', files_here: true, stock_text: 'Few free' };
const MINE = { key: 'machine:2', kind: 'own_machine', machine_id: 2, name: '235e1456c44f', device: 'gpu',
  gpu_name: 'NVIDIA GeForce RTX 3070', memory_gb: 23, stock_text: 'Online', free: true, usd_per_hour: '0.00',
  usd_per_second: '0.000000' };

async function picker(machines) {
  const wrapper = mount(MachinePicker, { props: { load: async () => ({ machines, note: '' }), modelValue: '' } });
  await flushPromises();
  return wrapper;
}

describe('Try on my machine: the choice in Where it runs', () => {
  it('is not shown when no machine of the workspace is offered', async () => {
    const wrapper = await picker([GPU]);
    expect(wrapper.text()).not.toContain('Your machine');
    expect(wrapper.find('input[value="own_machine"]').exists()).toBe(false);
  });

  it('is shown when one is offered, says it is free, and chooses that machine', async () => {
    const wrapper = await picker([MINE, GPU]);
    expect(wrapper.text()).toContain('Your machine');
    expect(wrapper.text()).toContain('free, on your hardware');
    await wrapper.find('input[value="own_machine"]').setValue();
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['machine:2']);
    await wrapper.setProps({ modelValue: 'machine:2' });
    expect(wrapper.text()).toContain('Free: it runs on your hardware');
    expect(wrapper.text()).not.toMatch(/\$0\.00 an hour/);                    // never priced like a rented machine
  });

  it('never counts your machine among the GPUs or CPUs offered, nor picks it for Auto', async () => {
    const wrapper = await picker([MINE, GPU]);
    expect(wrapper.text()).toContain('1 free');                               // the one RunPod GPU
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['gpu:a']);  // Auto: where the files are, never yours
  });
});
