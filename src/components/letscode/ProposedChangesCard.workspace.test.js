// @vitest-environment jsdom
// Coding Agent Runtime: the card surfaces WorkspaceChangeProposal truth the git diff can't show.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProposedChangesCard from './ProposedChangesCard.vue'

const TASK = {
  diff_text: 'diff --git a/notes.txt b/notes.txt\n@@ -0,0 +1 @@\n+hi\n',
  diff_summary: {
    files_changed: 2, additions: 1, deletions: 0,
    proposal: {
      items: [
        { path: 'notes.txt', content_display: 'diff', ignored: false, protected: false, verified: true },
        { path: '.env', content_display: 'redacted', ignored: true, protected: true, verified: true },
      ],
      warnings: ['1 file(s) are gitignored — local-only, not part of the Git diff or commit.'],
    },
  },
}

describe('ProposedChangesCard — workspace truth', () => {
  it('lists local-only/protected files the git diff cannot show, with badges + warning', () => {
    const w = mount(ProposedChangesCard, { props: { task: TASK } })
    const text = w.text()
    expect(text).toContain('.env')                       // surfaced even though not in the diff
    expect(text).toContain('local-only')
    expect(text).toContain('protected')
    expect(text).toContain('values hidden')              // redacted secret values
    expect(text).toContain('gitignored')                 // the warning
    // notes.txt is shown as a normal diff, NOT in the workspace-extras list
    expect(text).not.toContain('notes.txt local-only')
  })

  it('renders nothing extra when there is no proposal', () => {
    const w = mount(ProposedChangesCard, {
      props: { task: { diff_text: 'diff --git a/x b/x\n@@ -0,0 +1 @@\n+y\n', diff_summary: { files_changed: 1 } } },
    })
    expect(w.text()).not.toContain('Local-only / workspace changes')
  })
})
