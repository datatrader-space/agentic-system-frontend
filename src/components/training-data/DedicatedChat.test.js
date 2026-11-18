// @vitest-environment jsdom
// A chat project's trained model on a Dedicated Deployment (backend dedicated.start_chat; owner, 2026-11-18: "user should
// be able to deploy the trained or open model on his machine as well"). The chat project's Deploy page shows the
// Dedicated Deployments tab for its project; the form offers its approved versions only, with the GPUs and the
// workspace's machines that hold the version chosen, and sends the version's number. The workspace tab lists the chat
// project beside the photo projects.
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const GPU_SMALL = { instance_type: 'TEST 24GB@US-WA-1', gpu: true, gpu_name: 'Test 24GB', memory_gb: 24, data_center: 'US-WA-1',
  soc2: true, stock_text: 'High', files_here: true, charged_usd_per_hour: '0.12', usd_per_second: '0.000033', charged_usd_per_month: '86.40' };
const GPU_LARGE = { ...GPU_SMALL, instance_type: 'TEST 48GB@US-WA-1', gpu_name: 'Test 48GB', memory_gb: 48, charged_usd_per_hour: '0.24' };
const BOX = { key: 'machine:7', kind: 'own_machine', machine_id: 7, name: 'gpu box', device: 'gpu', gpu_name: 'NVIDIA RTX 3070',
  memory_gb: 8, stock_text: 'Online', fits: true, why_not: '', free: false, price_text: '$0.10 an hour, on your machine',
  usd_per_hour: '0.10', usd_per_second: '0.000028' };
const CHAT_V2 = { number: 2, name: 'chat-v2', version: '', base_model: 'qwen2.5-0.5b-instruct', why_not: '',
  approved: { development: true, production: false }, machines: [GPU_SMALL.instance_type], own_machines: [BOX],
  gpu_only: 'chat-v2 runs on a GPU only: a chat model needs a GPU to answer.' };
