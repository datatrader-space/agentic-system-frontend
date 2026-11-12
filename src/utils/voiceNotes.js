// Voice notes (backend agentic-docs/VOICE_NOTES_PLAN.md): one place that knows their shapes, so the chat store, the
// emulator and the bubbles read them the same way.

// `MediaArtifact.tool_name` of an answer spoken back to a voice note (backend agent/services/voice_replies.py).
export const VOICE_REPLY_SOURCE = 'VOICE_REPLY'

const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' }

// A recording as the attachment a voice note is sent with: a File to upload, and a local URL the bubble plays from
// until the server's copy is loaded.
export function voiceNoteAttachment(blob, type) {
  const mime = String(type || blob?.type || 'audio/webm').split(';')[0]
  const name = `voice-note.${EXT[mime] || 'webm'}`
  const file = new File([blob], name, { type: mime })
  return { file, name, mime, isImage: false, isAudio: true, isVoiceNote: true, url: URL.createObjectURL(file) }
}

export function isVoiceNote(attachment) {
  return !!(attachment && attachment.isVoiceNote)
}

// The answer's voice note from a saved message (`media_artifacts`), or null.
export function voiceReplyOf(serverMessage) {
  const art = (serverMessage?.media_artifacts || []).find((a) => a && a.tool_name === VOICE_REPLY_SOURCE)
  if (!art || !art.file_url) return null
  return { state: 'ready', url: art.file_url, mime: art.mime_type || 'audio/mpeg' }
}

// A `voice_reply` frame as the state the bubble shows: pending | ready (with url) | failed (with the reason).
export function voiceReplyFromFrame(frame) {
  if (!frame) return null
  if (frame.state === 'ready' && frame.artifact?.file_url) {
    return { state: 'ready', url: frame.artifact.file_url, mime: frame.artifact.mime_type || 'audio/mpeg' }
  }
  if (frame.state === 'failed') return { state: 'failed', message: frame.message || 'The voice reply could not be made.' }
  return { state: 'pending' }
}

// m:ss for a number of seconds (0:07, 1:24). Unknown → 0:00.
export function clock(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
