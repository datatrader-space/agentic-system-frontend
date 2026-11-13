// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AssistantChat from '../../training-data/src/components/AssistantChat.vue';
import AutoLabelAgent from '../../training-data/src/components/AutoLabelAgent.vue';
import LabelingWorkflow from '../../training-data/src/components/LabelingWorkflow.vue';
import { assistantChat } from '../../training-data/src/api/assistantChat.js';
import { workspaceApi } from '../../training-data/src/api/workspace.js';
import { labelingWorkflows } from '../../training-data/src/api/labelingWorkflows.js';
vi.mock('../../training-data/src/api/assistantChat.js', async original => ({ ...(await original()), assistantChat: {
  connect: vi.fn(), start: vi.fn(), rename: vi.fn(), upload: vi.fn(),
} }));
vi.mock('../../training-data/src/api/workspace.js', () => ({ workspaceApi: { assistant: vi.fn() } }));
vi.mock('../../training-data/src/api/labelingWorkflows.js', () => ({ labelingWorkflows: { list: vi.fn(), save: vi.fn(), use: vi.fn() } }));
const connection = { close: vi.fn(), sendMessage: vi.fn(), setConversation: vi.fn(), sendHitlResponse: vi.fn() };
let events;
const wrappers = [];
const render = (component, props) => { const wrapper = mount(component, { props, global: { stubs: { UiDialog: { props: ['open'], template: '<div v-if="open"><slot/></div>' } } } }); wrappers.push(wrapper); return wrapper; };
const button = (wrapper, text) => wrapper.findAll('button').find(b => b.text().trim() === text);
beforeEach(() => {
  vi.clearAllMocks();
  assistantChat.connect.mockImplementation((id, handlers) => { events = handlers; return connection; });
  assistantChat.start.mockResolvedValue({ conversation_id: 7 }); assistantChat.rename.mockResolvedValue({});
  workspaceApi.assistant.mockResolvedValue({ agent_id: 2 });
  labelingWorkflows.list.mockResolvedValue({ workflows: [] });
});
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));

test('chat opens without sending, suggestions only fill the composer, and explicit sends include visible context', async () => {
  const context = '{"project":"~901","configuration":{"classes":[{"name":"helmet"}]}}';
  const wrapper = render(AutoLabelAgent, { context }); await flushPromises();
  expect(assistantChat.start).not.toHaveBeenCalled(); expect(connection.sendMessage).not.toHaveBeenCalled();
  await button(wrapper, 'Save a reusable labeling workflow').trigger('click'); await flushPromises();
  expect(wrapper.get('textarea').element.value).toBe('Save a reusable labeling workflow');
  expect(connection.sendMessage).not.toHaveBeenCalled();
  expect(wrapper.get('.auto-agent-context').text()).toContain(context);
  await wrapper.get('form.composer').trigger('submit'); await flushPromises();
  expect(connection.sendMessage).toHaveBeenCalledWith(expect.stringContaining(context), 2, null, { attachmentIds: [] });
  expect(connection.sendMessage.mock.calls[0][0]).toContain('User request:\nSave a reusable labeling workflow');
  expect(assistantChat.upload).not.toHaveBeenCalled();
});

test('default chat transport is unchanged and approvals require a separate explicit response', async () => {
  const wrapper = render(AssistantChat, { agentId: 2 });
  await wrapper.get('textarea').setValue('Save my workflow'); await wrapper.get('form.composer').trigger('submit'); await flushPromises();
  expect(connection.sendMessage).toHaveBeenCalledWith('Save my workflow', 2, null, { attachmentIds: [] });
  events.onEvent({ type: 'hitl_request', request_id: 'approval-1', conversation_id: 7, payload: { kind: 'tool_approval', tool_name: 'TRAINING_LABEL_WORKFLOW_SAVE' } });
  await flushPromises();
  expect(wrapper.find('.approval').exists()).toBe(true); expect(connection.sendHitlResponse).not.toHaveBeenCalled();
  await button(wrapper, 'Approve').trigger('click');
  expect(connection.sendHitlResponse).toHaveBeenCalledWith('approval-1', true);
  events.onEvent({ type: 'agent_session_complete' }); await flushPromises();
  expect(wrapper.emitted('settled')).toHaveLength(1);
});

const definition = { schema: 'aadml.labeling-workflow.v1', source: 'vision:fixture', where: '', classes: [{ name: 'helmet', color: '#123456', description: 'Protective headwear' }] };
test('workflow save persists current settings and applying requires confirmation without inference', async () => {
  const row = { id: 'workflow-1', name: 'Safety gear', definition, revision: 1 };
  labelingWorkflows.save.mockResolvedValue(row);
  labelingWorkflows.use.mockResolvedValue({ workflow: row, classes: [], started: false });
  const wrapper = render(LabelingWorkflow, { project: '~901', definition, canSave: true }); await flushPromises();
  await wrapper.get('input').setValue(row.name);
  await button(wrapper, 'Save current settings').trigger('click'); await flushPromises();
  expect(labelingWorkflows.save).toHaveBeenCalledWith('~901', row.name, definition, undefined);
  expect(wrapper.get('.workflow-state').text()).toContain('Saved · current configuration');
  await button(wrapper, 'Use this workflow').trigger('click');
  expect(labelingWorkflows.use).not.toHaveBeenCalled();
  await button(wrapper, 'Apply workflow').trigger('click'); await flushPromises();
  expect(labelingWorkflows.use).toHaveBeenCalledWith('~901', row);
  expect(wrapper.emitted('apply')[0][0].started).toBe(false);
});

test('a failed save never claims saved and a stale use does not emit configuration changes', async () => {
  labelingWorkflows.save.mockRejectedValue(new Error('Revision conflict'));
  const wrapper = render(LabelingWorkflow, { project: '~901', definition, canSave: true }); await flushPromises();
  await wrapper.get('input').setValue('New workflow'); await button(wrapper, 'Save current settings').trigger('click'); await flushPromises();
  expect(wrapper.get('.workflow-state').text()).toBe('Not saved');
  expect(wrapper.find('[role="alert"]').text()).toContain('Revision conflict');
  const row = { id: 'workflow-1', name: 'Safety gear', definition, revision: 1 };
  labelingWorkflows.list.mockResolvedValue({ workflows: [row] });
  labelingWorkflows.use.mockRejectedValue(new Error('Reload this workflow'));
  await button(wrapper, 'Refresh').trigger('click'); await flushPromises(); await wrapper.get('select').setValue(row.id);
  await button(wrapper, 'Use this workflow').trigger('click'); await button(wrapper, 'Apply workflow').trigger('click'); await flushPromises();
  expect(wrapper.emitted('apply')).toBeUndefined();
});
