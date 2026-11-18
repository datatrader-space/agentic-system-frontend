// @vitest-environment jsdom
// The Use dialog of a dedicated deployment makes the app key itself (workspaceApi.dedicatedAppKey): an aadml_app_ key
// that may call the deployment's project in its environment, shown once. Live, 2026-11-18: the dialog sent the owner to
// Connect app, whose tmd_ keys only send records in, and the call was refused "Unknown or revoked app credential."
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const body = () => ({
  deployments: [{ id: 5, name: 'sajid', kind: 'development', kind_label: 'Development', instance_type: 'own-machine-7',
    machine_label: 'gpu box (your machine)', state: 'live', state_label: 'Live', idle_minutes: 60, failure_reason: '',
    source: 'model', call: 'chat', open_model: null, project: { ref: 'bakery', name: 'Bakery chat' },
    model: { number: 2, name: 'chat-v2', version: '', base_model: 'qwen2.5-0.5b-instruct' },
    path: '/api/training-data/v1/dedicated/sajid/v1/chat/completions', environment: 'staging',
    created_at: '2026-11-18T10:00:00Z', live_at: '2026-11-18T10:05:00Z', last_used_at: null, stopped_at: null }],
  options: { projects: [], machines: [], kinds: [{ value: 'development', label: 'Development', idle_minutes: 60 }],
    machines_unavailable: '', open_models: [], open_machines: [] },
  cost_note: '', may: { start_development: true, start_production: true, reason_development: '', reason_production: '' },
});
const dedicatedAppKey = vi.fn();
vi.mock('../../../training-data/src/api/workspace.js', async original => ({
  ...(await original()),
  workspaceApi: { dedicated: vi.fn(async () => body()), dedicatedAppKey: (...a) => dedicatedAppKey(...a), stopDedicated: vi.fn() },
}));
const STUBS = { UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="stub-dialog"><slot/></div>' } };
const button = (w, text) => w.findAll('button').find(b => b.text().includes(text));

describe('the Use dialog makes the app key', () => {
  it('names the right key, never sends to Connect app, and shows the made key once', async () => {
    const { default: DedicatedDeployments } = await import('../../../training-data/src/components/DedicatedDeployments.vue');
    const w = mount(DedicatedDeployments, { props: { projectRef: 'bakery', chat: true }, global: { stubs: STUBS } });
    await flushPromises();
    await button(w, 'Use').trigger('click');
    expect(w.text()).toContain('aadml_app_');
    expect(w.find('a[href$="/connect"]').exists()).toBe(false);                      // not the data keys page
    expect(w.find('a[href="#project/bakery/deploy"]').exists()).toBe(true);
    expect(button(w, 'Make the key').attributes('disabled')).toBeDefined();          // a name first
    dedicatedAppKey.mockResolvedValue({ made: { app: 'Support site', key: 'aadml_app_TESTONLY', environment: 'staging' } });
    await w.find('input[aria-label="Name of the app that calls this deployment"]').setValue('Support site');
    await w.find('form.use-key-form').trigger('submit');
    await flushPromises();
    expect(dedicatedAppKey).toHaveBeenCalledWith(5, 'Support site');
    expect(w.find('.use-key-made code').text()).toBe('aadml_app_TESTONLY');
    expect(w.find('form.use-key-form').exists()).toBe(false);
    await w.findAll('button').find(b => b.text() === 'Close').trigger('click');     // closing forgets it
    await button(w, 'Use').trigger('click');
    expect(w.text()).not.toContain('aadml_app_TESTONLY');
  });

  it('says the server refusal', async () => {
    const { default: DedicatedDeployments } = await import('../../../training-data/src/components/DedicatedDeployments.vue');
    const w = mount(DedicatedDeployments, { props: { projectRef: 'bakery', chat: true }, global: { stubs: STUBS } });
    await flushPromises();
    await button(w, 'Use').trigger('click');
    dedicatedAppKey.mockRejectedValue(new Error('Only a person who manages this project makes its app keys.'));
    await w.find('input[aria-label="Name of the app that calls this deployment"]').setValue('X');
    await w.find('form.use-key-form').trigger('submit');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toContain('manages this project');
  });
});
