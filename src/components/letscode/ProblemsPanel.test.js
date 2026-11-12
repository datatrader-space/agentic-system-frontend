// @vitest-environment jsdom
// The bottom panel's Problems and References tabs (ADM-1205 phase F item 16): problems grouped by file with their
// counts and the servers' state, Check project, an error said, and a row opening its place.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, reactive, computed } from 'vue'
import ProblemsPanel from './ProblemsPanel.vue'
import { LANGUAGE_SERVERS } from '@/stores/useLanguageServers'

function store(over = {}) {
  const problems = ref([
    { path: 'app/page.tsx', line: 3, column: 5, severity: 'error', message: "Type 'string' is not assignable", code: '2322', source: 'typescript' },
    { path: 'app/page.tsx', line: 9, column: 1, severity: 'warning', message: 'unused', code: '', source: 'typescript' },
    { path: 'main.py', line: 1, column: 1, severity: 'error', message: 'Import "x" could not be resolved', code: '', source: 'python' },
  ])
  return {
    problems, counts: computed(() => ({ errors: 2, warnings: 1 })),
    servers: reactive({ typescript: { state: 'ready', error: '' }, python: { state: 'installing', error: '' } }),
    references: ref({ query: 'total', items: [{ path: 'lib/a.ts', line: 4, column: 2 }], loading: false, error: '' }),
    checking: ref(false), checkError: ref(''), check: vi.fn(), open: vi.fn(), ...over,
  }
}
const mountWith = (s, mode = 'problems') => mount(ProblemsPanel, { props: { mode },
  global: { provide: { [LANGUAGE_SERVERS]: s }, stubs: { Icon: true } } })

describe('ProblemsPanel', () => {
  it('groups problems by file, counts them and says what each server is doing', async () => {
    const s = store()
    const w = mountWith(s)
    expect(w.findAll('.pp-file').map((x) => x.text())).toEqual(['app/page.tsx 2', 'main.py 1'])
    expect(w.text()).toContain('TypeScript: ready')
    expect(w.text()).toContain('Python: installing (first time, about a minute)')
    await w.findAll('.pp-row')[0].trigger('click')
    expect(s.open).toHaveBeenCalledWith(s.problems.value[0])
    await w.find('.pp-btn').trigger('click')
    expect(s.check).toHaveBeenCalled()
  })

  it("says a check's or a server's error, and that there is nothing when there is nothing", () => {
    const s = store({ problems: ref([]), checkError: ref('Install its packages'),
      servers: reactive({ typescript: { state: 'error', error: 'npm ERR! offline' } }) })
    const w = mountWith(s)
    expect(w.findAll('[role="alert"]').map((x) => x.text())).toEqual(['Install its packages', 'npm ERR! offline'])
    expect(w.text()).toContain('No problems.')
  })

  it('lists references, and a click opens the place', async () => {
    const s = store()
    const w = mountWith(s, 'references')
    expect(w.text()).toContain('1 reference to total')
    await w.find('.pp-row').trigger('click')
    expect(s.open).toHaveBeenCalledWith({ path: 'lib/a.ts', line: 4, column: 2 })
  })
})
