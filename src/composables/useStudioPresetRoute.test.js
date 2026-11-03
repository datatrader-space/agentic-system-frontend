// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ route: { path: '/video-studio/video', query: { conversation: 'owned-chat', mode: 'manual' } }, replace: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => state.route, useRouter: () => ({ replace: state.replace }) }))
import { useStudioPresetRoute } from './useStudioPresetRoute'
it('changes only the selected look and mode while preserving the current conversation', () => {
  const select = useStudioPresetRoute()
  select('video-look-1', 'agent')
  expect(state.replace).toHaveBeenLastCalledWith({ path: '/video-studio/video', query: { conversation: 'owned-chat', preset: 'video-look-1', mode: 'agent' } })
  select(null)
  expect(state.replace).toHaveBeenLastCalledWith({ path: '/video-studio/video', query: { conversation: 'owned-chat', preset: undefined, mode: 'manual' } })
})
