// @vitest-environment jsdom
// "Workflows apps can call" on the Workflows page (VISION_WORKFLOWS_PLAN.md 5.3, ADM-1351 phase 3): the access given
// (app -> workflow, by whom, when), Revoke only where the server says `may.revoke`, always through the page's own
// confirm dialog (never the browser's confirm()); a form that gives an app access to a workflow with the server's
// refusal at its field; the empty states say why, with where to go; "How to call it" shows the address and a curl
// example that never carries a real key.
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = [];
const state = { body: null, refuse: null };
const BODY = () => ({
  apps: [{ id: 3, name: 'Yard server', disabled: false }, { id: 4, name: 'Old kiosk', disabled: true }],
  workflows: [{ id: 12, name: 'Desk check', published_version: 3, path: '/api/training-data/v1/workflows/12/infer' },
    { id: 14, name: 'Door count', published_version: null, path: '/api/training-data/v1/workflows/14/infer' }],
  grants: [
    { id: 70, app: { id: 3, name: 'Yard server', disabled: false }, workflow: { id: 12, name: 'Desk check' }, by: 'Sajid', created_at: new Date(Date.now() - 2 * 3600e3).toISOString(), may: { revoke: true } },
    { id: 71, app: { id: 4, name: 'Old kiosk', disabled: true }, workflow: { id: 12, name: 'Desk check' }, by: 'Ana', created_at: new Date().toISOString(), may: { revoke: false } },
  ],
  infer: { path: '/api/training-data/v1/workflows/{id}/infer', note: 'Send one image (multipart form field "file").' },
});
vi.mock('../../../training-data/src/api/workflowApps.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    workflowAppsApi: {
      load: vi.fn(async () => { calls.push(['load']); if (state.refuse?.on === 'load') { const e = state.refuse.error; state.refuse = null; throw e; } return state.body; }),
      give: vi.fn(async args => { calls.push(['give', args]); if (state.refuse?.on === 'give') throw state.refuse.error; return { said: '"Yard server" may call Door count.', ...state.body }; }),
      revoke: vi.fn(async id => { calls.push(['revoke', id]); return { said: '"Yard server" may no longer call Desk check.', ...state.body, grants: state.body.grants.filter(g => g.id !== id) }; }),
    },
  };
});
import WorkflowApps from '../../../training-data/src/components/WorkflowApps.vue';

