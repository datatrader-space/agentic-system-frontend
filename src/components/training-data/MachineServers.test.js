// @vitest-environment jsdom
// Every server RunPod runs, on the person's own machine (agentic-docs/MACHINE_RUNPOD_PARITY_PLAN.md; owner, 2026-11-11).
// A page whose model AADML runs where it always does (the chat Test page: no RunPod machine to choose) offers "AADML's
// GPU server" beside the person's machines; a machine that cannot hold the model is listed with the reason and never
// chosen; nothing is ever started elsewhere without the person's choice. The chat Test page sends the chosen machine
// and says the fee, never "free".
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import MachinePicker from '../../../training-data/src/components/MachinePicker.vue';

// What the dropdown shows: its options and its group labels (where the fee and the counts are).
const shown = w => `${w.text()} ${w.findAll('optgroup').map(g => g.attributes('label')).join(' ')}`;


const MINE = { key: 'machine:2', kind: 'own_machine', machine_id: 2, name: 'garage box', device: 'gpu',
  gpu_name: 'NVIDIA GeForce RTX 4090', memory_gb: 24, stock_text: 'Online', free: false, fits: true, why_not: '',
  price_text: '$0.10 an hour, on your machine', usd_per_hour: '0.10', usd_per_second: '0.000028' };
const CPU_ONLY = { ...MINE, key: 'machine:3', machine_id: 3, name: 'old laptop', gpu_name: '', device: 'cpu', fits: false,
  why_not: 'This needs an NVIDIA GPU with 8 GB of memory; old laptop has none.' };

async function picker(machines) {
  const wrapper = mount(MachinePicker, { props: { load: async () => ({ machines, note: '' }), modelValue: '',
    aadml: { title: "AADML's GPU server", small: 'as always', text: "AADML's GPU server runs it, as it always does.", value: 'aadml' } } });
  await flushPromises();
  return wrapper;
}

describe("Where it runs, with AADML's own server as a choice", () => {
  it("chooses AADML's server first, never an empty choice, and offers no Auto, GPU or CPU", async () => {
    const wrapper = await picker([MINE]);
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['aadml']);
    expect(wrapper.text()).toContain("AADML's GPU server");
    expect(wrapper.findAll('option')[0].text()).toContain("AADML's GPU server");  // no Auto: AADML's server is its own choice
    expect(wrapper.text()).not.toContain('Auto:');
    expect(wrapper.find('optgroup[label^="GPU"]').exists()).toBe(false);
  });

  it('offers your machine with its fee, and lists one that cannot hold the model with the reason', async () => {
    const wrapper = await picker([CPU_ONLY, MINE]);
    expect(shown(wrapper)).toContain('$0.10 an hour, on your machine');
    expect(wrapper.text()).not.toContain('free, on your hardware');
    await wrapper.find('select.machine-select').setValue('machine:2');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['machine:2']);
    const laptop = wrapper.findAll('option').find(o => o.attributes('value') === 'machine:3');
    expect(laptop.attributes('disabled')).toBeDefined();
    expect(laptop.text()).toContain('needs an NVIDIA GPU');
    await wrapper.find('select.machine-select').setValue('__auto');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['aadml']);
  });

  it('with no machine added, still offers the server and says your machine has none', async () => {
    const wrapper = await picker([]);
    expect(wrapper.text()).not.toContain('No machine that can hold this model is free now');
    const none = wrapper.findAll('option').find(o => o.text().includes('none added'));
    expect(none.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('none added');
  });
});

// ── the chat Test page ───────────────────────────────────────────────────────────────────────────────────────────
const api = vi.hoisted(() => ({
  trials: vi.fn(), startTrial: vi.fn(), stopTrial: vi.fn(), chat: vi.fn(), trialMachines: vi.fn(), compare: vi.fn(),
}));
vi.mock('../../../training-data/src/api/llm.js', () => ({ llmApi: api }));

const PAGE = { choices: [{ kind: 'base', base_model: 'qwen2.5-0.5b-instruct', label: 'qwen2.5-0.5b-instruct (base model, untrained)', ready: true }],
  trial: null, max_tokens: [64, 256], default_max_tokens: 256 };

describe('the chat Test page on your machine', () => {
  it('sends the machine chosen with the start, and says the fee while it runs there', async () => {
    const { default: LlmTest } = await import('../../../training-data/src/components/LlmTest.vue');
    api.trials.mockResolvedValue(PAGE);
    api.compare.mockResolvedValue({ evaluations: [] });
    api.trialMachines.mockResolvedValue({ machines: [MINE], note: '' });
    api.startTrial.mockResolvedValue({});
    const wrapper = mount(LlmTest, { props: { project: { ref: 'bot' } } });
    await flushPromises();
    expect(api.trialMachines).toHaveBeenCalledWith('bot', { base_model: 'qwen2.5-0.5b-instruct' });
    await wrapper.find('select.machine-select').setValue('machine:2');
    await flushPromises();
    const running = { id: 1, state: 'ready', state_label: 'Ready', model: 'qwen2.5-0.5b-instruct (base model)', model_version: null,
      base_model: 'qwen2.5-0.5b-instruct', failure: '',
      machine: { id: 2, name: 'garage box', job: 9, state: 'running', stage: 'ready', label: 'Ready on garage box',
                 price_text: '$0.10 an hour, on your machine' } };
    api.trials.mockResolvedValue({ ...PAGE, trial: running });
    await wrapper.findAll('button').find(b => b.text().includes('Start the test server')).trigger('click');
    await flushPromises();
    expect(api.startTrial).toHaveBeenCalledWith('bot', { base_model: 'qwen2.5-0.5b-instruct', machine: 'machine:2' });
    expect(wrapper.text()).toContain('$0.10 an hour, on your machine, charged by the second');
    expect(wrapper.text()).not.toMatch(/free/i);
  });

  it("starts on AADML's server when that is chosen, sending no machine", async () => {
    const { default: LlmTest } = await import('../../../training-data/src/components/LlmTest.vue');
    api.trials.mockResolvedValue(PAGE);
    api.trialMachines.mockResolvedValue({ machines: [MINE], note: '' });
    api.startTrial.mockClear();
    const wrapper = mount(LlmTest, { props: { project: { ref: 'bot' } } });
    await flushPromises();
    await wrapper.findAll('button').find(b => b.text().includes('Start the test server')).trigger('click');
    await flushPromises();
    expect(api.startTrial).toHaveBeenCalledWith('bot', { base_model: 'qwen2.5-0.5b-instruct' });
  });
});
