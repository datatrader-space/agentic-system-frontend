// @vitest-environment jsdom
// A stream answered by a workflow (VISION_WORKFLOWS_PLAN.md 5.2, ADM-1351 phase 2): "A workflow" in the New stream
// dialog lists the published frame workflows the server offers (options.workflows) and posts the chosen one with the
// project, never a model; the server's refusal of the workflow is shown next to its field; with none, the dialog says
// how to make one and links to the Workflow Builder. A stream row names its workflow where a model's name is shown.
import { mount, flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const started = [];
const state = { workflows: [], refuse: null };
const ROW = { id: 31, state: 'running', model: null, detector: null, find: [], read_codes: false,
  workflow: { id: 12, name: 'Desk watch', version: 3 }, project: { ref: 'p1', name: 'Office' }, source: 'Desk camera',
  source_kind: 'saved', source_kind_label: 'Saved camera', fps: 1, frames: 4, frames_failed: 0, max_frames: 600,
  video_seconds: 4, continuous: false, has_results: true, may: { stop: true },
  last: { frame: 3, t: 3, objects: [{ class: 'person', score: 0.9, box: [0.1, 0.1, 0.2, 0.3] }], classes: { person: 1 } } };
function listPage() {
  return {
    streams: [ROW], may: { start: true }, terms: { accepted: true },
    options: { projects: [{ ref: 'p1', name: 'Office', models: [{ number: 1, name: 'walls', version: '1.0.0' }] }],
      fps: [1, 2], default_fps: 1, cap: { seconds: 600 }, upload: { bytes: 100 * 1024 * 1024, extensions: ['mp4'] },
      workflows: state.workflows },
  };
}
vi.mock('../../../training-data/src/api/streaming.js', async (real) => {
  const actual = await real();
  return {
    ...actual,
    streamingApi: {
      ...actual.streamingApi,
      list: vi.fn(async () => listPage()),
      get: vi.fn(async id => ({ stream: { ...ROW, id } })),
      start: vi.fn(async args => {
        started.push(args);
        if (state.refuse) throw state.refuse;
        return { ...listPage(), said: 'The stream of the workflow Desk watch (version 3) is queued.', stream: ROW };
      }),
    },
  };
});
import StreamingTab from '../../../training-data/src/components/StreamingTab.vue';

const STUBS = {
  VideoSources: { template: '<div class="vs-stub"/>', methods: { load() {}, openAdd() {} } },
  CameraEvents: true, WorkplaceTab: true, CameraRecordings: true, StreamingTermsDialog: true, DeploymentHeader: true,
  DeploymentToolbar: { template: '<div class="tb"><slot/></div>' },
  UiDialog: { props: ['open', 'title'], template: '<div v-if="open" class="dlg" :data-title="title"><slot/></div>' },
};
async function openDialog() {
  const w = mount(StreamingTab, { attachTo: document.body, global: { stubs: STUBS } });
  await flushPromises();
  await w.findAll('button').find(b => b.text().includes('New stream')).trigger('click');
  await flushPromises();
  return w;
}
const card = w => w.find('[data-test="st-use-workflow"]');

describe('a stream answered by a workflow', () => {
  beforeEach(() => { started.length = 0; state.workflows = []; state.refuse = null; document.body.innerHTML = ''; });

  it('names the workflow and its version where a model name is shown, with its counts', async () => {
    const w = mount(StreamingTab, { attachTo: document.body, global: { stubs: STUBS } });
    await flushPromises();
    expect(w.find('td[data-label="Project and model"]').text()).toContain('Workflow: Desk watch v3');
    expect(w.find('.st-found').text()).toBe('Newest: person 1');
    w.unmount();
  });

  it('lists the published frame workflows and posts the chosen one with the project, never the model', async () => {
    state.workflows = [{ id: 12, name: 'Desk watch', version: 3 }, { id: 14, name: 'Door count', version: 1 }];
    const w = await openDialog();
    expect(card(w).attributes('disabled')).toBeUndefined();
    await card(w).setValue(true);
    const select = w.find('[data-test="st-workflow"]');
    expect(select.findAll('option').map(o => o.text())).toEqual(['Choose a workflow', 'Desk watch v3', 'Door count v1']);
    await select.setValue('14');
    // Choosing the workflow turns the model off: one of the four answers each frame.
    expect(w.find('#st-model').attributes('disabled')).toBeDefined();
    await w.find('form.st-form').trigger('submit');
    await flushPromises();
    expect(started).toHaveLength(0);                            // no video chosen yet: the dialog says so first
    await w.findAll('button[role="radio"]').find(b => b.text().includes('Stream address')).trigger('click');
    await w.find('#st-address').setValue('rtsp://cam.example.com/live');
    await w.find('form.st-form').trigger('submit');
    await flushPromises();
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ project: 'p1', model: null, workflow: '14', detector: '', find: '', address: 'rtsp://cam.example.com/live' });
    w.unmount();
  });

  it('shows the server\'s refusal of the workflow next to its field', async () => {
    state.workflows = [{ id: 12, name: 'Desk watch', version: 3 }];
    state.refuse = Object.assign(new Error('Find objects (find) cannot run on a frame.'), { status: 400, field: 'workflow', code: 'frame.step_not_allowed' });
    const w = await openDialog();
    await card(w).setValue(true);
    await w.findAll('button[role="radio"]').find(b => b.text().includes('Stream address')).trigger('click');
    await w.find('#st-address').setValue('rtsp://cam.example.com/live');
    await w.find('form.st-form').trigger('submit');
    await flushPromises();
    expect(w.find('#st-workflow-error').text()).toBe('Find objects (find) cannot run on a frame.');
    expect(w.find('[data-test="st-workflow"]').attributes('aria-invalid')).toBe('true');
    w.unmount();
  });

  it('a row says what is of its annotated video, and the open stream shows it (ADM-1351 phase 3)', async () => {
    const saved = ROW.annotated_video;
    ROW.annotated_video = { state: 'making', frames: 0, error: '' };
    const w = mount(StreamingTab, { attachTo: document.body, global: { stubs: STUBS } });
    await flushPromises();
    expect(w.find('[data-test="st-row-video"]').text()).toBe('Making the annotated video…');
    await w.findAll('button').find(b => b.text() === 'Open').trigger('click');
    await flushPromises();
    expect(w.find('#st-view [data-test="annotated-video"]').text()).toContain('Making the annotated video…');
    ROW.annotated_video = saved;
    w.unmount();
  });

  it('with no frame workflow, the card cannot be chosen and says how to make one, with a link to the builder', async () => {
    const w = await openDialog();
    expect(card(w).attributes('disabled')).toBeDefined();
    expect(w.find('#st-workflow-help').text()).toContain('starts with "Each camera frame", then publish it');
    const link = w.find('[data-test="st-no-workflow"] a');
    expect(link.attributes('href')).toBe('/dashboard/workflow-builder');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
    expect(link.text()).toContain('Open the Workflow Builder');
    w.unmount();
  });
});
