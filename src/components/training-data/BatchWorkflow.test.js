// @vitest-environment jsdom
// A batch answered by a workflow (VISION_WORKFLOWS_PLAN.md 5.3, ADM-1351 phase 3): "A workflow" in the New batch dialog
// lists the workflows the server offers (options.workflows) and posts the chosen one with the project and the photos,
// never a model; the server's refusal of the workflow is shown at its field, a balance refusal (402) above the
// buttons; with none, the dialog says how to make one and links to the Workflow Builder. A row names its workflow.
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent = [];
const state = { workflows: [], refuse: null, may: { start: true } };
const ROW = { id: 5, project: { ref: 'p1', name: 'Office' }, model: null, workflow: { id: 12, name: 'Desk check', version: 3 },
  source: 'all', source_label: 'All photos', state: 'done', total: 4, done: 4, failed: 0, created_at: new Date().toISOString(),
  finished_at: new Date().toISOString(), by: 'Sajid', may: { download: true, cancel: false } };
const PAGE = () => ({
  batches: [ROW], limit: 500, may: state.may,
  options: { projects: [{ ref: 'p1', name: 'Office', photos: 40, versions: [], models: [], running: false }], workflows: state.workflows },
});
vi.mock('../../../training-data/src/api/batch.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    batchApi: {
      ...actual.batchApi,
      list: vi.fn(async () => PAGE()),
      start: vi.fn(async args => {
        sent.push({ args, body: actual.startBody(args) });
        if (state.refuse) throw state.refuse;
        return { said: 'The batch has started: the workflow Desk check (version 3) on 40 photos of Office.', ...PAGE() };
      }),
    },
  };
});
import BatchTab from '../../../training-data/src/components/BatchTab.vue';

const STUBS = {
  DeploymentHeader: { template: '<div><slot/></div>' }, DeploymentMetrics: true,
  DeploymentToolbar: { template: '<div class="tb"><slot/></div>' },
  UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="dlg" :data-title="title"><slot/></div>' },
};
async function openDialog() {
  const w = mount(BatchTab, { attachTo: document.body, global: { stubs: STUBS } });
  await flushPromises();
  await w.findAll('button').find(b => b.text().includes('New batch')).trigger('click');
  await flushPromises();
  return w;
}

describe('a batch answered by a workflow', () => {
  beforeEach(() => { sent.length = 0; state.workflows = []; state.refuse = null; state.may = { start: true }; document.body.innerHTML = ''; });

  it('where model batches are off, New batch still opens, "A model" is off with the reason, and a workflow can start', async () => {
    state.workflows = [{ id: 12, name: 'Desk check', version: 3 }];
    state.may = { start: true, models: false, models_reason: 'Batches run only where models are tried at no cost of their own.' };
    const w = await openDialog();
    expect(document.body.textContent).toContain('A workflow can still answer a batch');
    const model = w.find('[data-test="bt-by-model"]');
    expect(model.attributes('disabled')).toBeDefined();
    expect(w.find('#bt-by-model-help').text()).toContain('no cost of their own');
    expect(w.find('[data-test="bt-by-workflow"]').element.checked).toBe(true);
    w.unmount();
  });

  it('names the workflow and its version where a model name is shown', async () => {
    const w = mount(BatchTab, { attachTo: document.body, global: { stubs: STUBS } });
    await flushPromises();
    expect(w.find('.bt-what').text()).toContain('Workflow: Desk check v3');
    w.unmount();
  });

  it('a project with no model starts on "A workflow", and posts the workflow without a model', async () => {
    state.workflows = [{ id: 12, name: 'Desk check', version: 3 }, { id: 14, name: 'Door count', version: 1 }];
    const w = await openDialog();
    expect(w.find('[data-test="bt-by-workflow"]').element.checked).toBe(true);
    const select = w.find('[data-test="bt-workflow"]');
    expect(select.findAll('option').map(o => o.text())).toEqual(['Choose a workflow', 'Desk check v3', 'Door count v1']);
    await select.setValue('14');
    expect(w.find('.bt-summary').text()).toContain('The workflow Door count v1 will look at all 40 photos of Office');
    expect(w.find('.bt-summary').text()).not.toContain('Try page');
    await w.find('form.bt-form').trigger('submit');
    await flushPromises();
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({ project: 'p1', workflow: 14, source: 'all' });
    expect(sent[0].body).not.toHaveProperty('model');
    w.unmount();
  });

  it('shows the server\'s refusal of the workflow at its field, and a balance refusal above the buttons', async () => {
    state.workflows = [{ id: 12, name: 'Desk check', version: 3 }];
    state.refuse = Object.assign(new Error('This workflow is paused.'), { status: 400, field: 'workflow', serverCode: 'not_startable' });
    let w = await openDialog();
    await w.find('form.bt-form').trigger('submit');
    await flushPromises();
    expect(w.find('#bt-workflow-error').text()).toBe('This workflow is paused.');
    expect(w.find('[data-test="bt-workflow"]').attributes('aria-invalid')).toBe('true');
    w.unmount();
    state.refuse = Object.assign(new Error('Your balance does not cover the first 10 photos.'), { status: 402 });
    w = await openDialog();
    await w.find('form.bt-form').trigger('submit');
    await flushPromises();
    expect(w.find('.bt-actions').element.previousElementSibling.textContent).toBe('Your balance does not cover the first 10 photos.');
    w.unmount();
  });

  it('with no workflow to choose, "A workflow" is off, says how to make one, and the model is the answer', async () => {
    const w = await openDialog();
    expect(w.find('[data-test="bt-by-workflow"]').attributes('disabled')).toBeDefined();
    expect(w.find('#bt-by-workflow-help').text()).toContain('starts with "Each camera frame", then publish it');
    const link = w.find('[data-test="bt-no-workflow"] a');
    expect(link.attributes('href')).toBe('/dashboard/workflow-builder');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(w.find('#bt-why').text()).toContain('Office has no trained model yet. Choose a workflow instead');
    w.unmount();
  });
});
