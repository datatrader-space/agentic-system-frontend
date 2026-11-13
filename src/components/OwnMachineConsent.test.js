// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ProjectSettings from '../../training-data/src/components/ProjectSettings.vue';
import ProjectCreate from '../../training-data/src/components/ProjectCreate.vue';
import * as api from '../../training-data/src/api/training.js';

vi.mock('../../training-data/src/api/training.js', async importOriginal => ({
  ...await importOriginal(), getDataUse: vi.fn(), saveDataUse: vi.fn(),
}));
const project = { ref: '~1', name: 'Synthetic walls', rights: ['manage'], family: 'vision' };
let values;
const wrappers = [];
const render = (component, props) => {
  const wrapper = mount(component, { props });
  wrappers.push(wrapper);
  return wrapper;
};
const ownMachine = wrapper => wrapper.findAll('label').find(label => label.text().includes('Also my own machine for training'));
const checkbox = wrapper => ownMachine(wrapper).get('input');
beforeEach(() => {
  vi.clearAllMocks();
  values = { training: 'project', retention_days: null, viewers: 'me', allow_own_machine: false };
  api.getDataUse.mockImplementation(async () => ({ values, version: 1 }));
  api.saveDataUse.mockImplementation(async (_ref, answers) => {
    values = { ...answers, retention_days: null };
    return { values, version: 2 };
  });
});
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  vi.restoreAllMocks();
});

test('owner can opt in, save, reload and revoke own-machine consent', async () => {
  let wrapper = render(ProjectSettings, { project });
  await flushPromises();
  expect(checkbox(wrapper).element.disabled).toBe(false);
  expect(checkbox(wrapper).element.checked).toBe(false);
  expect(ownMachine(wrapper).text()).not.toContain('Coming soon');
  await checkbox(wrapper).setValue(true);
  // Consent still needs the existing deletion-rule confirmation before saving.
  expect(wrapper.get('.settings-actions button').element.disabled).toBe(true);
  await wrapper.get('.check-line input').setValue(true);
  await wrapper.get('form.settings-policy').trigger('submit');
  await flushPromises();
  expect(api.saveDataUse).toHaveBeenLastCalledWith('~1', expect.objectContaining({ allow_own_machine: true, allow_aws: false }));
  wrapper.unmount();
  wrapper = render(ProjectSettings, { project });
  await flushPromises();
  expect(checkbox(wrapper).element.checked).toBe(true);
  await checkbox(wrapper).setValue(false);
  await wrapper.get('.check-line input').setValue(true);
  await wrapper.get('form.settings-policy').trigger('submit');
  await flushPromises();
  expect(api.saveDataUse).toHaveBeenLastCalledWith('~1', expect.objectContaining({ allow_own_machine: false }));
});

test('non-owners cannot see or change data-use answers', async () => {
  const wrapper = render(ProjectSettings, { project: { ...project, rights: ['view'] } });
  await flushPromises();
  expect(ownMachine(wrapper)).toBeUndefined();
  expect(api.getDataUse).not.toHaveBeenCalled();
  expect(api.saveDataUse).not.toHaveBeenCalled();
});

test('project creation offers own-machine opt-in, initially unchecked', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const wrapper = render(ProjectCreate, { submit: vi.fn() });
  await wrapper.get('#new-project-name').setValue('Synthetic walls');
  await wrapper.get('textarea').setValue('Find synthetic walls');
  await wrapper.findAll('button').find(button => button.text().includes('Continue to data policy')).trigger('click');
  expect(checkbox(wrapper).element.disabled).toBe(false);
  expect(checkbox(wrapper).element.checked).toBe(false);
  expect(ownMachine(wrapper).text()).not.toContain('Coming soon');
  await checkbox(wrapper).setValue(true);
  await wrapper.get('.check-line input').setValue(true);
  await wrapper.findAll('button').find(button => button.text().includes('Review project')).trigger('click');
  expect(wrapper.get('.review-layout').text()).toContain('my own machine');
});
