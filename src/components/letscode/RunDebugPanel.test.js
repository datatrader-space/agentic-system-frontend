// @vitest-environment jsdom
// Run and Debug and the Debug Console (ADM-1205 phase F item 17): what to run and Start; the controls while paused;
// Variables opening on demand, Watch, Call stack and Breakpoints (edited in place, no browser dialog); the console's
// output and an expression evaluated.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import RunDebugPanel from './RunDebugPanel.vue'
import DebugConsole from './DebugConsole.vue'
import { DEBUGGER } from '@/stores/useDebugger'

function store(over = {}) {
  const state = ref('idle')
  const breakpointList = ref([{ path: 'calc.py', line: 4, condition: '', hitCondition: '', logMessage: '', verified: false }])
  return {
    state, error: ref(''), adapterState: ref(''), running: computed(() => ['starting', 'running', 'paused'].includes(state.value)),
    configs: ref([{ id: 'file', label: 'Python: calc.py' }, { id: 'npm:dev', label: 'npm run dev' }]), selectedConfig: ref('file'),
    frames: ref([]), selectedFrame: ref(null), scopes: ref([]), watches: ref([]), consoleLines: ref([]), breakpointList,
    start: vi.fn(), stop: vi.fn(), restart: vi.fn(), step: vi.fn(), loadConfigs: vi.fn(), selectFrame: vi.fn(), expand: vi.fn(),
    addWatch: vi.fn(), removeWatch: vi.fn(), repl: vi.fn(), open: vi.fn(), toggleBreakpoint: vi.fn(), updateBreakpoint: vi.fn(),
    ...over,
  }
}
const mountWith = (C, s) => mount(C, { global: { provide: { [DEBUGGER]: s }, stubs: { Icon: true } } })

describe('RunDebugPanel', () => {
  it('chooses what to run and starts it', async () => {
    const s = store()
    const w = mountWith(RunDebugPanel, s)
    expect(w.findAll('option').map((o) => o.text())).toEqual(['Python: calc.py', 'npm run dev'])
    expect(w.find('[role="toolbar"]').exists()).toBe(false)
    expect(w.text()).toContain('Not running.')
    await w.find('.rd-go').trigger('click')
    expect(s.start).toHaveBeenCalled()
  })

  it('while paused: the controls, where it stopped, variables opened on demand, the stack', async () => {
    const locals = { name: 'Locals', ref: 21, open: true, children: [{ name: 'prices', value: '[3, 4, 5]', type: 'list', ref: 31, open: false, children: null }] }
    const f = { id: 11, name: 'total', path: 'calc.py', line: 4 }
    const s = store({ scopes: ref([locals]), frames: ref([f, { id: 12, name: '<module>', path: null, source: 'runpy.py', line: 9 }]), selectedFrame: ref(f) })
    s.state.value = 'paused'
    const w = mountWith(RunDebugPanel, s)
    expect(w.text()).toContain('Paused in total at line 4.')
    const buttons = w.findAll('[role="toolbar"] button').map((b) => b.attributes('aria-label'))
    expect(buttons).toEqual(['Continue', 'Step over', 'Step into', 'Step out', 'Restart', 'Stop'])
    await w.find('[aria-label="Step over"]').trigger('click')
    expect(s.step).toHaveBeenCalledWith('next')
    expect(w.findAll('.rd-var').map((r) => r.text())).toEqual(['Locals', 'prices=[3, 4, 5]'])
    await w.find('[aria-label="Open prices"]').trigger('click')
    expect(s.expand).toHaveBeenCalledWith(locals.children[0])
    const frames = w.findAll('.rd-frame')
    expect(frames.map((x) => x.text())).toEqual(['totalcalc.py:4', '<module>runpy.py:9'])
    expect(frames[0].classes()).toContain('on')
    expect(frames[1].classes()).toContain('ext')
  })

  it('a breakpoint is edited in place and saved; one the debugger could not set says so', async () => {
    const s = store()
    const w = mountWith(RunDebugPanel, s)
    expect(w.text()).toContain('The debugger could not set this breakpoint.')
    await w.find('[aria-label="Edit the breakpoint at calc.py line 4"]').trigger('click')
    await w.find('input[name="condition"]').setValue('p > 2 ')
    await w.find('input[name="logMessage"]').setValue('p={p}')
    await w.find('.rd-bp-edit').trigger('submit')
    expect(s.updateBreakpoint).toHaveBeenCalledWith('calc.py', 4, { condition: 'p > 2', hitCondition: '', logMessage: 'p={p}' })
    expect(w.find('.rd-bp-edit').exists()).toBe(false)
    await w.find('[aria-label="Remove the breakpoint at calc.py line 4"]').trigger('click')
    expect(s.toggleBreakpoint).toHaveBeenCalledWith('calc.py', 4)
  })

  it('adds a watch', async () => {
    const s = store()
    const w = mountWith(RunDebugPanel, s)
    await w.find('#rd-watch-in').setValue('sum(prices)')
    await w.find('.rd-add').trigger('submit')
    expect(s.addWatch).toHaveBeenCalledWith('sum(prices)')
  })
})

describe('DebugConsole', () => {
  it('shows the output and evaluates an expression only while paused', async () => {
    const s = store({ consoleLines: ref([{ kind: 'out', text: 'hello' }, { kind: 'err', text: 'boom' }]) })
    const w = mountWith(DebugConsole, s)
    expect(w.findAll('.dc-ln').map((l) => [l.classes()[1], l.text()])).toEqual([['out', 'hello'], ['err', 'boom']])
    expect(w.find('input').attributes('disabled')).toBeDefined()
    s.state.value = 'paused'
    await w.vm.$nextTick()
    await w.find('input').setValue('p * 4')
    await w.find('form').trigger('submit')
    expect(s.repl).toHaveBeenCalledWith('p * 4')
    expect(w.find('input').element.value).toBe('')
  })
})
