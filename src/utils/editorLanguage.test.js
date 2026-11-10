// The editor's language comes from Monaco's own list (ADM-1200): Go, Rust, Dockerfile and the rest were plain text.
// The entries below are copied from monaco-editor 0.57.0's `languages/definitions/*/register.js`, in the shape
// `monaco.languages.getLanguages()` returns (Monaco itself does not load under Node).
import { describe, it, expect } from 'vitest'
import { languageFor } from './editorLanguage'

const langs = [
  { id: 'go', extensions: ['.go'] },
  { id: 'rust', extensions: ['.rs', '.rlib'] },
  { id: 'dockerfile', extensions: ['.dockerfile'], filenames: ['Dockerfile'] },
  { id: 'hcl', extensions: ['.tf', '.tfvars', '.hcl'] },
  { id: 'c', extensions: ['.c', '.h'] },
  { id: 'cpp', extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'] },
  { id: 'csharp', extensions: ['.cs', '.csx', '.cake'] },
  { id: 'powershell', extensions: ['.ps1', '.psm1', '.psd1'] },
  { id: 'graphql', extensions: ['.graphql', '.gql'] },
  { id: 'python', extensions: ['.py', '.rpy', '.pyw', '.cpy', '.gyp', '.gypi'] },
  { id: 'typescript', extensions: ['.ts', '.tsx', '.cts', '.mts'] },
  { id: 'markdown', extensions: ['.md', '.markdown'] },
  { id: 'html', extensions: ['.html', '.htm'] },
  { id: 'plaintext', extensions: ['.txt'] },
]

describe('languageFor', () => {
  it('uses Monaco for every language it knows', () => {
    const cases = {
      'cmd/main.go': 'go', 'src/lib.rs': 'rust', 'a.c': 'c', 'a.cpp': 'cpp', 'Program.cs': 'csharp',
      'Dockerfile': 'dockerfile', 'build/app.dockerfile': 'dockerfile', 'main.tf': 'hcl', 'setup.py': 'python',
      'x.ts': 'typescript', 'README.md': 'markdown', 'q.graphql': 'graphql', 'deploy.ps1': 'powershell',
    }
    for (const [path, want] of Object.entries(cases)) expect(languageFor(path, langs), path).toBe(want)
  })

  it('keeps a .vue file as HTML (Monaco has no Vue grammar) and an unknown file as plain text', () => {
    expect(languageFor('src/App.vue', langs)).toBe('html')
    expect(languageFor('notes.unknownext', langs)).toBe('plaintext')
    expect(languageFor('LICENSE', langs)).toBe('plaintext')
  })

  it('matches a file-name pattern', () => {
    expect(languageFor('ci/build.Jenkinsfile', [{ id: 'groovy', extensions: [], filenamePatterns: ['*.Jenkinsfile'] }]))
      .toBe('groovy')
  })

  it('answers the common files before Monaco has loaded', () => {
    expect(languageFor('a/b.py', null)).toBe('python')
    expect(languageFor('x.tsx', null)).toBe('typescript')
    expect(languageFor('main.go', null)).toBe('plaintext')
  })
})
