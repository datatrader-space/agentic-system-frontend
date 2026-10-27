import { ref } from 'vue'
import { useCreativeForm } from './useCreativeForm'
import { useChatStore } from '../stores/useChatStore'
import { useSessionProject } from './useSessionProject'

// Prepare one paid job in this page's Studio session: the backend answers with a job waiting for the person's
// Generate on its card. When it asks for consent first (a real face or voice), the request is kept and sent again,
// unchanged, once consent is recorded. `post(session)` makes the request; spread `session` (the chat, and the project
// the page's Library files are linked to) into its body.
export function useMediaJob(onJob) {
  const chat = useChatStore()
  const { busy, error, run } = useCreativeForm()
  const consent = ref(null)
  const { session } = useSessionProject()
  function submit(post, names = {}) {
    consent.value = null
    return run(async alive => {
      const cid = await chat.ensureConversation()
      if (!cid) throw new Error('Could not start this Studio session. Try again.')
      try {
        const { data } = await post(session(cid))
        if (alive()) onJob(data)
        return data
      } catch (e) {
        const refusal = e.response?.data?.error
        if (refusal?.code !== 'consent_required') throw e
        if (alive()) consent.value = {
          message: refusal.message,
          files: (refusal.alternatives || []).map(file => ({ ...file, name: names[file.attachment_id] || 'This file' })),
          retry: () => submit(post, names),
        }
      }
    })
  }
  return { busy, error, consent, submit, cancelConsent: () => { consent.value = null } }
}
