// @vitest-environment jsdom
// Deployments on the person's own machine (agentic-docs/MACHINE_RUNPOD_PARITY_PLAN.md rule 7; backend
// machine_deployments.py). The chat Deploy page offers the workspace's machines beside AADML's chat serving, says the
// fee, lists a machine that cannot hold the version with the reason, and sends the machine chosen ('where').
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MachinePicker from '../../../training-data/src/components/MachinePicker.vue';

// What the two dropdowns show: the kinds (with the fee and the counts), then the machines of the kind chosen.
const shown = w => w.text();
const kindOption = (w, value) => w.find('select.machine-kind').findAll('option').find(o => o.attributes('value') === value);


const MINE = { key: 'machine:2', kind: 'own_machine', machine_id: 2, name: 'gpu box', device: 'gpu',
  gpu_name: 'NVIDIA RTX 4090', memory_gb: 24, stock_text: 'Online', free: false, fits: true, why_not: '',
  price_text: '$0.10 an hour, on your machine', usd_per_hour: '0.10', usd_per_second: '0.000028' };
const SMALL = { ...MINE, key: 'machine:3', machine_id: 3, name: 'laptop', fits: false,
  why_not: 'This model runs on an NVIDIA GPU only; laptop has none.' };
const AADML = { title: 'AADML', small: "AADML's chat serving", text: "The version answers on AADML's chat serving." };

const deployAct = vi.fn();
const page = () => ({
  models: [{ version: 1, name: 'chat-v1', method: 'sft', base_model: 'qwen', approvals: [], deploy_machines: [SMALL, MINE],
    machines: [], merged: null, download_refused: '' }],
  environments: [{ key: 'staging', label: 'Staging', live: null, starting: null, failed: null, history: [], earlier: [],
    deployable: [{ version: 1, name: 'chat-v1', refused: '' }], link: null }],
  serving_refused: '', chat_url: 'https://x/{environment}/', responses_url: 'https://x/{environment}/r',
  may: { train: true, manage: false }, apps: null,
});
vi.mock('../../../training-data/src/api/llm.js', async original => ({
  ...(await original()),
  llmApi: { deploy: vi.fn(async () => page()), deployAct: (...args) => deployAct(...args) },
}));

describe('Where a chat version answers: AADML or your machine', () => {
  beforeEach(() => { deployAct.mockReset(); deployAct.mockResolvedValue({ ...page(), said: 'started' }); });

  it('offers AADML first, RunPod GPU and CPU listed but not choosable, and starts at once on AADML', async () => {
    const wrapper = mount(MachinePicker, { props: { load: async () => ({ machines: [MINE] }), modelValue: '', aadml: AADML } });
    await flushPromises();
    expect(wrapper.text()).toContain("AADML's chat serving");
    expect(kindOption(wrapper, 'gpu').attributes('disabled')).toBeDefined();       // listed, not choosable here
    expect(kindOption(wrapper, 'cpu').attributes('disabled')).toBeDefined();
    expect(wrapper.find('select.machine-select').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Auto found');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['']);
    const run = vi.fn();
    await wrapper.vm.confirm(run);
    expect(run).toHaveBeenCalledOnce();                                     // nothing to find: no approval card
  });

  it('chooses your machine with its fee, and lists one that cannot hold the version with the reason', async () => {
    const wrapper = mount(MachinePicker, { props: { load: async () => ({ machines: [SMALL, MINE] }), modelValue: '', aadml: AADML } });
    await flushPromises();
    await wrapper.find('select.machine-kind').setValue('own_machine');
    await wrapper.find('select.machine-select').setValue('machine:2');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['machine:2']);
    expect(shown(wrapper)).toContain('$0.10 an hour, on your machine');
    const small = wrapper.findAll('option').find(o => o.attributes('value') === 'machine:3');
    expect(small.attributes('disabled')).toBeDefined();
    expect(small.text()).toContain('NVIDIA GPU only');
  });

  it('the Deploy page sends the machine chosen, and nothing when AADML is chosen', async () => {
    const { default: LlmDeploy } = await import('../../../training-data/src/components/LlmDeploy.vue');
    const wrapper = mount(LlmDeploy, { props: { project: { ref: 'bot' } } });
    await flushPromises();
    expect(wrapper.text()).toContain('Where it answers in staging');
    const deployButton = () => wrapper.findAll('button').find(b => b.text().includes('Deploy to staging'));
    await deployButton().trigger('click');
    await flushPromises();
    expect(deployAct).toHaveBeenLastCalledWith('bot', 'staging', 'deploy', { model: 1 });
    await wrapper.find('select.machine-kind').setValue('own_machine');
    await wrapper.find('select.machine-select').setValue('machine:2');
    await flushPromises();
    await deployButton().trigger('click');
    await flushPromises();
    expect(deployAct).toHaveBeenLastCalledWith('bot', 'staging', 'deploy', { model: 1, where: 'machine:2' });
  });
});
