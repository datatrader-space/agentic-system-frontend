import { onBeforeUnmount, ref } from 'vue'
import api from '../services/api'
import { useChatStore } from '../stores/useChatStore'

// A file a Studio page works on goes into the page's own Studio chat (started the moment the first file is added),
// so it appears in the Library and the job can name it by attachment_id. Nothing is sent to the agent.
export function useStudioUpload() {
  const chat = useChatStore(), uploading = ref(0), error = ref('')
  const previews = []
  onBeforeUnmount(() => { for (const url of previews) URL.revokeObjectURL?.(url) })
  async function upload(file) {
    error.value = ''
    uploading.value++
    try {
      const cid = await chat.ensureConversation()
      if (!cid) throw new Error('Could not start this Studio session.')
      const { data } = await api.uploadConversationFile(cid, file)
      if (!data?.attachment_id) throw new Error('The upload was not saved.')
      const url = URL.createObjectURL?.(file) || ''
      if (url) previews.push(url)
      const kind = String(file.type || '').split('/')[0]
      return { attachment_id: data.attachment_id, name: file.name, media_type: kind, url, thumbnail_url: kind === 'image' ? url : '' }
    } catch (e) {
      error.value = `${file.name}: ${e.response?.data?.error?.message || e.message || 'the upload failed'}.`
      return null
    } finally { uploading.value-- }
  }
  return { upload, uploading, error }
}
