// Which shell the agent editor is mounted in, for the steps inside it.
//
// The editor lives at /dashboard/agents/… AND at /admin-dashboard/agents/… (one editor, no fork). Its
// steps used to push every link to /dashboard/…, so an admin editing a built-in agent was thrown out of
// the admin shell by any link in a step — and out of the agent they were editing.
//
// Two kinds of link, two answers:
//   • an agent's OWN pages (guardrails, monitor) exist in both shells      → stay in the shell (agentPage)
//   • pages that exist only in the user dashboard (Knowledge, Tools, the
//     vault, budgets, settings, the docs)                                  → from the admin shell they
//     open in a new tab, so the admin keeps the editor (openUserPage / linkTarget)
//
// The editor provides the shell; a step that is mounted without one (a unit test, another host) behaves
// as it always did, in the user dashboard.
import { computed, inject, provide } from 'vue'

const KEY = Symbol('editorShell')

export function provideEditorShell({ isAdmin, href }) {
  provide(KEY, { isAdmin, href })
}

export function useEditorShell() {
  const shell = inject(KEY, null)
  const isAdmin = computed(() => !!shell?.isAdmin?.value)
  return {
    isAdmin,
    agentPage: (id, page) => `${isAdmin.value ? '/admin-dashboard' : '/dashboard'}/agents/${id}/${page}`,
    // For <RouterLink :target>: RouterLink leaves a click on a target="_blank" link to the browser.
    linkTarget: computed(() => (isAdmin.value ? '_blank' : undefined)),
    // `go` is the step's own router push; it is only bypassed in the admin shell.
    openUserPage(to, go) {
      if (isAdmin.value) window.open(shell.href(to), '_blank', 'noopener')
      else go(to)
    },
  }
}
