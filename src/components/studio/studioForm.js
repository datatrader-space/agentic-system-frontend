import { inject, ref } from 'vue'
import { useChatStore } from '../../stores/useChatStore'

// When to try again after a 429: the backend's retry_after, in seconds, said in words.
export function retryText(seconds) {
  const n = Math.ceil(Number(seconds))
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 60) return `Try again in ${n} second${n === 1 ? '' : 's'}.`
  const m = Math.ceil(n / 60)
  return `Try again in ${m} minute${m === 1 ? '' : 's'}.`
}

// Every Studio error is {code, message, field, retry_after?}. The model the person chose is named 'model', 'model_id'
// or 'route_id' by the backend; a form shows it at its own model menu (`aliases`), and a field the form does not have
// ('request', 'page', ...) as a general message, without a field name in front of it.
export function studioError(error, fields = [], aliases = {}) {
  if (!error) return null
  const raw = String(error.field || '').replace(/^request\./, '')
  const field = aliases[raw] || raw
  const retry = error.retry_after != null ? retryText(error.retry_after) : ''
  const message = [error.message || 'The request failed. Try again.', retry].filter(Boolean).join(' ')
  return { ...error, message, field: fields.includes(field) ? field : '' }
}

export const MODEL_FIELDS = ['model', 'model_id', 'route_id']
export const modelAliases = target => Object.fromEntries(MODEL_FIELDS.map(name => [name, target]))

// A Manual page sends no chat message, so each request it makes carries the open chat and the page it came from
// (with the preset chosen there): its results stay in the chat, and Recent chats names the chat after the page.
export function useStudioChat(page) {
  const chat = useChatStore()
  const look = inject('studioPreparedLook', ref(null))
  function studioContext() {
    const ctx = chat.studioContext || {}
    const hasPreset = Object.prototype.hasOwnProperty.call(ctx, 'preset')
    return {
      page: ctx.page || page(),
      preset: hasPreset ? ctx.preset || '' : look.value?.id || '',
      preset_title: hasPreset ? ctx.preset_title || '' : look.value?.title || '',
    }
  }
  async function chatFields() {
    const cid = await chat.ensureConversation()
    if (!cid) throw new Error('Could not start this Studio session. Try again.')
    return { conversation_id: cid, studio_context: studioContext() }
  }
  return { chat, chatFields, studioContext }
}
