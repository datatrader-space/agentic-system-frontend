// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import CameraCapture from '../../training-data/src/components/CameraCapture.vue';
import ProjectCreate from '../../training-data/src/components/ProjectCreate.vue';
import VideoFramesDialog from '../../training-data/src/components/VideoFramesDialog.vue';
import { stageFile, uploadParts } from '../../training-data/src/api/uploads.js';
import { apiFetch } from '../../training-data/src/api/client.js';

vi.mock('../../training-data/src/api/client.js', () => ({ apiFetch: vi.fn() }));
const wrappers = [];
const render = (component, props = {}) => {
  const wrapper = mount(component, { props, global: { stubs: { UiDialog: { template: '<div><slot/></div>' } } } });
  wrappers.push(wrapper); return wrapper;
};
const button = (wrapper, text) => wrapper.findAll('button').find(item => item.text() === text);
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:synthetic'); URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.restoreAllMocks(); });

test('late camera permission is released after the user closes capture', async () => {
  let allow;
  const stop = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => new Promise(resolve => { allow = resolve; })) } });
  const wrapper = render(CameraCapture, { open: false });
  await wrapper.setProps({ open: true });
  await wrapper.setProps({ open: false });
  allow({ getTracks: () => [{ stop }] }); await flushPromises();
  expect(stop).toHaveBeenCalledOnce();
  expect(wrapper.emitted('capture')).toBeUndefined();
});

test('cancel during canvas encoding never queues a photo', async () => {
  let encode;
  const stop = vi.fn();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
  HTMLCanvasElement.prototype.getContext.mockReturnValue({ drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => { encode = callback; });
  const wrapper = render(CameraCapture, { open: false });
  await wrapper.setProps({ open: true }); await flushPromises();
  Object.defineProperties(wrapper.get('video').element, { videoWidth: { value: 100 }, videoHeight: { value: 80 } });
  await button(wrapper, 'Capture photo').trigger('click');
  await button(wrapper, 'Cancel').trigger('click');
  encode(new Blob(['synthetic'], { type: 'image/jpeg' })); await flushPromises();
  expect(wrapper.emitted('capture')).toBeUndefined(); expect(stop).toHaveBeenCalledOnce();
});

test('video selection excludes the ending timestamp and respects the requested range', async () => {
  const wrapper = render(VideoFramesDialog, { file: new File(['test'], 'clip.mp4') });
  const video = wrapper.get('video');
  Object.defineProperty(video.element, 'duration', { value: 10 });
  await video.trigger('loadedmetadata');
  await button(wrapper, 'Manual selection').trigger('click');
  video.element.currentTime = 10; await video.trigger('timeupdate');
  await button(wrapper, 'Add current frame').trigger('click');
  expect(wrapper.findAll('.video-selected button')).toHaveLength(0);
  video.element.currentTime = 3; await video.trigger('timeupdate');
  await button(wrapper, 'Add current frame').trigger('click');
  await button(wrapper, 'Extract 1 frames').trigger('click');
  expect(wrapper.emitted('extract')[0][0]).toEqual({ start: 0, end: 10, interval: 1, timestamps: [3] });
  await wrapper.get('[aria-label="Video start time"]').setValue(4);
  expect(wrapper.findAll('.video-selected button')).toHaveLength(0);
});

test('sampling slider and interval stay synchronized, and blank values cannot extract', async () => {
  const wrapper = render(VideoFramesDialog, { file: new File(['test'], 'clip.mp4') });
  const video = wrapper.get('video');
  Object.defineProperty(video.element, 'duration', { value: 30 });
  await video.trigger('loadedmetadata');
  const slider = wrapper.get('[aria-label="Video sampling rate"]');
  const interval = wrapper.get('[aria-label="Seconds between frames"]');
  await slider.setValue(-1);
  expect(interval.element.valueAsNumber).toBeCloseTo(1 / 30);
  expect(wrapper.get('[aria-label="Estimated image count"]').text()).toBe('901');
  await slider.setValue(0);
  expect(interval.element.valueAsNumber).toBe(1);
  expect(wrapper.get('[aria-label="Estimated image count"]').text()).toBe('31');
  await interval.setValue('');
  expect(button(wrapper, 'Extract 0 frames').element.disabled).toBe(true);
  await slider.setValue(1);
  expect(interval.element.valueAsNumber).toBe(30);
  await button(wrapper, 'Manual selection').trigger('click');
  expect(slider.element.disabled).toBe(true);
  for (const time of [3, 7]) {
    video.element.currentTime = time; await video.trigger('timeupdate');
    await button(wrapper, 'Add current frame').trigger('click');
  }
  await button(wrapper, 'Previous').trigger('click');
  expect(video.element.currentTime).toBe(3);
  await video.trigger('timeupdate');
  await button(wrapper, 'Next').trigger('click');
  expect(video.element.currentTime).toBe(7);
});

test('staged uploads send ordered bounded chunks and cancel failed sessions', async () => {
  const file = new File(['0123456789'], 'dataset.zip');
  const base = '/training-data/app/projects/~1/uploads/';
  apiFetch.mockResolvedValueOnce({ id: 'synthetic', received: 0, chunk_bytes: 8 })
    .mockResolvedValueOnce({ id: 'synthetic', received: 8, chunk_bytes: 8 })
    .mockResolvedValueOnce({ id: 'synthetic', received: 10, chunk_bytes: 8 });
  expect(await stageFile('~1', file)).toBe('synthetic');
  expect(apiFetch.mock.calls[1][0]).toBe(base + 'synthetic/');
  expect(apiFetch.mock.calls[1][1].body.get('offset')).toBe('0');
  expect(apiFetch.mock.calls[1][1].body.get('chunk').size).toBe(8);
  expect(apiFetch.mock.calls[2][1].body.get('offset')).toBe('8');
  expect(apiFetch.mock.calls[2][1].body.get('chunk').size).toBe(2);
  apiFetch.mockResolvedValueOnce({ id: 'failed', received: 0, chunk_bytes: 8 })
    .mockRejectedValueOnce(new Error('network failure')).mockResolvedValueOnce({ cancelled: true });
  await expect(stageFile('~1', file)).rejects.toThrow('network failure');
  expect(apiFetch).toHaveBeenLastCalledWith(base + 'failed/', { method: 'DELETE' });
});

test('large image batches stay bounded and each archive travels alone', () => {
  const files = [{ size: 30_000_000 }, { size: 30_000_000 }, { size: 8_000_000_000, zip: true }, { size: 5 }];
  expect(uploadParts(files)).toEqual(files.map(file => [file]));
});

test('successful creation immediately requests the new project upload page', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const project = { ref: '~901', name: 'Synthetic project' };
  const submit = vi.fn().mockResolvedValue(project);
  const wrapper = mount(ProjectCreate, { props: { submit }, global: {
    provide: { kinds: ref([{ key: 'instance_segmentation', available: true }]) },
    stubs: { UiDialog: { template: '<div><slot/></div>' } },
  } }); wrappers.push(wrapper);
  await wrapper.get('#new-project-name').setValue('Synthetic project');
  await wrapper.get('textarea').setValue('Detect equipment');
  await wrapper.findAll('button').find(item => item.text().includes('Continue to data policy')).trigger('click');
  await wrapper.get('.check-line input').setValue(true);
  await wrapper.findAll('button').find(item => item.text().includes('Review project')).trigger('click');
  await wrapper.findAll('button').find(item => item.text().includes('Create project')).trigger('click');
  await flushPromises();
  expect(submit).toHaveBeenCalledOnce();
  expect(wrapper.emitted('done')).toEqual([['upload', project]]);
});
