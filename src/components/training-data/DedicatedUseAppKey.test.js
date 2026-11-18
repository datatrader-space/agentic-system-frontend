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
const dedicatedAppKeys = vi.fn();
const revokeDedicatedAppKey = vi.fn();
vi.mock('../../../training-data/src/api/workspace.js', async original => ({
  ...(await original()),
  workspaceApi: {
    dedicated: vi.fn(async () => body()), dedicatedAppKey: (...a) => dedicatedAppKey(...a), stopDedicated: vi.fn(),
    dedicatedAppKeys: (...a) => dedicatedAppKeys(...a), revokeDedicatedAppKey: (...a) => revokeDedicatedAppKey(...a),
  },
}));
// A server from before the key list (an old one for a few minutes during a deploy) answers its address 404.
const notThere = () => Object.assign(new Error('The request was refused.'), { status: 404, code: 'server' });
// What the server lists: alice's Support bot with one key that works, Shared (whose keys she may not see: it reaches a
// project she does not manage) and Old site (turned off). Hints only: the listing never holds a key.
const listing = (keys = [{ id: 11, hint: 'aadml_app_…ab12', name: '', created_at: '2026-11-18T09:00:00Z',
  last_used_at: '2026-11-18T09:30:00Z', request_count: 3 }]) => ({
  project: { ref: 'bakery', name: 'Bakery chat' }, environment: 'staging', environment_label: 'Staging',
  apps: [
    { id: 1, name: 'Support bot', disabled: false, linked: false, other_projects: 1, can_manage: true, keys },
    { id: 2, name: 'Shared', disabled: false, linked: false, other_projects: 2, can_manage: false, keys: null },
    { id: 3, name: 'Old site', disabled: true, linked: false, other_projects: 0, can_manage: true, keys: [] },
  ],
});
const STUBS = { UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="stub-dialog"><slot/></div>' } };
const button = (w, text) => w.findAll('button').find(b => b.text().includes(text));

describe('the Use dialog makes the app key', () => {
  it('names the right key, never sends to Connect app, and shows the made key once', async () => {
    const { default: DedicatedDeployments } = await import('../../../training-data/src/components/DedicatedDeployments.vue');
    dedicatedAppKeys.mockRejectedValue(notThere());                                   // an old server: no list
    const w = mount(DedicatedDeployments, { props: { projectRef: 'bakery', chat: true }, global: { stubs: STUBS } });
    await flushPromises();
    await button(w, 'Use').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('aadml_app_');
    expect(w.find('.use-key-list').exists()).toBe(false);
    expect(w.text()).not.toContain('could not be listed');                             // a 404 is said nothing of
    expect(w.text()).toContain('A key is shown only once, when it is made.');
    expect(w.find('a[href$="/connect"]').exists()).toBe(false);                      // not the data keys page
    expect(w.find('a[href="#project/bakery/deploy"]').exists()).toBe(true);
    expect(button(w, 'Make the key').attributes('disabled')).toBeDefined();          // a name first
    dedicatedAppKey.mockResolvedValue({ made: { app: 'Support site', key: 'aadml_app_TESTONLY', environment: 'staging' } });
    await w.find('input[aria-label="Name of the app that calls this deployment"]').setValue('Support site');
    await w.find('form.use-key-form').trigger('submit');
    await flushPromises();
    expect(dedicatedAppKey).toHaveBeenCalledWith(5, 'Support site');
    expect(w.find('.use-key-made code').text()).toBe('aadml_app_TESTONLY');
    expect(w.find('.use-key-made').text()).toContain('Copy it now: it will not be shown again');
    expect(w.find('form.use-key-form').exists()).toBe(false);
    await w.findAll('button').find(b => b.text() === 'Close').trigger('click');     // closing forgets it
    await button(w, 'Use').trigger('click');
    expect(w.text()).not.toContain('aadml_app_TESTONLY');
  });

  it('says the server refusal', async () => {
    dedicatedAppKeys.mockRejectedValue(notThere());
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

describe('the Use dialog lists the keys that already call the deployment', () => {
  async function opened() {
    const { default: DedicatedDeployments } = await import('../../../training-data/src/components/DedicatedDeployments.vue');
    const w = mount(DedicatedDeployments, { props: { projectRef: 'bakery', chat: true }, global: { stubs: STUBS } });
    await flushPromises();
    await button(w, 'Use').trigger('click');
    await flushPromises();
    return w;
  }

  it('shows each app with its keys by their hint, and says a key is shown once', async () => {
    dedicatedAppKeys.mockReset(); dedicatedAppKeys.mockResolvedValue(listing());
    const w = await opened();
    expect(dedicatedAppKeys).toHaveBeenCalledWith(5);
    const list = w.find('.use-key-list');
    expect(list.text()).toContain('Support bot');
    expect(list.text()).toContain('aadml_app_…ab12');
    expect(list.text()).toContain('3 requests');
    expect(list.text()).toContain('Shared');
    expect(list.text()).toContain('listed to a person who manages every project it reaches');
    expect(w.text()).toContain("A key is shown only once, when it is made. Keep it in your app's settings or a password manager. Lost it? Make a new key and revoke the old one.");
    const revokes = w.findAll('button').filter(b => b.text() === 'Revoke');
    expect(revokes).toHaveLength(1);                                                    // only the key she may change
    expect(revokes[0].attributes('aria-label')).toBe('Revoke aadml_app_…ab12 of Support bot');
  });

  it('makes the key for an app already listed by default, or for a new one', async () => {
    dedicatedAppKeys.mockReset(); dedicatedAppKeys.mockResolvedValue(listing());
    dedicatedAppKey.mockReset();
    dedicatedAppKey.mockResolvedValue({ made: { app: 'Support bot', key: 'aadml_app_TESTONLY2', environment: 'staging' } });
    const w = await opened();
    const select = w.find('select[aria-label="App that calls this deployment"]');
    expect(select.element.value).toBe('Support bot');
    expect(select.findAll('option').map(o => o.text())).toEqual(['Support bot', 'A new app…']);   // not Shared, not Old site
    expect(w.find('input[aria-label="Name of the app that calls this deployment"]').exists()).toBe(false);
    await w.find('form.use-key-form').trigger('submit');
    await flushPromises();
    expect(dedicatedAppKey).toHaveBeenCalledWith(5, 'Support bot');
    expect(dedicatedAppKeys).toHaveBeenCalledTimes(2);                                  // the list is read again
    expect(w.find('.use-key-made').text()).toContain('Copy it now: it will not be shown again');
    // A new app, named by the person
    await w.findAll('button').find(b => b.text() === 'Close').trigger('click');
    await button(w, 'Use').trigger('click');
    await flushPromises();
    const choose = w.find('select[aria-label="App that calls this deployment"]');
    await choose.setValue(choose.findAll('option').at(-1).element.value);
    const name = w.find('input[aria-label="Name of the app that calls this deployment"]');
    expect(button(w, 'Make the key').attributes('disabled')).toBeDefined();
    await name.setValue('Kiosk');
    await w.find('form.use-key-form').trigger('submit');
    await flushPromises();
    expect(dedicatedAppKey).toHaveBeenLastCalledWith(5, 'Kiosk');
  });

  it('revokes a key only after the person confirms, and shows the list the server answers', async () => {
    dedicatedAppKeys.mockReset(); dedicatedAppKeys.mockResolvedValue(listing());
    revokeDedicatedAppKey.mockReset();
    revokeDedicatedAppKey.mockResolvedValue({ ...listing([]), said: 'aadml_app_…ab12 of "Support bot" is revoked.' });
    const w = await opened();
    await w.findAll('button').find(b => b.text() === 'Revoke').trigger('click');
    const confirm = w.find('.use-key-confirm');
    expect(confirm.text()).toContain('Revoke aadml_app_…ab12 of Support bot?');
    expect(confirm.text()).toContain('also reaches 1 other project');
    expect(revokeDedicatedAppKey).not.toHaveBeenCalled();
    await w.findAll('button').find(b => b.text() === 'Keep it').trigger('click');     // changed her mind
    expect(w.find('.use-key-confirm').exists()).toBe(false);
    expect(revokeDedicatedAppKey).not.toHaveBeenCalled();
    await w.findAll('button').find(b => b.text() === 'Revoke').trigger('click');
    await w.findAll('button').find(b => b.text() === 'Revoke key').trigger('click');
    await flushPromises();
    expect(revokeDedicatedAppKey).toHaveBeenCalledWith(5, 11);
    expect(w.find('.use-key-confirm').exists()).toBe(false);
    expect(w.findAll('.use-key-row')).toHaveLength(0);
    expect(w.text()).toContain('is revoked');
  });

  it('says a refused revoke and keeps the key listed', async () => {
    dedicatedAppKeys.mockReset(); dedicatedAppKeys.mockResolvedValue(listing());
    revokeDedicatedAppKey.mockReset();
    revokeDedicatedAppKey.mockRejectedValue(new Error('A key of "Support bot" reaches every project the app has access to.'));
    const w = await opened();
    await w.findAll('button').find(b => b.text() === 'Revoke').trigger('click');
    await w.findAll('button').find(b => b.text() === 'Revoke key').trigger('click');
    await flushPromises();
    expect(w.find('.use-key-confirm [role="alert"]').text()).toContain('reaches every project');
    expect(w.findAll('.use-key-row')).toHaveLength(1);
  });
});