const CHAT_V1 = { ...CHAT_V2, number: 1, name: 'chat-v1', approved: { development: false, production: false } };
const body = () => ({
  deployments: [{ id: 5, name: 'bakery-live', kind: 'development', kind_label: 'Development', instance_type: 'own-machine-7',
    machine_label: 'gpu box (your machine)', state: 'live', state_label: 'Live', idle_minutes: 60, failure_reason: '',
    source: 'model', call: 'chat', open_model: null, project: { ref: 'bakery', name: 'Bakery chat' },
    model: { number: 2, name: 'chat-v2', version: '', base_model: 'qwen2.5-0.5b-instruct' },
    path: '/api/training-data/v1/dedicated/bakery-live/v1/chat/completions', environment: 'staging',
    created_at: '2026-11-18T10:00:00Z', live_at: '2026-11-18T10:05:00Z', last_used_at: null, stopped_at: null }],
  options: { projects: [
    { ref: 'walls', name: 'Walls', family: 'vision', own_machines: [], models: [] },
    { ref: 'bakery', name: 'Bakery chat', family: 'llm', own_machines: [], models: [CHAT_V2, CHAT_V1] }],
  machines: [GPU_SMALL, GPU_LARGE], kinds: [{ value: 'development', label: 'Development', idle_minutes: 60 },
    { value: 'production', label: 'Production' }], machines_unavailable: '', open_models: [], open_machines: [] },
  cost_note: 'Billed by the second from your balance while it runs.',
  may: { start_development: true, start_production: true, reason_development: '', reason_production: '', start_open_model: false },
});
const startDedicated = vi.fn();
vi.mock('../../../training-data/src/api/workspace.js', async original => ({
  ...(await original()),
  workspaceApi: { dedicated: vi.fn(async () => body()), startDedicated: (...args) => startDedicated(...args), stopDedicated: vi.fn() },
}));
const STUBS = { UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="stub-dialog"><slot/></div>' } };

async function tab(props = { projectRef: 'bakery', chat: true }) {
  const { default: DedicatedDeployments } = await import('../../../training-data/src/components/DedicatedDeployments.vue');
  const wrapper = mount(DedicatedDeployments, { props, global: { stubs: STUBS } });
  await flushPromises();
  return wrapper;
}
const button = (w, text) => w.findAll('button').find(b => b.text().includes(text));

describe('Dedicated Deployment of a chat project\'s trained model', () => {
  beforeEach(() => { startDedicated.mockReset(); startDedicated.mockResolvedValue({ ...body(), said: 'bakery-dev is starting.' }); });

  it('lists the chat deployment as a trained chat model, called as chat, with no Edge Devices offer', async () => {
    const wrapper = await tab();
    expect(wrapper.text()).toContain('bakery-live');
    expect(wrapper.text()).toContain('Trained chat model');
    expect(wrapper.text()).toContain('chat-v2 on qwen2.5-0.5b-instruct');
    expect(wrapper.text()).not.toContain('Edge Devices');
    await button(wrapper, 'Use').trigger('click');
    expect(wrapper.text()).toContain("OpenAI's chat format");
    expect(wrapper.text()).toContain('/v1/chat/completions');
  });

  it('offers the approved version only, the GPUs and machines that hold it, and sends its number', async () => {
    const wrapper = await tab();
    await button(wrapper, 'New deployment').trigger('click');
    await flushPromises();
    const versions = wrapper.find('#ded-model').findAll('option').map(o => o.text());
    expect(versions).toEqual(['chat-v2']);                                  // chat-v1 has no approval
    const kinds = wrapper.find('select.machine-kind');
    await kinds.setValue('gpu');
    const gpus = wrapper.find('select.machine-select').findAll('option').map(o => o.attributes('value'));
    expect(gpus).toEqual([GPU_SMALL.instance_type]);                        // the 48 GB one is not listed for it
    expect(wrapper.find('select.machine-kind').findAll('option').find(o => o.attributes('value') === 'cpu').text())
      .toBe('CPU: this model needs a GPU');
    await kinds.setValue('own_machine');
    expect(wrapper.find('select.machine-select').findAll('option').map(o => o.attributes('value'))).toEqual(['machine:7']);
    await wrapper.find('#ded-name').setValue('bakery-dev');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(startDedicated).toHaveBeenCalledOnce();
    expect(startDedicated.mock.calls[0][0]).toMatchObject({ source: 'model', project: 'bakery', model: 2, instance_type: 'machine:7',
      kind: 'development', name: 'bakery-dev' });
  });

  it('says where a chat version is approved when none is for the kind', async () => {
    const wrapper = await tab();
    await button(wrapper, 'New deployment').trigger('click');
    await flushPromises();
    await wrapper.findAll('input[name="ded-kind"]').find(i => i.attributes('value') === 'production').setValue(true);
    await flushPromises();
    expect(wrapper.text()).toContain('a release approval');
    expect(wrapper.text()).toContain("Approvals on the project's Deploy page");
  });

  it('on the workspace tab the chat project is listed beside the photo projects', async () => {
    const wrapper = await tab({ projectRef: '' });
    await button(wrapper, 'New deployment').trigger('click');
    await flushPromises();
    expect(wrapper.find('#ded-project').findAll('option').map(o => o.text())).toEqual(['Walls', 'Bakery chat']);
    expect(wrapper.find('#ded-project').element.value).toBe('bakery');       // the first with an approved model
  });
});

describe('The chat project\'s Deploy page', () => {
  it('shows the Dedicated Deployments tab for its own project', async () => {
    vi.doMock('../../../training-data/src/api/llm.js', async original => ({
      ...(await original()),
      llmApi: { deploy: vi.fn(async () => ({ models: [{ version: 2, name: 'chat-v2', method: 'sft', base_model: 'qwen', approvals: [],
        deploy_machines: [], machines: [], merged: null, download_refused: '' }], environments: [], serving_refused: '',
      chat_url: 'https://x/{environment}/', responses_url: 'https://x/{environment}/r', may: { train: true, manage: false }, apps: null })) },
    }));
    const { default: LlmDeploy } = await import('../../../training-data/src/components/LlmDeploy.vue');
    const wrapper = mount(LlmDeploy, { props: { project: { ref: 'bakery' } }, global: { stubs: { ...STUBS, DedicatedDeployments: { props: { projectRef: String, chat: Boolean }, template: '<div class="ded-stub">{{ projectRef }} {{ chat }}</div>' } } } });
    await flushPromises();
    expect(wrapper.find('.ded-stub').exists()).toBe(true);
    expect(wrapper.find('.ded-stub').text()).toBe('bakery true');
  });
});
