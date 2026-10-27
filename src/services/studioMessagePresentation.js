import { plainText } from '../composables/useChatHistory'
// The page a message came from is sent as its studio_context field. Messages written before that carried it as a
// text prefix; the transcript still hides that prefix and shows the person's actual words. No HTML is created here.
const PREFIX = /^I am on the (?:Image|Video|Enhance) page\. (?:I am using my own idea\.|My chosen preset is [^\n]+\.)\n\n/
// A Manual-mode helper request: the old form names the page in text; the current form starts with the instruction.
const LEGACY_HELPER = /^I am on the (Image|Video|Enhance) page in Manual mode\.\s*(Write|Suggest settings)\b/
const HELPER = /^()(Write an editable creative prompt|Suggest settings only)\b/
function helperRequest(content) {
  if (typeof content !== 'string') return null
  const text = content.replace(PREFIX, '')
  return text.match(LEGACY_HELPER) || text.match(HELPER)
}
export function studioChatName(name, fallback = 'Untitled chat') {
  const text = typeof name === 'string' ? name.trim() : ''
  const page = text.match(/^I am on the (Image|Video|Enhance) page\./)?.[1] || text.match(/^I am on the (Image|Video|Enhance) page in Manual mode\./)?.[1]
  if (!page) return text || fallback
  const preset = text.match(/^I am on the (?:Image|Video|Enhance) page\. My chosen preset is ([^\n]+?)(?:\.?(?:\r?\n|$))/)?.[1]
    || text.match(/(?:^|\n)Preset: (.+?)\. Inputs:/)?.[1]
  const fallbackName = `${page} chat${preset && !['My own idea','Your own idea'].includes(preset) ? ` \u00b7 ${preset}` : ''}`
  if (helperRequest(text) || /^I am on the (?:Image|Video|Enhance) page in Manual mode\./.test(text)) return fallbackName
  const clean = text.replace(/^I am on the (?:Image|Video|Enhance) page\.\s*(?:I am using my own idea\.?|My chosen preset is [^\n]+\.?)(?:\s*\n\s*)?/, '').trim()
  return clean || fallbackName
}
const readable = value => typeof value === 'string' ? plainText(value).replace(/<[^>]*>/g, '').trim() : ''
function helperReply(message, helper) {
  const failed = 'The agent could not help with this request'
  try {
    const reply = JSON.parse(message.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
    if (!reply || typeof reply !== 'object' || Array.isArray(reply) || (reply.question != null && typeof reply.question !== 'string')) return failed
    if (readable(reply.question)) return `The agent asked: ${readable(reply.question)}`
    if (helper[2].startsWith('Write')) return readable(reply.prompt) ? 'Prompt written and added to Creative direction' : failed
    const values = []
    if (typeof reply.model === 'string' || typeof reply.model === 'number') {
      const model = readable(String(reply.model))
      if (model) values.push(`model ${model}`)
    }
    if (readable(reply.shape)) values.push(`shape ${readable(reply.shape)}`)
    if (typeof reply.length === 'number' && Number.isFinite(reply.length) && reply.length > 0) values.push(`${reply.length} seconds`)
    if (Number.isInteger(reply.count) && reply.count > 0) values.push(`${reply.count} image${reply.count === 1 ? '' : 's'}`)
    return values.length ? `Settings suggested: ${values.join(', ')}` : failed
  } catch { return failed }
}
export function presentStudioMessage(message, messages = []) {
  // Classify by the original preceding user turn, never by JSON-looking assistant text alone.
  if (message.role === 'assistant' && typeof message.content === 'string') {
    const index = messages.indexOf(message)
    const previous = index > 0 ? messages.slice(0,index).findLast(m => m.role === 'user') : null
    const request = helperRequest(previous?.content)
    if (request) return { ...message, content: helperReply(message, request) }
  }
  const helper = message.role === 'user' ? helperRequest(message.content) : null
  if (helper) return { ...message, content: helper[2].startsWith('Write') ? 'You asked for a prompt' : 'You asked for settings' }
  if (message.role !== 'user' || typeof message.content !== 'string' || !PREFIX.test(message.content)) return message
  const content = message.content.replace(PREFIX, '')
  return { ...message, content: content || (message.attachments?.length ? 'Use these references.' : 'Use this setup.') }
}

export function prepareStudioEdit(message, text) {
  const prefix = message.role === 'user' && typeof message.content === 'string' ? message.content.match(PREFIX)?.[0] || '' : ''
  return prefix + text
}
