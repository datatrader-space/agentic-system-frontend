// @vitest-environment jsdom
// The 3-way merge editor (ADM-1321): base, yours and theirs compared, the result below; each conflict accepted on its
// own, then the result saved and marked resolved in one step. Monaco is a stub here.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/api', () => ({ default: { getMergeSides: vi.fn(), resolveWithContent: vi.fn() } }))
vi.mock('@/composables/useNotify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }))

import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import MergeEditor from './MergeEditor.vue'

const Diff = { props: ['value', 'original'], template: '<div class="diff-stub">{{ original }}|{{ value }}</div>' }
const Editor = { props: ['value'], emits: ['change', 'editorDidMount'], template: '<textarea class="result-stub" :value="value" @input="$emit(\'change\', $event.target.value)" />' }
const RESULT = 'top\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> other\nmiddle\n<<<<<<< HEAD\nm2\n=======\nt2\n>>>>>>> other\n'

const mountEditor = async () => {
  const w = mount(MergeEditor, {
    props: { systemId: 5, repoId: 4, path: 'app.py', editor: Editor, diffEditor: Diff },
    global: { stubs: { Icon: true } },
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getMergeSides.mockResolvedValue({ data: { path: 'app.py', unmerged: true, base: 'base\n', mine: 'mine\n', theirs: 'theirs\n', result: RESULT } })
})

describe('MergeEditor', () => {
  it('compares yours and theirs, or either with the base', async () => {
    const w = await mountEditor()
    expect(api.getMergeSides).toHaveBeenCalledWith(5, 4, 'app.py')
    expect(w.find('.diff-stub').element.textContent).toBe('mine\n|theirs\n')
    await w.find('#mrg-compare').setValue('base-theirs')
    expect(w.find('.diff-stub').element.textContent).toBe('base\n|theirs\n')
    expect(w.find('.mrg-count').text()).toBe('2 conflicts left')
  })

  it('accepts each conflict on its own, and marks resolved only when none is left', async () => {
    api.resolveWithContent.mockResolvedValue({ data: { clean: false, resolved: 'app.py' } })
    const w = await mountEditor()
    const resolve = () => w.findAll('.mrg-btn.primary')[0]
    expect(resolve().attributes('disabled')).toBeDefined()
    await w.find('[aria-label="Theirs for conflict 1"]').trigger('click')
    expect(w.find('.result-stub').element.value).toBe('top\ntheirs\nmiddle\n<<<<<<< HEAD\nm2\n=======\nt2\n>>>>>>> other\n')
    expect(w.find('.mrg-count').text()).toBe('1 conflict left')
    await w.find('[aria-label="Both for conflict 1"]').trigger('click')
    expect(w.find('.result-stub').element.value).toBe('top\ntheirs\nmiddle\nm2\nt2\n')
    expect(resolve().attributes('disabled')).toBeUndefined()
    await resolve().trigger('click')
    await flushPromises()
    expect(api.resolveWithContent).toHaveBeenCalledWith(5, 4, 'app.py', 'top\ntheirs\nmiddle\nm2\nt2\n')
    expect(w.emitted('resolved')[0][0].path).toBe('app.py')
    expect(notify.success).toHaveBeenCalledWith('app.py is resolved')
  })

  it('the person\'s own edit of the result is what is saved; a refusal says why', async () => {
    api.resolveWithContent.mockRejectedValue({ response: { status: 409, data: { error: 'app.py still has conflict markers.' } } })
    const w = await mountEditor()
    await w.find('.result-stub').setValue('written by hand\n')
    expect(w.find('.mrg-count').text()).toBe('No conflicts left')
    await w.findAll('.mrg-btn.primary')[0].trigger('click')
    await flushPromises()
    expect(api.resolveWithContent).toHaveBeenCalledWith(5, 4, 'app.py', 'written by hand\n')
    expect(notify.error).toHaveBeenCalledWith('app.py still has conflict markers.')
    expect(w.emitted('resolved')).toBeUndefined()
  })

  it('a protected file shows no versions; a file with no base cannot be compared with it', async () => {
    api.getMergeSides.mockResolvedValueOnce({ data: { path: '.env', redacted: true } })
    const w = await mountEditor()
    expect(w.text()).toContain('This file holds secrets')
    expect(w.find('.result-stub').exists()).toBe(false)
    api.getMergeSides.mockResolvedValueOnce({ data: { path: 'app.py', unmerged: true, base: null, mine: 'a\n', theirs: 'b\n', result: RESULT } })
    const v = await mountEditor()
    expect(v.find('option[value="base-mine"]').attributes('disabled')).toBeDefined()
    await v.find('[aria-label="Open app.py as text"]').trigger('click')
    expect(v.emitted('open-file')[0]).toEqual(['app.py'])
  })
})