const STUBS = { UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="dlg" :data-title="title"><slot/></div>' } };
async function page() {
  const w = mount(WorkflowApps, { attachTo: document.body, global: { stubs: STUBS } });
  await flushPromises();
  return w;
}

describe('workflows apps can call', () => {
  beforeEach(() => { calls.length = 0; state.body = BODY(); state.refuse = null; document.body.innerHTML = ''; });

  it('lists each access as app to workflow, by whom and when, with Revoke only where the server allows it', async () => {
    const w = await page();
    const rows = w.findAll('[data-test="wa-grant"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain('Yard server');
    expect(rows[0].text()).toContain('Desk check');
    expect(rows[0].text()).toContain('Given by Sajid, 2 hours ago');
    expect(rows[0].find('[data-test="wa-revoke"]').exists()).toBe(true);
    expect(rows[1].find('[data-test="wa-revoke"]').exists()).toBe(false);
    expect(rows[1].text()).toContain('Turned off');
    w.unmount();
  });

  it('revokes only after the page\'s own confirm dialog, never the browser\'s', async () => {
    const native = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const w = await page();
    await w.find('[data-test="wa-revoke"]').trigger('click');
    expect(calls.some(c => c[0] === 'revoke')).toBe(false);
    const dialog = w.find('.dlg');
    expect(dialog.attributes('data-title')).toBe('Take this access away?');
    expect(dialog.text()).toContain('Yard server can no longer call Desk check');
    await w.find('[data-test="wa-confirm-revoke"]').trigger('click');
    await flushPromises();
    expect(calls).toContainEqual(['revoke', 70]);
    expect(native).not.toHaveBeenCalled();
    expect(w.find('.dlg').exists()).toBe(false);
    expect(w.findAll('[data-test="wa-grant"]')).toHaveLength(1);
    expect(w.find('.notice').text()).toContain('may no longer call Desk check');
    native.mockRestore();
    w.unmount();
  });

  it('gives an app access to a workflow, and says what the server answered', async () => {
    const w = await page();
    expect(w.find('[data-test="wa-workflow"]').findAll('option').map(o => o.text())).toEqual(['Desk check, version 3', 'Door count, not published yet']);
    expect(w.find('[data-test="wa-app"]').findAll('option').map(o => o.text())).toEqual(['Yard server', 'Old kiosk (turned off)']);
    // Yard server may already call Desk check: said, and not sent.
    expect(w.find('#wa-why').text()).toBe('Yard server may already call Desk check.');
    expect(w.find('[data-test="wa-give"]').attributes('disabled')).toBeDefined();
    await w.find('[data-test="wa-workflow"]').setValue('14');
    expect(w.find('#wa-workflow-help').text()).toContain('refused until a version of it is published');
    await w.find('form.wa-form').trigger('submit');
    await flushPromises();
    expect(calls).toContainEqual(['give', { app: '3', workflow: '14' }]);
    expect(w.find('.notice').text()).toContain('"Yard server" may call Door count.');
    w.unmount();
  });

  it('shows the server\'s refusal next to the field it names', async () => {
    state.refuse = { on: 'give', error: Object.assign(new Error('Only a workflow whose trigger is "Each camera frame" answers an image sent to it.'), { status: 400, field: 'workflow', serverCode: 'not_a_frame_workflow' }) };
    const w = await page();
    await w.find('[data-test="wa-workflow"]').setValue('14');
    await w.find('form.wa-form').trigger('submit');
    await flushPromises();
    expect(w.find('#wa-workflow-error').text()).toContain('"Each camera frame"');
    expect(w.find('[data-test="wa-workflow"]').attributes('aria-invalid')).toBe('true');
    w.unmount();
  });

  it('with no app, says why and where an app is made; with no frame workflow, links to the builder', async () => {
    state.body = { ...BODY(), apps: [], grants: [] };
    let w = await page();
    expect(w.find('[data-test="wa-no-grants"]').exists()).toBe(true);
    expect(w.find('[data-test="wa-empty"]').text()).toContain('An app is made on a project\'s Deployments page');
    expect(w.find('[data-test="wa-empty"] a').attributes('href')).toBe('#deployments');
    expect(w.find('form.wa-form').exists()).toBe(false);
    w.unmount();
    state.body = { ...BODY(), workflows: [], grants: [] };
    w = await page();
    const link = w.find('[data-test="wa-empty"] a');
    expect(w.find('[data-test="wa-empty"]').text()).toContain('starts with "Each camera frame", then publish it');
    expect(link.attributes('href')).toBe('/dashboard/workflow-builder');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    w.unmount();
  });

  it('shows how to call it: the address, the note, and a curl example with no real key, copied on request', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const w = await page();
    const curl = w.find('[data-test="wa-curl"]').text();
    expect(curl).toBe(`curl -X POST ${location.origin}/api/training-data/v1/workflows/12/infer -H "Authorization: Bearer aadml_app_…" -F file=@photo.jpg`);
    expect(w.text()).toContain('Send one image (multipart form field "file").');
    await w.find('[data-test="wa-workflow"]').setValue('14');
    expect(w.find('[data-test="wa-curl"]').text()).toContain('/workflows/14/infer');
    await w.find('[data-test="wa-copy"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Bearer aadml_app_…'));
    expect(w.find('[data-test="wa-copy"]').text()).toContain('Copied');
    w.unmount();
  });

  it('a failed read is shown with Try again, which reads again', async () => {
    state.refuse = { on: 'load', error: Object.assign(new Error('AADML did not answer just now. Try again in a moment.'), { status: 502 }) };
    const w = await page();
    expect(w.find('[role="alert"]').text()).toContain('AADML did not answer just now.');
    await w.find('[data-test="wa-retry"]').trigger('click');
    await flushPromises();
    expect(calls.filter(c => c[0] === 'load')).toHaveLength(2);
    expect(w.findAll('[data-test="wa-grant"]')).toHaveLength(2);
    w.unmount();
  });
});
